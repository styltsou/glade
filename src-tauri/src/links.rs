//! Markdown link resolution, classification and rewriting.
//!
//! Links are plain relative markdown links. They resolve against the directory
//! of the file that contains them, wherever that file lives; the open root only
//! decides what counts as "inside".

use std::path::{Component, Path, PathBuf};

use pulldown_cmark::{Event, Options, Parser, Tag};
use serde::Serialize;

use crate::vault;

pub fn percent_decode(s: &str) -> String {
    percent_encoding::percent_decode_str(s).decode_utf8_lossy().to_string()
}

/// Percent-encode each path segment (spaces become `%20`), keeping `/`.
pub fn encode_path(p: &str) -> String {
    p.split('/')
        .map(|seg| percent_encoding::utf8_percent_encode(seg, percent_encoding::NON_ALPHANUMERIC).to_string())
        .map(|s| s.replace("%2E", ".").replace("%2D", "-").replace("%5F", "_").replace("%7E", "~"))
        .collect::<Vec<_>>()
        .join("/")
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

/// Relative href (percent-encoded) from `from_dir` to `to`.
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

/// New href for a link in `source_dir` after its target moved from `old` to
/// `new`, if that link pointed at `old`.
fn retarget(source_dir: &Path, href: &str, old: &Path, new: &Path) -> Option<String> {
    let target = resolve_href(source_dir, href)?;
    if target != old {
        return None;
    }
    let (_, rest) = split_href(href);
    Some(format!("{}{}", relative_href(source_dir, new), rest))
}

/// Links in other files that point at `old`: how many links in how many files.
pub fn inbound_counts(root: &Path, old: &Path) -> Result<(usize, usize), crate::error::AppError> {
    let mut links = 0;
    let mut files = 0;
    for rel in vault::scan_root(root)?.files {
        let path = root.join(&rel);
        let Ok(content) = std::fs::read_to_string(&path) else { continue };
        let dir = path.parent().unwrap_or(root);
        let n = find_links(&content)
            .iter()
            .filter(|l| resolve_href(dir, &l.href).as_deref() == Some(old))
            .count();
        if n > 0 {
            links += n;
            files += 1;
        }
    }
    Ok((links, files))
}

/// Rewrite links in other files that point at `old` so they reach `new`.
pub fn apply_inbound(root: &Path, old: &Path, new: &Path) -> Result<usize, crate::error::AppError> {
    let mut changed_files = 0;
    for rel in vault::scan_root(root)?.files {
        let path = root.join(&rel);
        if path == new {
            continue;
        }
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

/// Rewrite the moved file's own relative links so they still reach the same
/// targets from its new directory.
pub fn rewrite_outbound(content: &str, old_dir: &Path, new_dir: &Path) -> (String, usize) {
    rewrite_links(content, |href| {
        let target = resolve_href(old_dir, href)?;
        let (path_part, rest) = split_href(href);
        // Leave absolute and file:// links as they are.
        if Path::new(&percent_decode(path_part)).is_absolute() || path_part.starts_with("file://") {
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
        let (out, n) = rewrite_outbound(content, Path::new("/r/guides"), Path::new("/r"));
        assert_eq!(n, 1);
        assert_eq!(out, "[API](reference/api.md) [abs](/x/y.md) [web](https://a.b)\n");
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
