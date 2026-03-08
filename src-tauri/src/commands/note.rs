use std::fs;
use chrono::Utc;
use crate::config;
use crate::error::AppError;
use crate::types::{NoteCard, NoteData, NoteMeta};
use crate::vault;

/// Read a note file and return its parsed data.
#[tauri::command]
pub async fn read_note(path: String) -> Result<NoteData, AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (meta, body) = vault::parse_frontmatter(&content);

    let filename = full_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".into());

    let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
    let preview = vault::make_preview(&body);

    Ok(NoteData {
        path,
        title,
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        body,
        preview,
    })
}

/// Write content to a note, updating the `updated` timestamp in frontmatter.
#[tauri::command]
pub async fn write_note(path: String, content: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    // Parse existing frontmatter to preserve metadata
    let existing = if full_path.exists() {
        fs::read_to_string(&full_path)?
    } else {
        String::new()
    };

    let (mut meta, _) = vault::parse_frontmatter(&existing);
    meta.updated = Some(Utc::now().to_rfc3339());

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, content);

    // Ensure parent directory exists
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(&full_path, full_content)?;
    Ok(())
}

/// Create a new note in the given folder (or vault root).
#[tauri::command]
pub async fn create_note(folder: Option<String>) -> Result<NoteData, AppError> {
    let vault_path = vault::get_vault_path()?;

    let target_dir = match &folder {
        Some(f) => vault_path.join(f),
        None => vault_path.clone(),
    };

    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)?;
    }

    // Find a unique filename
    let mut filename = "Untitled.md".to_string();
    let mut counter = 1;
    while target_dir.join(&filename).exists() {
        filename = format!("Untitled {}.md", counter);
        counter += 1;
    }

    let now = Utc::now().to_rfc3339();
    let meta = NoteMeta {
        title: Some("Untitled".into()),
        tags: vec![],
        created: Some(now.clone()),
        updated: Some(now),
        pinned: false,
    };

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n", frontmatter);

    let full_path = target_dir.join(&filename);
    fs::write(&full_path, &full_content)?;

    let relative_path = full_path
        .strip_prefix(&vault_path)
        .unwrap_or(&full_path)
        .to_string_lossy()
        .to_string();

    Ok(NoteData {
        path: relative_path,
        title: meta.title.unwrap_or_else(|| "Untitled".into()),
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        body: String::new(),
        preview: String::new(),
    })
}

/// Rename a note by updating its title in the frontmatter.
#[tauri::command]
pub async fn rename_note(path: String, new_title: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);

    meta.title = Some(new_title);
    meta.updated = Some(Utc::now().to_rfc3339());

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, body);
    fs::write(&full_path, full_content)?;

    Ok(())
}

/// Duplicate a note, creating a copy of it with " (copy)" appended to its title.
#[tauri::command]
pub async fn duplicate_note(path: String) -> Result<NoteData, AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);

    let curr_title = meta.title.clone().unwrap_or_else(|| {
        full_path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default()
    });
    meta.title = Some(format!("{} (copy)", curr_title));
    
    let parent = full_path.parent().unwrap_or(&vault_path);
    let stem = full_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = full_path.extension().unwrap_or_default().to_string_lossy().to_string();
    
    let mut new_filename = format!("{} copy.{}", stem, ext);
    if ext.is_empty() {
        new_filename = format!("{} copy", stem);
    }
    
    let mut counter = 1;
    while parent.join(&new_filename).exists() {
        if ext.is_empty() {
            new_filename = format!("{} copy {}", stem, counter);
        } else {
            new_filename = format!("{} copy {}.{}", stem, counter, ext);
        }
        counter += 1;
    }
    
    let new_full_path = parent.join(&new_filename);
    
    let now = Utc::now().to_rfc3339();
    meta.created = Some(now.clone());
    meta.updated = Some(now.clone());
    
    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, body);
    fs::write(&new_full_path, &full_content)?;
    
    let relative_path = new_full_path.strip_prefix(&vault_path).unwrap_or(&new_full_path).to_string_lossy().to_string();
    
    Ok(NoteData {
        path: relative_path,
        title: meta.title.unwrap(),
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        preview: vault::make_preview(&body),
        body,
    })
}

/// Retrieve all pinned notes as NoteCards (scans the whole vault).
#[tauri::command]
pub async fn get_pinned_notes() -> Result<Vec<NoteCard>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let mut cards = Vec::new();
    collect_note_cards_recursive(&vault_path, &vault_path, &mut cards, |m| m.pinned)?;
    cards.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(cards)
}

/// Retrieve up to 12 recently-opened notes as NoteCards (excludes pinned notes).
#[tauri::command]
pub async fn get_recent_notes() -> Result<Vec<NoteCard>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let config = config::load_config()?;
    let mut cards = Vec::new();

    for entry in &config.recents {
        let full_path = vault_path.join(&entry.path);
        if !full_path.exists() {
            continue;
        }
        let content = fs::read_to_string(&full_path)?;
        let (meta, body) = vault::parse_frontmatter(&content);

        if meta.pinned {
            continue;
        }

        let filename = full_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
        let fs_meta = fs::metadata(&full_path)?;
        let modified = fs_meta.modified().ok().and_then(|t| {
            let dt: chrono::DateTime<Utc> = t.into();
            Some(dt.to_rfc3339())
        });

        cards.push(NoteCard {
            path: entry.path.clone(),
            title,
            tags: meta.tags,
            modified,
            preview: vault::make_preview(&body),
            pinned: false,
        });
    }

    Ok(cards)
}

/// Pin a note by setting `pinned: true` in its frontmatter.
#[tauri::command]
pub async fn pin_note(path: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);
    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }
    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);
    meta.pinned = true;
    let frontmatter = vault::build_frontmatter(&meta);
    fs::write(&full_path, format!("{}\n\n{}", frontmatter, body))?;
    Ok(())
}

/// Unpin a note by removing the `pinned` flag from its frontmatter.
#[tauri::command]
pub async fn unpin_note(path: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);
    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }
    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);
    meta.pinned = false;
    let frontmatter = vault::build_frontmatter(&meta);
    fs::write(&full_path, format!("{}\n\n{}", frontmatter, body))?;
    Ok(())
}

/// Record that a note was opened, updating the local recents list.
#[tauri::command]
pub async fn record_note_opened(path: String) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    config::record_opened(&mut cfg, &path);
    config::save_config(&cfg)?;
    Ok(())
}

pub fn collect_note_cards_recursive(
    root: &std::path::Path,
    dir: &std::path::Path,
    cards: &mut Vec<NoteCard>,
    predicate: impl Fn(&NoteMeta) -> bool + Copy,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_note_cards_recursive(root, &path, cards, predicate)?;
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path)?;
            let (meta, body) = vault::parse_frontmatter(&content);

            if predicate(&meta) {
                let filename = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
                let relative = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                let fs_meta = fs::metadata(&path)?;
                let modified = fs_meta.modified().ok().and_then(|t| {
                    let dt: chrono::DateTime<Utc> = t.into();
                    Some(dt.to_rfc3339())
                });

                cards.push(NoteCard {
                    path: relative,
                    title,
                    tags: meta.tags,
                    modified,
                    preview: vault::make_preview(&body),
                    pinned: meta.pinned,
                });
            }
        }
    }
    Ok(())
}
