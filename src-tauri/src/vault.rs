use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;

use chrono::Utc;

use crate::config;
use crate::error::AppError;
use crate::types::{NoteCard, NoteMeta, TagCount, VaultEntry, PREVIEW_LENGTH};

static VAULT_TREE_CACHE: RwLock<Option<(PathBuf, Vec<VaultEntry>)>> = RwLock::new(None);
static PINNED_NOTES_CACHE: RwLock<Vec<NoteCard>> = RwLock::new(Vec::new());
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

pub fn get_vault_dir(slug: &str) -> Result<PathBuf, AppError> {
    let vault_dir = get_vaults_root()?.join(slug);
    if !vault_dir.exists() {
        fs::create_dir_all(&vault_dir)?;
    }
    Ok(vault_dir)
}

pub fn get_active_vault_dir() -> Result<PathBuf, AppError> {
    let config = config::load_config()?;
    let active_id = config
        .active_vault_id
        .ok_or_else(|| AppError::InvalidPath("No active vault set".into()))?;
    let vault = config
        .vaults
        .iter()
        .find(|v| v.id == active_id)
        .ok_or_else(|| AppError::InvalidPath("Active vault not found".into()))?;
    get_vault_dir(&vault.slug)
}

pub fn get_vault_path() -> Result<PathBuf, AppError> {
    get_active_vault_dir()
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
    let entries = build_vault_tree_inner(vault_root, vault_root)?;
    *VAULT_TREE_CACHE.write().unwrap() = Some((vault_root.to_path_buf(), entries.clone()));

    Ok(entries)
}

fn build_vault_tree_inner(vault_root: &Path, dir: &Path) -> Result<Vec<VaultEntry>, AppError> {
    let mut entries = Vec::new();

    let mut children: Vec<_> = fs::read_dir(dir)?.filter_map(|e| e.ok()).collect();
    children.sort_by_key(|e| e.file_name());

    for entry in children {
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/directories (like .git)
        if name.starts_with('.') {
            continue;
        }

        let path = entry.path();
        // Always strip the vault root so the path is vault-relative.
        let relative = path
            .strip_prefix(vault_root)
            .unwrap_or(&path)
            .to_string_lossy()
            .to_string();

        let metadata = entry.metadata()?;
        let modified = metadata.modified().ok().and_then(|t| {
            let datetime: chrono::DateTime<Utc> = t.into();
            Some(datetime.to_rfc3339())
        });

        if metadata.is_dir() {
            let sub_children = build_vault_tree_inner(vault_root, &path)?;
            entries.push(VaultEntry {
                name,
                path: relative,
                is_dir: true,
                children: sub_children,
                modified,
                tags: vec![],
            });
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path).unwrap_or_default();
            let (meta, _) = parse_frontmatter(&content);
            let stem = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| name.clone());
            let display_name = meta.title.filter(|t| !t.is_empty()).unwrap_or(stem);

            entries.push(VaultEntry {
                name: display_name,
                path: relative,
                is_dir: false,
                children: vec![],
                modified,
                tags: meta.tags,
            });
        }
    }

    Ok(entries)
}

/// Parse YAML frontmatter from markdown content.
/// Returns (frontmatter, body) where frontmatter is the parsed metadata.
pub fn parse_frontmatter(content: &str) -> (NoteMeta, String) {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return (NoteMeta::default(), content.to_string());
    }

    // Find the closing ---
    let after_open = &trimmed[3..];
    if let Some(close_pos) = after_open.find("\n---") {
        let yaml_str = &after_open[..close_pos].trim();
        let body = after_open[close_pos + 4..].trim_start().to_string();

        let meta: NoteMeta = serde_json::from_str(&yaml_to_json(yaml_str)).unwrap_or_default();

        (meta, body)
    } else {
        (NoteMeta::default(), content.to_string())
    }
}

/// Build a YAML frontmatter string from metadata.
pub fn build_frontmatter(meta: &NoteMeta) -> String {
    let mut lines = vec!["---".to_string()];

    if let Some(ref title) = meta.title {
        let escaped = title.replace('"', "\\\"");
        lines.push(format!("title: \"{}\"", escaped));
    }

    if !meta.tags.is_empty() {
        let tags_str = meta
            .tags
            .iter()
            .map(|t| t.as_str())
            .collect::<Vec<_>>()
            .join(", ");
        lines.push(format!("tags: [{}]", tags_str));
    }

    if let Some(ref created) = meta.created {
        lines.push(format!("created: {}", created));
    }

    if let Some(ref updated) = meta.updated {
        lines.push(format!("updated: {}", updated));
    }

    if meta.pinned {
        lines.push("pinned: true".to_string());
    }

    lines.push("---".to_string());
    lines.join("\n")
}

/// Very simple YAML-to-JSON converter for our limited frontmatter format.
/// Handles: key: "value", key: value, key: [a, b, c], key: true/false
fn yaml_to_json(yaml: &str) -> String {
    let mut pairs = Vec::new();

    for line in yaml.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim();
            let mut value = line[colon_pos + 1..].trim();

            if value.starts_with('[') && value.ends_with(']') {
                // Array value
                let inner = &value[1..value.len() - 1];
                let items: Vec<String> = inner
                    .split(',')
                    .map(|s| format!("\"{}\"", s.trim().trim_matches('"').replace('"', "\\\"")))
                    .collect();
                pairs.push(format!("\"{}\":[{}]", key, items.join(",")));
            } else if value == "true" || value == "false" {
                // Boolean value
                pairs.push(format!("\"{}\":{}", key, value));
            } else {
                // String value — handle potential quotes
                if value.starts_with('"') && value.ends_with('"') && value.len() >= 2 {
                    value = &value[1..value.len() - 1];
                }
                let escaped = value.replace('\\', "\\\\").replace('"', "\\\"");
                pairs.push(format!("\"{}\":\"{}\"", key, escaped));
            }
        }
    }

    format!("{{{}}}", pairs.join(","))
}

/// Generate a preview string from the body (first ~120 chars, single line).
pub fn make_preview(body: &str) -> String {
    let preview: String = body
        .lines()
        .filter(|line| {
            let trimmed = line.trim();
            !trimmed.is_empty() && !trimmed.starts_with('#') && !trimmed.starts_with("---")
        })
        .take(2)
        .collect::<Vec<_>>()
        .join(" ");

    if preview.len() > PREVIEW_LENGTH {
        format!("{}…", &preview[..PREVIEW_LENGTH])
    } else {
        preview
    }
}

/// Walk all .md files in a vault, calling a callback for each.
/// Callback receives: (full_path, relative_path, note_meta, body)
/// Callback returns: Some(T) to include in results, None to skip
pub fn walk_notes<T>(
    root: &Path,
    dir: &Path,
    mut callback: impl FnMut(&Path, &str, &NoteMeta, &str) -> Option<T>,
) -> Result<Vec<T>, AppError> {
    let mut results = Vec::new();
    let mut stack = vec![dir.to_path_buf()];

    while let Some(current_dir) = stack.pop() {
        let entries: Vec<_> = fs::read_dir(&current_dir)?.filter_map(|e| e.ok()).collect();

        for entry in entries {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            if name.starts_with('.') {
                continue;
            }

            if path.is_dir() {
                stack.push(path);
            } else if name.ends_with(".md") {
                let relative = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();

                let content = fs::read_to_string(&path).unwrap_or_default();
                let (meta, body) = parse_frontmatter(&content);

                if let Some(result) = callback(&path, &relative, &meta, &body) {
                    results.push(result);
                }
            }
        }
    }

    Ok(results)
}

/// Invalidate the vault tree cache. Call this after any mutation (create, delete, rename).
pub fn invalidate_vault_cache() {
    *VAULT_TREE_CACHE.write().unwrap() = None;
    *PINNED_NOTES_CACHE.write().unwrap() = Vec::new();
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

/// Get cached pinned notes, or scan if not cached.
pub fn get_pinned_notes_cached(vault_root: &Path) -> Result<Vec<NoteCard>, AppError> {
    // Check cache first
    let cached = PINNED_NOTES_CACHE.read().unwrap();
    if !cached.is_empty() {
        return Ok(cached.clone());
    }
    drop(cached);

    // Scan and cache using walk_notes
    let cards: Vec<NoteCard> = walk_notes(vault_root, vault_root, |path, relative, meta, body| {
        if !meta.pinned {
            return None;
        }

        let filename = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let title = meta
            .title
            .clone()
            .filter(|t| !t.is_empty())
            .unwrap_or(filename);
        let fs_meta = match fs::metadata(path) {
            Ok(m) => m,
            Err(_) => return None,
        };
        let modified = fs_meta.modified().ok().and_then(|t| {
            let dt: chrono::DateTime<Utc> = t.into();
            Some(dt.to_rfc3339())
        });

        Some(NoteCard {
            path: relative.to_string(),
            title,
            tags: meta.tags.clone(),
            modified,
            preview: make_preview(body),
            pinned: meta.pinned,
        })
    })?;

    let mut cards = cards;
    cards.sort_by(|a, b| b.modified.cmp(&a.modified));

    *PINNED_NOTES_CACHE.write().unwrap() = cards.clone();
    Ok(cards)
}

/// Update pinned cache after pin/unpin operations.
pub fn update_pinned_cache(path: &str, pinned: bool, note_card: Option<NoteCard>) {
    let mut cache = PINNED_NOTES_CACHE.write().unwrap();
    if pinned {
        if let Some(card) = note_card {
            cache.retain(|c| c.path != path);
            cache.push(card);
            cache.sort_by(|a, b| b.modified.cmp(&a.modified));
        }
    } else {
        cache.retain(|c| c.path != path);
    }
}
