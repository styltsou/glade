use std::fs;
use std::path::Path;

use crate::config;
use crate::error::AppError;
use crate::frontmatter::{self, TitleSource};
use crate::types::{NoteCard, NoteData};
use crate::vault;
use crate::workspace_state;

fn stem_of(path: &Path) -> String {
    path.file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".into())
}

/// The extension of a note, as written (`md`, `MDX`, `markdown`...).
fn extension_of(path: &Path) -> String {
    path.extension().map(|e| e.to_string_lossy().to_string()).unwrap_or_else(|| "md".into())
}

fn relative_of(root: &Path, full: &Path) -> String {
    full.strip_prefix(root)
        .unwrap_or(full)
        .to_string_lossy()
        .to_string()
}

fn note_data(path: String, full_path: &Path, content: &str) -> NoteData {
    let (meta, body) = vault::parse_frontmatter(content);
    let (created, modified) = vault::fs_times(full_path);
    NoteData {
        id: path.clone(),
        path,
        title: meta.title.filter(|t| !t.is_empty()).unwrap_or_else(|| stem_of(full_path)),
        tags: meta.tags,
        created,
        updated: modified,
        preview: vault::make_preview(&body),
        properties: frontmatter::properties(content),
        body,
    }
}

/// Read a note file and return its parsed data. Never modifies the file.
#[tauri::command]
pub async fn read_note(window: tauri::Window, path: String) -> Result<NoteData, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let full_path = crate::workspace::resolve_markdown(&vault_path, &path)?;

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    // This is what the user now sees; later differences on disk are external.
    crate::watch::record_known(&full_path, content.as_bytes());
    Ok(note_data(path, &full_path, &content))
}

/// Write a note's body, keeping its existing frontmatter text exactly as is.
/// Returns false (and touches nothing) when the file would be byte-identical.
#[cfg(test)]
pub fn write_body(full_path: &Path, content: &str) -> Result<bool, AppError> {
    write_body_checked(full_path, content, false)
}

/// Like `write_body`, but refuses to overwrite a file that changed on disk
/// since Glade last read or wrote it, or to bring back one that is gone
/// (renamed, moved, deleted), unless `force` is set.
pub fn write_body_checked(full_path: &Path, content: &str, force: bool) -> Result<bool, AppError> {
    if !force && !full_path.exists() {
        return Err(AppError::NotFound(format!("{} was moved or deleted", full_path.display())));
    }
    if !force && crate::watch::disk_state(full_path) == crate::watch::DiskState::Modified {
        return Err(AppError::Conflict(format!("{} changed on disk", full_path.display())));
    }
    let existing = if full_path.exists() {
        Some(fs::read_to_string(full_path)?)
    } else {
        None
    };

    let head = existing
        .as_deref()
        .and_then(|e| frontmatter::split(e).map(|p| p.head))
        .unwrap_or("");
    let full_content = format!("{}{}", head, content);

    if existing.as_deref() == Some(full_content.as_str()) {
        return Ok(false);
    }

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }
    crate::watch::write_file(full_path, full_content)?;
    Ok(true)
}

/// Write a note's body. Does nothing when nothing changed.
#[tauri::command]
pub async fn write_note(
    window: tauri::Window,
    path: String,
    content: String,
    force: Option<bool>,
) -> Result<(), AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    write_body_checked(&crate::workspace::resolve_markdown(&vault_path, &path)?, &content, force.unwrap_or(false))?;
    Ok(())
}

/// Apply a frontmatter edit to a note on disk, writing only if it changed.
pub fn edit_frontmatter(
    full_path: &Path,
    edit: impl FnOnce(&str) -> Result<String, frontmatter::FmError>,
) -> Result<String, AppError> {
    let content = fs::read_to_string(full_path)?;
    let updated = edit(&content).map_err(|e| AppError::InvalidPath(format!("Cannot edit properties: {}", e)))?;
    if updated != content {
        crate::watch::write_file(full_path, &updated)?;
    }
    Ok(updated)
}

fn check_key(key: &str) -> Result<(), AppError> {
    if key.trim().is_empty() || key.contains('\n') {
        return Err(AppError::InvalidPath("Property name cannot be empty".into()));
    }
    Ok(())
}

/// Set one property. Creates the frontmatter block only if the file has none.
#[tauri::command]
pub async fn set_property(
    window: tauri::Window,
    path: String,
    key: String,
    value: frontmatter::NewValue,
) -> Result<NoteData, AppError> {
    check_key(&key)?;
    let root = crate::workspace::root_for(&window)?;
    let full = crate::workspace::resolve_markdown(&root, &path)?;
    let updated = edit_frontmatter(&full, |c| frontmatter::set_key(c, key.trim(), &value))?;
    vault::invalidate_vault_cache();
    Ok(note_data(path, &full, &updated))
}

/// Replace the whole frontmatter text (the "Edit as text" dialog).
#[tauri::command]
pub async fn set_frontmatter_text(window: tauri::Window, path: String, text: String) -> Result<NoteData, AppError> {
    let root = crate::workspace::root_for(&window)?;
    let full = crate::workspace::resolve_markdown(&root, &path)?;
    let updated = edit_frontmatter(&full, |c| frontmatter::replace_yaml(c, &text))?;
    vault::invalidate_vault_cache();
    Ok(note_data(path, &full, &updated))
}

/// Remove one property (its lines only; the whole block if it was the last).
#[tauri::command]
pub async fn remove_property(window: tauri::Window, path: String, key: String) -> Result<NoteData, AppError> {
    let root = crate::workspace::root_for(&window)?;
    let full = crate::workspace::resolve_markdown(&root, &path)?;
    let updated = edit_frontmatter(&full, |c| frontmatter::remove_key(c, &key))?;
    vault::invalidate_vault_cache();
    Ok(note_data(path, &full, &updated))
}

/// A stem for which `stem.ext` is not taken in `dir` (case-insensitive).
fn unique_stem(dir: &Path, base: &str, ext: &str, ignore: Option<&Path>, is_copy: bool) -> String {
    let mut taken = std::collections::HashSet::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if Some(path.as_path()) == ignore {
                continue;
            }
            taken.insert(entry.file_name().to_string_lossy().to_lowercase());
        }
    }
    let is_taken = |stem: &str| taken.contains(&format!("{stem}.{ext}").to_lowercase());
    if !is_taken(base) {
        return base.to_string();
    }
    let without_copy = if is_copy {
        let re = regex::Regex::new(r"\s*\(copy(?:\s+\d+)?\)$").unwrap();
        re.replace(base, "").to_string()
    } else {
        base.to_string()
    };
    let mut counter = 1;
    loop {
        let candidate = if is_copy {
            if counter == 1 {
                format!("{} (copy)", without_copy)
            } else {
                format!("{} (copy {})", without_copy, counter)
            }
        } else {
            format!("{} {}", without_copy, counter)
        };
        if !is_taken(&candidate) {
            return candidate;
        }
        counter += 1;
    }
}

/// Make a title safe to use as a file name.
fn filename_from_title(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| if matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|') || c.is_control() { '-' } else { c })
        .collect();
    let cleaned = cleaned.trim().trim_start_matches('.').trim().to_string();
    if cleaned.is_empty() { "Untitled".into() } else { cleaned }
}

/// Create a new, empty note in the given folder (or the root). No frontmatter.
#[tauri::command]
pub async fn create_note(window: tauri::Window, folder: Option<String>) -> Result<NoteData, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;

    let target_dir = match &folder {
        Some(f) => crate::workspace::resolve_inside(&vault_path, f)?,
        None => vault_path.clone(),
    };

    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)?;
    }

    let stem = unique_stem(&target_dir, "Untitled", "md", None, false);
    let full_path = target_dir.join(format!("{}.md", stem));
    crate::watch::write_file(&full_path, "")?;

    vault::invalidate_vault_cache();

    Ok(note_data(relative_of(&vault_path, &full_path), &full_path, ""))
}

/// Rename a note by editing its title where it lives: the
/// first H1, or the file name when there is no H1. Returns the note's
/// (possibly new) path relative to `root`.
pub fn rename_at(root: &Path, path: &str, new_title: &str) -> Result<String, AppError> {
    let full_path = crate::workspace::resolve_markdown(root, path)?;

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let new_title = new_title.trim();

    match frontmatter::set_title(&content, new_title) {
        Some(edited) => {
            let updated = edited
                .map_err(|e| AppError::InvalidPath(format!("Cannot update title: {}", e)))?;
            if updated != content {
                crate::watch::write_file(&full_path, updated)?;
            }
            Ok(path.to_string())
        }
        None => {
            let parent = full_path.parent().unwrap_or(root);
            let ext = extension_of(&full_path);
            let stem = unique_stem(parent, &filename_from_title(new_title), &ext, Some(&full_path), false);
            let new_full = parent.join(format!("{}.{}", stem, ext));
            crate::relocate::rename_no_replace(&full_path, &new_full)?;
            // An absolute path (loose or outside file) stays absolute.
            let new_rel = if Path::new(path).is_absolute() {
                new_full.to_string_lossy().to_string()
            } else {
                relative_of(root, &new_full)
            };
            if new_rel != path {
                if let Err(e) = workspace_state::rename_path(root, path, &new_rel) {
                    eprintln!("glade: could not update pins after renaming {path}: {e}");
                }
            }
            Ok(new_rel)
        }
    }
}

#[tauri::command]
pub async fn rename_note(window: tauri::Window, path: String, new_title: String) -> Result<String, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let result = rename_at(&vault_path, &path, &new_title)?;
    vault::invalidate_vault_cache();
    Ok(result)
}

/// Duplicate a note. The copy is byte-identical except that a title stored in
/// the file (H1) gets " (copy)" appended.
#[tauri::command]
pub async fn duplicate_note(window: tauri::Window, path: String) -> Result<NoteData, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let full_path = crate::workspace::resolve_markdown(&vault_path, &path)?;

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let parent = full_path.parent().unwrap_or(&vault_path);
    let ext = extension_of(&full_path);
    let stem = unique_stem(parent, &stem_of(&full_path), &ext, None, true);
    let new_full = parent.join(format!("{}.{}", stem, ext));

    let new_content = if frontmatter::title_source(&content) != TitleSource::Filename {
        let title = frontmatter::derive_title(&content, &stem_of(&full_path));
        frontmatter::set_title(&content, &format!("{} (copy)", title))
            .and_then(|r| r.ok())
            .unwrap_or(content.clone())
    } else {
        content.clone()
    };
    crate::watch::write_file(&new_full, &new_content)?;

    vault::invalidate_vault_cache();

    Ok(note_data(relative_of(&vault_path, &new_full), &new_full, &new_content))
}

/// Retrieve all pinned notes as NoteCards. Pins live in app state, not files.
#[tauri::command]
pub async fn get_pinned_notes(window: tauri::Window) -> Result<Vec<NoteCard>, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    vault::pinned_cards(&vault_path)
}

/// Retrieve up to 6 recently-opened notes as NoteCards (excludes pinned notes).
#[tauri::command]
pub async fn get_recent_notes(window: tauri::Window) -> Result<Vec<NoteCard>, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let config = config::load_config()?;
    let state = workspace_state::load(&vault_path)?;

    Ok(config
        .recents
        .iter()
        .filter(|p| !state.pinned.contains(p))
        .filter_map(|p| vault::note_card(&vault_path, p, false))
        .collect())
}

/// Pin a note. The pin is stored in app state; the file is not touched.
#[tauri::command]
pub async fn pin_note(window: tauri::Window, path: String) -> Result<(), AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    if !vault_path.join(&path).exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }
    workspace_state::pin(&vault_path, &path)?;
    Ok(())
}

/// Unpin a note.
#[tauri::command]
pub async fn unpin_note(window: tauri::Window, path: String) -> Result<(), AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    workspace_state::unpin(&vault_path, &path)?;
    Ok(())
}

/// Retrieve all notes in a specific folder (or the root) as NoteCards.
#[tauri::command]
pub async fn get_notes_in_folder(window: tauri::Window, folder: Option<String>) -> Result<Vec<NoteCard>, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let target_dir = match &folder {
        Some(f) => vault_path.join(f),
        None => vault_path.clone(),
    };

    if !target_dir.exists() {
        return Ok(vec![]);
    }

    let state = workspace_state::load(&vault_path)?;
    let mut cards = Vec::new();

    for entry in fs::read_dir(&target_dir)? {
        let path = entry?.path();
        if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
            let relative = relative_of(&vault_path, &path);
            let pinned = state.pinned.contains(&relative);
            if let Some(card) = vault::note_card(&vault_path, &relative, pinned) {
                cards.push(card);
            }
        }
    }

    cards.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(cards)
}

/// Record that a note was opened, updating the local recents list.
#[tauri::command]
pub async fn record_note_opened(path: String) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    config::record_opened(&mut cfg, &path);
    config::save_config(&cfg)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_body_keeps_frontmatter_and_skips_noop() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("n.md");
        let original = "---
# c
title:  'T'
zeta: 1
---

body
";
        fs::write(&file, original).unwrap();

        let (_, body) = vault::parse_frontmatter(original);
        assert_eq!(write_body(&file, &body).unwrap(), false);
        assert_eq!(fs::read_to_string(&file).unwrap(), original);

        assert_eq!(write_body(&file, "
changed
").unwrap(), true);
        assert_eq!(
            fs::read_to_string(&file).unwrap(),
            "---\n# c\ntitle:  'T'\nzeta: 1\n---\n\nchanged\n".replace("\n", "\n")
        );
    }

    #[test]
    fn write_body_does_not_add_frontmatter() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("n.md");
        fs::write(&file, "plain\n").unwrap();
        write_body(&file, "edited\n").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "edited\n");
    }

    #[test]
    fn rename_edits_title_where_it_lives() {
        let dir = tempfile::tempdir().unwrap();
        let cfg = tempfile::tempdir().unwrap();
        std::env::set_var("GLADE_CONFIG_DIR", cfg.path());
        let root = dir.path();

        fs::write(root.join("a.md"), "---\ntitle: Metadata\nx: 1\n---\n# Old\n\nbody\n").unwrap();
        assert_eq!(rename_at(root, "a.md", "New").unwrap(), "a.md");
        assert_eq!(fs::read_to_string(root.join("a.md")).unwrap(), "---\ntitle: Metadata\nx: 1\n---\n# New\n\nbody\n");

        fs::write(root.join("b.md"), "# Old\n\ntext\n").unwrap();
        assert_eq!(rename_at(root, "b.md", "New").unwrap(), "b.md");
        assert_eq!(fs::read_to_string(root.join("b.md")).unwrap(), "# New\n\ntext\n");

        // Title from the file name: the file is renamed, content untouched, pin follows.
        fs::write(root.join("c.md"), "no heading\n").unwrap();
        workspace_state::pin(root, "c.md").unwrap();
        assert_eq!(rename_at(root, "c.md", "Fresh / name").unwrap(), "Fresh - name.md");
        assert!(!root.join("c.md").exists());
        assert_eq!(fs::read_to_string(root.join("Fresh - name.md")).unwrap(), "no heading\n");
        assert_eq!(workspace_state::load(root).unwrap().pinned, vec!["Fresh - name.md"]);

        // Pinning never touches the file.
        let before = fs::read(root.join("a.md")).unwrap();
        workspace_state::pin(root, "a.md").unwrap();
        assert_eq!(fs::read(root.join("a.md")).unwrap(), before);
    }

    #[test]
    fn rename_keeps_the_extension() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        for (file, renamed) in [("a.mdx", "New.mdx"), ("b.markdown", "New.markdown"), ("c.MD", "New.MD")] {
            fs::write(root.join(file), "no heading\n").unwrap();
            assert_eq!(rename_at(root, file, "New").unwrap(), renamed);
        }
        // A taken name is numbered per extension.
        fs::write(root.join("d.mdx"), "no heading\n").unwrap();
        assert_eq!(rename_at(root, "d.mdx", "New").unwrap(), "New 1.mdx");
        assert_eq!(unique_stem(root, "New", "mdx", None, true), "New (copy)");
    }

    #[test]
    fn rename_of_an_absolute_path_stays_absolute() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("loose.md");
        fs::write(&file, "x\n").unwrap();
        let renamed = rename_at(dir.path(), file.to_str().unwrap(), "Named").unwrap();
        assert_eq!(renamed, dir.path().join("Named.md").to_string_lossy());
    }

    #[test]
    fn saving_never_brings_back_a_file_that_is_gone() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("old-folder/n.md");
        assert!(matches!(write_body(&file, "body\n"), Err(AppError::NotFound(_))));
        assert!(!file.parent().unwrap().exists());
        // "Save again" is the explicit way to.
        assert!(write_body_checked(&file, "body\n", true).unwrap());
    }

    #[test]
    fn note_data_uses_fs_times_and_derived_title() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("setup.md");
        let content = "---\ncreated: 1999-01-01\n---\n# Getting set up\n";
        fs::write(&file, content).unwrap();
        let mtime: chrono::DateTime<chrono::Utc> = fs::metadata(&file).unwrap().modified().unwrap().into();

        let data = note_data("setup.md".into(), &file, content);
        assert_eq!(data.title, "Getting set up");
        assert_eq!(data.updated.as_deref(), Some(mtime.to_rfc3339().as_str()));
        assert_ne!(data.created.as_deref(), Some("1999-01-01"));
        assert_eq!(data.id, "setup.md");
    }

    #[test]
    fn property_edits_touch_only_their_lines() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("n.md");
        fs::write(&file, "---\n# c\nstatus: draft\nz: 1\n---\nbody\n").unwrap();

        edit_frontmatter(&file, |c| frontmatter::set_key(c, "status", &frontmatter::NewValue::Scalar("done".into()))).unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "---\n# c\nstatus: done\nz: 1\n---\nbody\n");

        let out = edit_frontmatter(&file, |c| frontmatter::remove_key(c, "status")).unwrap();
        assert_eq!(out, "---\n# c\nz: 1\n---\nbody\n");

        // A file without frontmatter only gains it on an explicit add.
        let plain = dir.path().join("p.md");
        fs::write(&plain, "body\n").unwrap();
        edit_frontmatter(&plain, |c| frontmatter::set_key(c, "status", &frontmatter::NewValue::Scalar("draft".into()))).unwrap();
        assert_eq!(fs::read_to_string(&plain).unwrap(), "---\nstatus: draft\n---\nbody\n");
        edit_frontmatter(&plain, |c| frontmatter::remove_key(c, "status")).unwrap();
        assert_eq!(fs::read_to_string(&plain).unwrap(), "body\n");

        // Invalid YAML is refused and left alone.
        let bad = dir.path().join("b.md");
        fs::write(&bad, "---\ntitle: \"x\n---\nbody\n").unwrap();
        assert!(edit_frontmatter(&bad, |c| frontmatter::set_key(c, "a", &frontmatter::NewValue::Scalar("1".into()))).is_err());
        assert_eq!(fs::read_to_string(&bad).unwrap(), "---\ntitle: \"x\n---\nbody\n");
    }

    #[test]
    fn write_refuses_to_overwrite_external_changes_unless_forced() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("n.md");
        crate::watch::write_file(&file, "original\n").unwrap();

        // Someone else edits the file.
        fs::write(&file, "external edit\n").unwrap();
        assert!(matches!(write_body(&file, "mine\n"), Err(AppError::Conflict(_))));
        assert_eq!(fs::read_to_string(&file).unwrap(), "external edit\n");

        // "Keep mine".
        assert!(write_body_checked(&file, "mine\n", true).unwrap());
        assert_eq!(fs::read_to_string(&file).unwrap(), "mine\n");
        // And normal saves work again afterwards.
        assert!(write_body(&file, "mine too\n").unwrap());
    }
}
