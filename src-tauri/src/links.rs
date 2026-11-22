//! Markdown link resolution, classification and rewriting.
//!
//! Links are plain relative markdown links. They resolve against the directory
//! of the file that contains them, wherever that file lives; the open root only
//! decides what counts as "inside".

use std::path::{Component, Path, PathBuf};
use std::sync::LazyLock;

use pulldown_cmark::{Event, Options, Parser, Tag};
use serde::Serialize;

use crate::vault;

pub fn percent_decode(s: &str) -> String {
    percent_encoding::percent_decode_str(s).decode_utf8_lossy().to_string()
}

/// What can't be read as itself in a link; the same rule as `lib/links.ts`.
static UNREADABLE: LazyLock<regex::Regex> =
    LazyLock::new(|| regex::Regex::new(r"[[\p{Z}\p{C}]--[\x{200C}\x{200D}]]").unwrap());

/// A path as a link destination: letters of any script as they are, whatever
/// markdown or URLs give a meaning to percent-encoded (a space is `%20`).
pub fn encode_path(p: &str) -> String {
    let mut out = String::with_capacity(p.len());
    let mut buf = [0; 4];
    for c in p.chars() {
        let s: &str = c.encode_utf8(&mut buf);
        let literal = if c.is_ascii() {
            c.is_ascii_alphanumeric() || "/.-_~".contains(c)
        } else {
            !UNREADABLE.is_match(s)
        };
        if literal {
            out.push(c);
        } else {
            out.extend(percent_encoding::utf8_percent_encode(s, percent_encoding::NON_ALPHANUMERIC));
        }
    }
    out
}

/// Lexically normalize `.` and `..` (no filesystem access).
pub fn normalize(p: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for c in p.components() {
        match c {
            Component::CurDir => {}
            Component::ParentDir => {
                if !out.pop() {
                    out.push("..");
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

fn has_scheme(href: &str) -> bool {
    let Some(i) = href.find(':') else { return false };
    let scheme = &href[..i];
    scheme.len() > 1
        && scheme.chars().next().map_or(false, |c| c.is_ascii_alphabetic())
        && scheme.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '+' | '.' | '-'))
}

/// Split `path#fragment` / `path?query` into (path, rest-including-delimiter).
pub fn split_href(href: &str) -> (&str, &str) {
    match href.find(['#', '?']) {
        Some(i) => (&href[..i], &href[i..]),
        None => (href, ""),
    }
}

/// Resolve a local href to an absolute path. Returns None for web links,
/// anchors and other schemes.
pub fn resolve_href(base_dir: &Path, href: &str) -> Option<PathBuf> {
    let href = href.trim();
    if href.is_empty() || href.starts_with('#') {
        return None;
    }
    let (path_part, _) = split_href(href);
    let decoded = if let Some(rest) = path_part.strip_prefix("file://") {
        percent_decode(rest)
    } else if has_scheme(path_part) {
        return None;
    } else {
        percent_decode(path_part)
    };
    if decoded.is_empty() {
        return None;
    }
    let p = Path::new(&decoded);
    Some(if p.is_absolute() { normalize(p) } else { normalize(&base_dir.join(p)) })
}

/// Relative href (see `encode_path`) from `from_dir` to `to`.
pub fn relative_href(from_dir: &Path, to: &Path) -> String {
    let from: Vec<_> = from_dir.components().collect();
    let target: Vec<_> = to.components().collect();
    let common = from.iter().zip(target.iter()).take_while(|(a, b)| a == b).count();
    let mut parts: Vec<String> = Vec::new();
    for _ in common..from.len() {
        parts.push("..".into());
    }
    for c in &target[common..] {
        parts.push(c.as_os_str().to_string_lossy().to_string());
    }
    encode_path(&parts.join("/"))
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct LinkInfo {
    pub href: String,
    /// "web" | "anchor" | "inside" | "outside" | "missing" | "image" | "file"
    pub kind: &'static str,
    pub abs: Option<String>,
    /// Path relative to the root when the target is inside it.
    pub rel: Option<String>,
}

fn is_image(path: &Path) -> bool {
    path.extension().and_then(|e| e.to_str()).map_or(false, |e| {
        matches!(e.to_ascii_lowercase().as_str(), "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "bmp" | "avif")
    })
}

pub fn classify(root: &Path, base_dir: &Path, href: &str) -> LinkInfo {
    let mk = |kind: &'static str, abs: Option<&Path>, rel: Option<String>| LinkInfo {
        href: href.to_string(),
        kind,
        abs: abs.map(|p| p.to_string_lossy().to_string()),
        rel,
    };
    if href.trim().starts_with('#') {
        return mk("anchor", None, None);
    }
    let Some(abs) = resolve_href(base_dir, href) else {
        return mk("web", None, None);
    };
    let rel = abs.strip_prefix(root).ok().map(|r| r.to_string_lossy().to_string());
    if vault::is_markdown(&abs) {
        if !abs.exists() {
            return mk("missing", Some(&abs), rel);
        }
        return mk(if rel.is_some() { "inside" } else { "outside" }, Some(&abs), rel);
    }
    if is_image(&abs) {
        return mk("image", Some(&abs), rel);
    }
    mk(if abs.exists() { "file" } else { "missing" }, Some(&abs), rel)
}

/// What the `glade-img://` protocol serves for a request path: the file's
/// MIME type and bytes, only for images that exist. Anything else is refused.
pub fn read_image(raw_request_path: &str) -> Option<(String, Vec<u8>)> {
    let path = PathBuf::from(percent_decode(raw_request_path.trim_start_matches('/')));
    let mime = mime_guess::from_path(&path).first_or_octet_stream();
    if mime.type_() != mime_guess::mime::IMAGE || !path.is_file() {
        return None;
    }
    std::fs::read(&path).ok().map(|bytes| (mime.essence_str().to_string(), bytes))
}

/// A link's destination inside the source text.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LinkSpan {
    /// Byte range of the destination only (without `<>` or title).
    pub start: usize,
    pub end: usize,
    pub href: String,
}

/// Find inline links and images with their destination spans.
pub fn find_links(source: &str) -> Vec<LinkSpan> {
    let mut out = Vec::new();
    for (event, range) in Parser::new_ext(source, Options::all()).into_offset_iter() {
        let is_link = matches!(event, Event::Start(Tag::Link { .. }) | Event::Start(Tag::Image { .. }));
        if !is_link {
            continue;
        }
        let text = &source[range.clone()];
        let Some(open) = text.rfind("](") else { continue };
        if !text.ends_with(')') {
            continue;
        }
        let inner_start = range.start + open + 2;
        let inner = &source[inner_start..range.end - 1];
        let lead = inner.len() - inner.trim_start().len();
        let body = inner.trim_start();
        let (dest_off, dest_len) = if let Some(stripped) = body.strip_prefix('<') {
            match stripped.find('>') {
                Some(i) => (lead + 1, i),
                None => continue,
            }
        } else {
            let mut depth = 0i32;
            let mut end = body.len();
            for (i, c) in body.char_indices() {
                match c {
                    '(' => depth += 1,
                    ')' => depth -= 1,
                    c if c.is_whitespace() && depth <= 0 => {
                        end = i;
                        break;
                    }
                    _ => {}
                }
            }
            (lead, end)
        };
        let start = inner_start + dest_off;
        let end = start + dest_len;
        out.push(LinkSpan { start, end, href: source[start..end].to_string() });
    }
    out
}

/// Rewrite the hrefs of a file's links through `f` (None = keep). Returns the
/// new text and how many links changed.
pub fn rewrite_links(source: &str, mut f: impl FnMut(&str) -> Option<String>) -> (String, usize) {
    let mut spans = find_links(source);
    spans.sort_by_key(|s| s.start);
    let mut out = String::with_capacity(source.len());
    let mut last = 0;
    let mut count = 0;
    for s in spans {
        if let Some(new) = f(&s.href) {
            if new != s.href {
                out.push_str(&source[last..s.start]);
                out.push_str(&new);
                last = s.end;
                count += 1;
            }
        }
    }
    out.push_str(&source[last..]);
    (out, count)
}

/// Where `path` is after `old` (a file, or a folder holding it) moved to `new`.
pub fn relocate(path: &Path, old: &Path, new: &Path) -> Option<PathBuf> {
    let rest = path.strip_prefix(old).ok()?;
    // Joining an empty path would add a trailing slash.
    Some(if rest.as_os_str().is_empty() { new.to_path_buf() } else { new.join(rest) })
}

/// New href for a link in `source_dir` after `old` moved to `new`, if that
/// link pointed at `old` or into it.
fn retarget(source_dir: &Path, href: &str, old: &Path, new: &Path) -> Option<String> {
    let target = relocate(&resolve_href(source_dir, href)?, old, new)?;
    let (_, rest) = split_href(href);
    Some(format!("{}{}", relative_href(source_dir, &target), rest))
}

/// Links that point at `old` or into it: how many links in how many files.
pub fn inbound_counts(root: &Path, old: &Path) -> Result<(usize, usize), crate::error::AppError> {
    let mut links = 0;
    let mut files = 0;
    for rel in vault::scan_root(root)?.files {
        let path = root.join(&rel);
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let dir = path.parent().unwrap_or(root);
        let n = find_links(&content)
            .iter()
            .filter(|l| resolve_href(dir, &l.href).map_or(false, |t| t.starts_with(old)))
            .count();
        if n > 0 {
            links += n;
            files += 1;
        }
    }
    Ok((links, files))
}

/// Rewrite links that point at `old` or into it so they reach `new`, including
/// a moved note's links to itself. Running it again changes nothing.
pub fn apply_inbound(root: &Path, old: &Path, new: &Path) -> Result<usize, crate::error::AppError> {
    let mut changed_files = 0;
    for rel in vault::scan_root(root)?.files {
        let path = root.join(&rel);
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let dir = path.parent().unwrap_or(root).to_path_buf();
        let (updated, n) = rewrite_links(&content, |h| retarget(&dir, h, old, new));
        if n > 0 {
            crate::watch::write_file(&path, updated)?;
            changed_files += 1;
        }
    }
    Ok(changed_files)
}

/// Rewrite the relative links of the notes that moved from `old` to `new`
/// (one note, or a folder of them) so they still reach the same targets.
/// Links that still work keep their exact text.
pub fn rewrite_moved(root: &Path, old: &Path, new: &Path) -> Result<(), crate::error::AppError> {
    let files = if new.is_dir() {
        vault::scan_root(root)?.files.iter().map(|rel| root.join(rel)).filter(|p| p.starts_with(new)).collect()
    } else if vault::is_markdown(new) {
        vec![new.to_path_buf()]
    } else {
        vec![]
    };
    for path in files {
        let Some(was) = relocate(&path, new, old) else { continue };
        let (Some(old_dir), Some(new_dir)) = (was.parent(), path.parent()) else { continue };
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let (updated, n) = rewrite_outbound(&content, old_dir, new_dir, old, new);
        if n > 0 {
            crate::watch::write_file(&path, updated)?;
        }
    }
    Ok(())
}

/// Rewrite relative links in content that went from `old_dir` to `new_dir` as
/// part of moving `old` to `new`.
fn rewrite_outbound(content: &str, old_dir: &Path, new_dir: &Path, old: &Path, new: &Path) -> (String, usize) {
    rewrite_links(content, |href| {
        let (path_part, rest) = split_href(href);
        // Leave absolute and file:// links as they are.
        if Path::new(&percent_decode(path_part)).is_absolute() || path_part.starts_with("file://") {
            return None;
        }
        let target = resolve_href(old_dir, href)?;
        let target = relocate(&target, old, new).unwrap_or(target);
        if resolve_href(new_dir, href).as_ref() == Some(&target) {
            return None;
        }
        Some(format!("{}{}", relative_href(new_dir, &target), rest))
    })
}

/// Markdown files in `root` that link to `target`.
pub fn backlinks(root: &Path, target: &Path) -> Result<Vec<PathBuf>, crate::error::AppError> {
    let mut out = Vec::new();
    for rel in vault::scan_root(root)?.files {
        let path = root.join(&rel);
        if path == target {
            continue;
        }
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let dir = path.parent().unwrap_or(root);
        if find_links(&content).iter().any(|l| resolve_href(dir, &l.href).as_deref() == Some(target)) {
            out.push(rel);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn image_protocol_serves_images_only() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("pic.png"), [1u8, 2, 3]).unwrap();
        fs::write(dir.path().join("my pic.svg"), "<svg/>").unwrap();
        fs::write(dir.path().join("secret.txt"), "nope").unwrap();
        fs::write(dir.path().join("run.sh"), "#!/bin/sh").unwrap();

        // The frontend sends the whole absolute path as one encoded URL segment
        // (convertFileSrc), so slashes arrive as %2F.
        let req = |name: &str| {
            let abs = dir.path().join(name).to_string_lossy().to_string();
            format!("/{}", percent_encoding::utf8_percent_encode(&abs, percent_encoding::NON_ALPHANUMERIC))
        };
        let (mime, bytes) = read_image(&req("pic.png")).unwrap();
        assert_eq!(mime, "image/png");
        assert_eq!(bytes, vec![1, 2, 3]);
        assert_eq!(read_image(&req("my pic.svg")).unwrap().0, "image/svg+xml");
        assert!(read_image(&req("secret.txt")).is_none());
        assert!(read_image(&req("run.sh")).is_none());
        assert!(read_image(&req("missing.png")).is_none());
    }

    #[test]
    fn resolves_relative_to_the_containing_file() {
        let base = Path::new("/r/docs");
        assert_eq!(resolve_href(base, "../README.md"), Some(PathBuf::from("/r/README.md")));
        assert_eq!(resolve_href(base, "a/b.md#sec"), Some(PathBuf::from("/r/docs/a/b.md")));
        assert_eq!(resolve_href(base, "my%20notes/p.md"), Some(PathBuf::from("/r/docs/my notes/p.md")));
        assert_eq!(resolve_href(base, "/abs/x.md"), Some(PathBuf::from("/abs/x.md")));
        assert_eq!(resolve_href(base, "file:///abs/x.md"), Some(PathBuf::from("/abs/x.md")));
        assert_eq!(resolve_href(base, "https://example.com"), None);
        assert_eq!(resolve_href(base, "mailto:a@b.c"), None);
        assert_eq!(resolve_href(base, "#top"), None);
    }

    #[test]
    fn relative_hrefs_are_encoded() {
        assert_eq!(relative_href(Path::new("/r/guides"), Path::new("/r/reference/api.md")), "../reference/api.md");
        assert_eq!(relative_href(Path::new("/r"), Path::new("/r/my notes/plan.md")), "my%20notes/plan.md");
        assert_eq!(relative_href(Path::new("/r/a"), Path::new("/r/a/b.md")), "b.md");
    }

    /// Same cases as `encodePath` in links.test.ts: both sides must write alike.
    #[test]
    fn paths_stay_readable() {
        for (path, href) in [
            ("έργα/σημειώσεις.md", "έργα/σημειώσεις.md"),
            ("会議 メモ.md", "会議%20メモ.md"),
            ("σχέδιο (2)#1?.md", "σχέδιο%20%282%29%231%3F.md"),
            ("Cafe\u{301} 🚀.md", "Cafe\u{301}%20🚀.md"),
            ("می\u{200c}خواهم.md", "می\u{200c}خواهم.md"),
            ("a\u{a0}b.md", "a%C2%A0b.md"),
            ("a\u{3000}b.md", "a%E3%80%80b.md"),
            ("a\u{202e}b.md", "a%E2%80%AEb.md"),
            ("50% off.md", "50%25%20off.md"),
            ("%CE%B1.md", "%25CE%25B1.md"),
        ] {
            assert_eq!(encode_path(path), href);
            let resolved = resolve_href(Path::new("/r"), href).unwrap();
            assert_eq!(resolved, Path::new("/r").join(path), "{href}");
            let source = format!("see [x]({href}) after\n");
            assert_eq!(find_links(&source)[0].href, href, "parsed whole");
        }
    }

    #[test]
    fn encoded_and_readable_links_are_the_same_link() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::write(root.join("a.md"), "[1](%CE%B1.md) [2](α.md#τέλος)\n").unwrap();
        let (old, new) = (root.join("α.md"), root.join("νέο όνομα.md"));
        assert_eq!(inbound_counts(root, &old).unwrap(), (2, 1));
        apply_inbound(root, &old, &new).unwrap();
        assert_eq!(fs::read_to_string(root.join("a.md")).unwrap(), "[1](νέο%20όνομα.md) [2](νέο%20όνομα.md#τέλος)\n");
    }

    #[test]
    fn classifies_by_target() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("docs");
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("in.md"), "x").unwrap();
        fs::write(dir.path().join("README.md"), "x").unwrap();
        fs::write(root.join("pic.png"), "x").unwrap();
        fs::write(root.join("run.sh"), "x").unwrap();
        let c = |h: &str| classify(&root, &root, h).kind;
        assert_eq!(c("in.md"), "inside");
        assert_eq!(c("../README.md"), "outside");
        assert_eq!(c("gone.md"), "missing");
        assert_eq!(c("pic.png"), "image");
        assert_eq!(c("run.sh"), "file");
        assert_eq!(c("https://x.dev"), "web");
        assert_eq!(c("#h"), "anchor");
    }

    #[test]
    fn finds_destination_spans() {
        let src = "[a](one.md) and ![i](img/p.png \"t\") and [b](<my file.md>) and [c](x(1).md)";
        let hrefs: Vec<_> = find_links(src).into_iter().map(|l| l.href).collect();
        assert_eq!(hrefs, ["one.md", "img/p.png", "my file.md", "x(1).md"]);
    }

    #[test]
    fn rewrites_only_destinations() {
        let src = "see [Old](old.md#h \"title\") and [web](https://old.md)\n";
        let (out, n) = rewrite_links(src, |h| h.starts_with("old.md").then(|| "new/old.md#h".to_string()));
        assert_eq!(n, 1);
        assert_eq!(out, "see [Old](new/old.md#h \"title\") and [web](https://old.md)\n");
    }

    #[test]
    fn move_rewrites_outbound_links() {
        let content = "[API](../reference/api.md) [abs](/x/y.md) [web](https://a.b)\n";
        let (out, n) = rewrite_outbound(content, Path::new("/r/guides"), Path::new("/r"), Path::new("/r/guides/a.md"), Path::new("/r/a.md"));
        assert_eq!(n, 1);
        assert_eq!(out, "[API](reference/api.md) [abs](/x/y.md) [web](https://a.b)\n");
    }

    #[test]
    fn moving_a_folder_keeps_links_in_and_out_of_it() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("box/d")).unwrap();
        fs::create_dir_all(root.join("d2")).unwrap();
        fs::write(root.join("box/d/in.md"), "[up](../index.md#top) [sib](./sib.md) [me](../d/in.md)\n").unwrap();
        fs::write(root.join("index.md"), "[in](d/in.md#x) [folder](d) [not it](d2/in.md)\n").unwrap();
        let (old, new) = (root.join("d"), root.join("box/d"));

        rewrite_moved(root, &old, &new).unwrap();
        // Only the link that broke changes; `./sib.md` and `../d/in.md` still resolve.
        let inside = "[up](../../index.md#top) [sib](./sib.md) [me](../d/in.md)\n";
        assert_eq!(fs::read_to_string(root.join("box/d/in.md")).unwrap(), inside);

        assert_eq!(inbound_counts(root, &old).unwrap(), (2, 1));
        for _ in 0..2 {
            apply_inbound(root, &old, &new).unwrap();
            let index = fs::read_to_string(root.join("index.md")).unwrap();
            assert_eq!(index, "[in](box/d/in.md#x) [folder](box/d) [not it](d2/in.md)\n");
            assert_eq!(fs::read_to_string(root.join("box/d/in.md")).unwrap(), inside);
        }
    }

    #[test]
    fn rename_updates_inbound_links_in_the_root_only() {
        let outer = tempfile::tempdir().unwrap();
        let root = outer.path().join("root");
        fs::create_dir_all(root.join("sub")).unwrap();
        fs::write(root.join("c.md"), "moved").unwrap();
        fs::write(root.join("a.md"), "see [C](c.md#x) and [C again](./c.md)\n").unwrap();
        fs::write(root.join("sub/b.md"), "up [C](../c.md)\n").unwrap();
        fs::write(root.join("keep.md"), "nothing\n").unwrap();
        fs::write(outer.path().join("outside.md"), "[C](root/c.md)\n").unwrap();

        let old = root.join("c.md");
        let new = root.join("concepts.md");
        assert_eq!(inbound_counts(&root, &old).unwrap(), (3, 2));
        assert_eq!(backlinks(&root, &old).unwrap().len(), 2);

        assert_eq!(apply_inbound(&root, &old, &new).unwrap(), 2);
        assert_eq!(fs::read_to_string(root.join("a.md")).unwrap(), "see [C](concepts.md#x) and [C again](concepts.md)\n");
        assert_eq!(fs::read_to_string(root.join("sub/b.md")).unwrap(), "up [C](../concepts.md)\n");
        assert_eq!(fs::read_to_string(root.join("keep.md")).unwrap(), "nothing\n");
        // Files outside the root are never touched.
        assert_eq!(fs::read_to_string(outer.path().join("outside.md")).unwrap(), "[C](root/c.md)\n");
    }
}
