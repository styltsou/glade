use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use chrono::Utc;

use crate::error::AppError;
use crate::frontmatter;
use crate::types::{NoteCard, NoteMeta, TagCount, VaultEntry, PREVIEW_LENGTH};
use crate::workspace_state;

static VAULT_TREE_CACHE: RwLock<Option<(PathBuf, Vec<VaultEntry>)>> = RwLock::new(None);
static TAGS_CACHE: RwLock<Option<(PathBuf, Vec<TagCount>)>> = RwLock::new(None);

fn get_home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE").ok().map(PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

pub fn get_glade_root() -> Result<PathBuf, AppError> {
    let home = get_home_dir()
        .ok_or_else(|| AppError::InvalidPath("Could not determine home directory".into()))?;
    let glade = home.join(".glade");
    if !glade.exists() {
        fs::create_dir_all(&glade)?;
    }
    Ok(glade)
}

pub fn get_vaults_root() -> Result<PathBuf, AppError> {
    let root = get_glade_root()?.join("vaults");
    if !root.exists() {
        fs::create_dir_all(&root)?;
    }
    Ok(root)
}

/// Build a recursive tree of `VaultEntry` from the vault directory.
/// `vault_root` is always the top-level vault path so that all `path` values
/// returned by this function are relative to the vault root, never to a
/// subdirectory.
/// Uses in-memory cache to avoid repeated filesystem scans.
pub fn build_vault_tree(vault_root: &Path) -> Result<Vec<VaultEntry>, AppError> {
    // Check cache
    let cached = VAULT_TREE_CACHE.read().unwrap();
    if let Some((cached_path, entries)) = cached.as_ref() {
        if cached_path == vault_root {
            return Ok(entries.clone());
        }
    }
    drop(cached);

    // Build and cache
    let entries = build_vault_tree_inner(vault_root)?;
    *VAULT_TREE_CACHE.write().unwrap() = Some((vault_root.to_path_buf(), entries.clone()));

    Ok(entries)
}

/// Directory names never indexed, whatever `.gitignore` says.
const ALWAYS_SKIPPED: [&str; 3] = [".git", "node_modules", "target"];
/// Safety cap so opening something like `~` stays responsive.
pub const MAX_MARKDOWN_FILES: usize = 20_000;

pub fn is_markdown(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map_or(false, |e| matches!(e.to_ascii_lowercase().as_str(), "md" | "mdx" | "markdown"))
}

/// Result of scanning a root: markdown files plus the folders worth showing.
pub struct Scan {
    /// Markdown files, relative to the root, sorted.
    pub files: Vec<PathBuf>,
    /// Folders to show, relative to the root: those with markdown below them,
    /// plus empty folders (so a freshly created folder doesn't vanish).
    pub dirs: Vec<PathBuf>,
}

/// Walk a root honoring `.gitignore` rules and the always-skipped directories.
pub fn scan_root(root: &Path) -> Result<Scan, AppError> {
    use std::collections::HashSet;

    let walker = ignore::WalkBuilder::new(root)
        .hidden(true)
        .require_git(false)
        .filter_entry(|e| {
            !(e.file_type().map_or(false, |t| t.is_dir())
                && ALWAYS_SKIPPED.iter().any(|n| e.file_name() == *n))
        })
        .build();

    let mut files: Vec<PathBuf> = Vec::new();
    let mut all_dirs: HashSet<PathBuf> = HashSet::new();
    let mut has_child: HashSet<PathBuf> = HashSet::new();

    for entry in walker.flatten() {
        let Ok(rel) = entry.path().strip_prefix(root) else { continue };
        if rel.as_os_str().is_empty() {
            continue;
        }
        if let Some(parent) = rel.parent() {
            has_child.insert(parent.to_path_buf());
        }
        if entry.file_type().map_or(false, |t| t.is_dir()) {
            all_dirs.insert(rel.to_path_buf());
        } else if is_markdown(rel) && files.len() < MAX_MARKDOWN_FILES {
            files.push(rel.to_path_buf());
        }
    }

    let mut shown: HashSet<PathBuf> = HashSet::new();
    for f in &files {
        let mut cur = f.parent();
        while let Some(d) = cur {
            if d.as_os_str().is_empty() {
                break;
            }
            shown.insert(d.to_path_buf());
            cur = d.parent();
        }
    }
    for d in &all_dirs {
        if !has_child.contains(d) {
            // Empty folder: keep visible, along with its ancestors.
            let mut cur = Some(d.as_path());
            while let Some(a) = cur {
                if a.as_os_str().is_empty() {
                    break;
                }
                shown.insert(a.to_path_buf());
                cur = a.parent();
            }
        }
    }

    files.sort();
    let mut dirs: Vec<PathBuf> = shown.into_iter().collect();
    dirs.sort();
    Ok(Scan { files, dirs })
}

fn build_vault_tree_inner(vault_root: &Path) -> Result<Vec<VaultEntry>, AppError> {
    use std::collections::HashMap;

    let scan = scan_root(vault_root)?;
    let mut children: HashMap<PathBuf, Vec<(PathBuf, bool)>> = HashMap::new();
    for d in &scan.dirs {
        children.entry(d.parent().unwrap_or(Path::new("")).to_path_buf()).or_default().push((d.clone(), true));
    }
    for f in &scan.files {
        children.entry(f.parent().unwrap_or(Path::new("")).to_path_buf()).or_default().push((f.clone(), false));
    }

    fn build(root: &Path, dir: &Path, children: &HashMap<PathBuf, Vec<(PathBuf, bool)>>) -> Vec<VaultEntry> {
        let mut items = children.get(dir).cloned().unwrap_or_default();
        items.sort_by_key(|(p, _)| p.file_name().map(|n| n.to_os_string()));
        let mut out = Vec::new();
        for (rel, is_dir) in items {
            let relative = rel.to_string_lossy().to_string();
            let name = rel
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            if is_dir {
                out.push(VaultEntry {
                    id: relative.clone(),
                    name,
                    path: relative,
                    is_dir: true,
                    children: build(root, &rel, children),
                    modified: None,
                    created_at: None,
                    tags: vec![],
                });
            } else {
                let full = root.join(&rel);
                let content = fs::read_to_string(&full).unwrap_or_default();
                let (meta, _) = parse_frontmatter(&content);
                let stem = full
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_else(|| name.clone());
                let (created, modified) = fs_times(&full);
                out.push(VaultEntry {
                    id: relative.clone(),
                    name: meta.title.filter(|t| !t.is_empty()).unwrap_or(stem),
                    path: relative,
                    is_dir: false,
                    children: vec![],
                    modified,
                    created_at: created,
                    tags: meta.tags,
                });
            }
        }
        out
    }

    Ok(build(vault_root, Path::new(""), &children))
}

/// Read a note's metadata and body. The body is everything after the
/// frontmatter block, verbatim. Nothing here is ever written back.
pub fn parse_frontmatter(content: &str) -> (NoteMeta, String) {
    let title = frontmatter::derive_title(content, "");
    let meta = NoteMeta {
        title: if title.is_empty() { None } else { Some(title) },
        tags: frontmatter::get_tags(content),
        created: frontmatter::get_scalar_string(content, &["created", "date", "created_at"]),
    };
    (meta, frontmatter::body_of(content).to_string())
}

fn to_rfc3339(t: std::time::SystemTime) -> String {
    chrono::DateTime::<Utc>::from(t).to_rfc3339()
}

/// Filesystem (created, modified) times as ISO strings. `created` falls back to
/// modified where the platform has no birth time.
pub fn fs_times(path: &Path) -> (Option<String>, Option<String>) {
    let Ok(meta) = fs::metadata(path) else {
        return (None, None);
    };
    let modified = meta.modified().ok();
    let created = meta.created().ok().or(modified);
    (created.map(to_rfc3339), modified.map(to_rfc3339))
}

/// Plain-text preview of a note body (first ~120 chars, single line): markdown
/// is rendered away, so `**bold**`, links, quotes and list markers show as text.
/// Headings, code blocks and rules are skipped.
pub fn make_preview(body: &str) -> String {
    use pulldown_cmark::{Event, Parser, Tag, TagEnd};

    let mut text = String::new();
    let mut skip = 0usize; // inside a heading or code block
    for event in Parser::new(body) {
        match event {
            Event::Start(Tag::Heading { .. } | Tag::CodeBlock(_) | Tag::Image { .. }) => skip += 1,
            Event::End(TagEnd::Heading(_) | TagEnd::CodeBlock | TagEnd::Image) => skip = skip.saturating_sub(1),
            Event::Text(t) | Event::Code(t) if skip == 0 => text.push_str(&t),
            Event::SoftBreak | Event::HardBreak if skip == 0 => text.push(' '),
            Event::End(TagEnd::Paragraph | TagEnd::Item | TagEnd::TableCell | TagEnd::TableRow) if skip == 0 => text.push(' '),
            _ => {}
        }
        if text.chars().count() > PREVIEW_LENGTH * 2 {
            break;
        }
    }

    let preview = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if preview.chars().count() > PREVIEW_LENGTH {
        let cut: String = preview.chars().take(PREVIEW_LENGTH).collect();
        format!("{}…", cut.trim_end())
    } else {
        preview
    }
}

/// Walk all markdown files under `root`, calling a callback for each.
/// Callback receives: (full_path, relative_path, note_meta, body)
/// Callback returns: Some(T) to include in results, None to skip
pub fn walk_notes<T>(
    root: &Path,
    mut callback: impl FnMut(&Path, &str, &NoteMeta, &str) -> Option<T>,
) -> Result<Vec<T>, AppError> {
    let mut results = Vec::new();
    for rel in scan_root(root)?.files {
        let path = root.join(&rel);
        let content = fs::read_to_string(&path).unwrap_or_default();
        let (meta, body) = parse_frontmatter(&content);
        if let Some(result) = callback(&path, &rel.to_string_lossy(), &meta, &body) {
            results.push(result);
        }
    }
    Ok(results)
}

/// Invalidate the vault tree cache. Call this after any mutation (create, delete, rename).
pub fn invalidate_vault_cache() {
    *VAULT_TREE_CACHE.write().unwrap() = None;
    *TAGS_CACHE.write().unwrap() = None;
}

/// Get tags cache for a specific vault, returns None if not cached or different vault.
pub fn get_tags_cache(vault_path: &Path) -> Option<Vec<crate::types::TagCount>> {
    let cached = TAGS_CACHE.read().unwrap();
    if let Some((cached_path, tags)) = cached.as_ref() {
        if cached_path == vault_path {
            return Some(tags.clone());
        }
    }
    None
}

/// Set tags cache for a specific vault.
pub fn set_tags_cache(vault_path: &Path, tags: Vec<crate::types::TagCount>) {
    *TAGS_CACHE.write().unwrap() = Some((vault_path.to_path_buf(), tags));
}

/// Build a card for one note file. `relative` is the path under `root`.
pub fn note_card(root: &Path, relative: &str, pinned: bool) -> Option<NoteCard> {
    let full = root.join(relative);
    let content = fs::read_to_string(&full).ok()?;
    let (meta, body) = parse_frontmatter(&content);
    let stem = full
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let (_, modified) = fs_times(&full);
    Some(NoteCard {
        id: relative.to_string(),
        path: relative.to_string(),
        title: meta.title.filter(|t| !t.is_empty()).unwrap_or(stem),
        tags: meta.tags,
        modified,
        preview: make_preview(&body),
        pinned,
    })
}

/// Pinned notes of a folder, from app state (never from file contents).
pub fn pinned_cards(root: &Path) -> Result<Vec<NoteCard>, AppError> {
    let state = workspace_state::load(root)?;
    let mut cards: Vec<NoteCard> = state
        .pinned
        .iter()
        .filter_map(|p| note_card(root, p, true))
        .collect();
    cards.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(cards)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn touch(root: &Path, rel: &str) {
        let p = root.join(rel);
        fs::create_dir_all(p.parent().unwrap()).unwrap();
        fs::write(p, "x").unwrap();
    }

    #[test]
    fn preview_renders_markdown_to_plain_text() {
        let body = "# Title\n\n> **Working document** · 19 November 2026 · [link](http://x)\n\n- one\n- `two`\n\n```\ncode\n```\n";
        assert_eq!(make_preview(body), "Working document · 19 November 2026 · link one two");
    }

    #[test]
    fn preview_truncates_on_char_boundaries() {
        let body = "Ελληνικά ".repeat(40);
        let p = make_preview(&body);
        assert!(p.ends_with('…'));
        assert_eq!(p.chars().count(), PREVIEW_LENGTH + 1);
    }

    fn names(paths: &[PathBuf]) -> Vec<String> {
        paths.iter().map(|p| p.to_string_lossy().to_string()).collect()
    }

    #[test]
    fn respects_gitignore_without_a_git_repo() {
        let dir = tempfile::tempdir().unwrap();
        let r = dir.path();
        touch(r, ".gitignore");
        fs::write(r.join(".gitignore"), "dist/\n").unwrap();
        touch(r, "dist/notes.md");
        touch(r, "keep.md");
        let scan = scan_root(r).unwrap();
        assert_eq!(names(&scan.files), ["keep.md"]);
    }

    #[test]
    fn always_skips_node_modules_target_and_git() {
        let dir = tempfile::tempdir().unwrap();
        let r = dir.path();
        touch(r, "node_modules/pkg/README.md");
        touch(r, "target/doc/a.md");
        touch(r, ".git/info/b.md");
        touch(r, "docs/real.md");
        let scan = scan_root(r).unwrap();
        assert_eq!(names(&scan.files), ["docs/real.md"]);
    }

    #[test]
    fn tree_shows_only_folders_with_markdown_but_keeps_empty_folders() {
        let dir = tempfile::tempdir().unwrap();
        let r = dir.path();
        touch(r, "src/main.ts");
        touch(r, "src/a/b/notes.md");
        touch(r, "other/only.ts");
        fs::create_dir_all(r.join("fresh")).unwrap();
        touch(r, "readme.txt");

        let scan = scan_root(r).unwrap();
        assert_eq!(names(&scan.files), ["src/a/b/notes.md"]);
        assert_eq!(names(&scan.dirs), ["fresh", "src", "src/a", "src/a/b"]);

        let tree = build_vault_tree_inner(r).unwrap();
        let top: Vec<_> = tree.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(top, ["fresh", "src"]);
        let leaf = &tree[1].children[0].children[0].children[0];
        assert_eq!(leaf.path, "src/a/b/notes.md");
        assert!(!leaf.is_dir);
    }

    #[test]
    fn markdown_extensions() {
        assert!(is_markdown(Path::new("a.md")));
        assert!(is_markdown(Path::new("a.MDX")));
        assert!(is_markdown(Path::new("a.markdown")));
        assert!(!is_markdown(Path::new("a.txt")));
    }

    /// Manual benchmark: `cargo test --release perf_5k -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn perf_5k_notes() {
        let dir = tempfile::tempdir().unwrap();
        for d in 0..50 {
            let sub = dir.path().join(format!("dir{d}"));
            fs::create_dir_all(&sub).unwrap();
            for n in 0..100 {
                fs::write(
                    sub.join(format!("note{n}.md")),
                    format!("---\ntitle: Note {d}-{n}\ntags: [a, b]\n---\n# Heading\n\n{}\n", "lorem ipsum ".repeat(40)),
                )
                .unwrap();
            }
        }
        let t = std::time::Instant::now();
        let tree = build_vault_tree_inner(dir.path()).unwrap();
        println!("tree of {} folders built in {:?}", tree.len(), t.elapsed());
        let t = std::time::Instant::now();
        let scan = scan_root(dir.path()).unwrap();
        println!("scan of {} files in {:?}", scan.files.len(), t.elapsed());
    }
}
