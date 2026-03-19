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
    let (mut meta, body) = vault::parse_frontmatter(&content);

    // Ensure note has a stable ID
    let mut id_assigned = false;
    if meta.id.is_none() {
        meta.id = Some(uuid::Uuid::new_v4().to_string());
        id_assigned = true;
    }
    
    let note_id = meta.id.clone().unwrap();

    if id_assigned {
        let frontmatter = vault::build_frontmatter(&meta);
        let full_content = format!("{}\n\n{}", frontmatter, body);
        fs::write(&full_path, full_content)?;
    }

    let filename = full_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".into());

    let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
    let preview = vault::make_preview(&body);

    Ok(NoteData {
        id: note_id,
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
    
    // Preserve or generate ID
    if meta.id.is_none() {
        meta.id = Some(uuid::Uuid::new_v4().to_string());
    }
    
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

fn find_unique_title(dir: &std::path::Path, base_title: &str, is_copy: bool) -> Result<String, AppError> {
    let mut titles_in_dir = std::collections::HashSet::new();
    
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|e| e.to_str()).map_or(false, |e| e == "md") {
                if let Ok(content) = fs::read_to_string(&path) {
                    let (meta, _) = vault::parse_frontmatter(&content);
                    if let Some(title) = meta.title {
                        titles_in_dir.insert(title);
                    }
                }
            }
        }
    }
    
    if !titles_in_dir.contains(base_title) {
        return Ok(base_title.to_string());
    }
    
    let without_copy = if is_copy {
        base_title.strip_suffix(" (copy)").map(|s| s.trim()).unwrap_or(base_title).to_string()
    } else {
        base_title.to_string()
    };
    
    let mut counter = if is_copy { 2 } else { 2 };
    loop {
        let candidate = if is_copy {
            format!("{} (copy) {}", without_copy, counter)
        } else {
            format!("{} {}", without_copy, counter)
        };
        
        if !titles_in_dir.contains(&candidate) {
            return Ok(candidate);
        }
        counter += 1;
    }
}

fn slugify(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c.to_ascii_lowercase()
            } else if c.is_whitespace() {
                '-'
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
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

    let unique_title = find_unique_title(&target_dir, "Untitled", false)?;
    
    let base_slug = slugify(&unique_title);
    let mut filename = format!("{}.md", base_slug);
    let mut counter = 1;
    while target_dir.join(&filename).exists() {
        filename = format!("{} {}.md", base_slug, counter);
        counter += 1;
    }

    let now = Utc::now().to_rfc3339();
    let meta = NoteMeta {
        id: Some(uuid::Uuid::new_v4().to_string()),
        title: Some(unique_title),
        tags: vec![],
        created: Some(now.clone()),
        updated: Some(now),
        pinned: false,
        extra: std::collections::HashMap::new(),
    };

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n", frontmatter);

    let full_path = target_dir.join(&filename);
    fs::write(&full_path, &full_content)?;

    // Invalidate vault tree cache since we added a new note
    vault::invalidate_vault_cache();

    let relative_path = full_path
        .strip_prefix(&vault_path)
        .unwrap_or(&full_path)
        .to_string_lossy()
        .to_string();

    Ok(NoteData {
        id: meta.id.unwrap(),
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

    let parent = full_path.parent().unwrap_or(&vault_path);
    let unique_title = find_unique_title(parent, &new_title, false)?;
    meta.title = Some(unique_title);
    meta.updated = Some(Utc::now().to_rfc3339());

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, body);
    fs::write(&full_path, full_content)?;

    // Invalidate vault tree cache since title changed
    vault::invalidate_vault_cache();

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
    
    let parent = full_path.parent().unwrap_or(&vault_path);
    let unique_title = find_unique_title(parent, &curr_title, true)?;
    meta.title = Some(unique_title);
    
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
    
    // Invalidate vault tree cache since we added a new note
    vault::invalidate_vault_cache();
    
    let relative_path = new_full_path.strip_prefix(&vault_path).unwrap_or(&new_full_path).to_string_lossy().to_string();
    
    Ok(NoteData {
        id: meta.id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
        path: relative_path,
        title: meta.title.unwrap(),
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        preview: vault::make_preview(&body),
        body,
    })
}

/// Retrieve all pinned notes as NoteCards (uses cache when available).
#[tauri::command]
pub async fn get_pinned_notes() -> Result<Vec<NoteCard>, AppError> {
    let vault_path = vault::get_vault_path()?;
    vault::get_pinned_notes_cached(&vault_path)
}

/// Retrieve up to 6 recently-opened notes as NoteCards (excludes pinned notes).
#[tauri::command]
pub async fn get_recent_notes() -> Result<Vec<NoteCard>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let config = config::load_config()?;
    let mut cards = Vec::new();

    for path in &config.recents {
        let full_path = vault_path.join(path);
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
            id: meta.id.clone().unwrap_or_else(|| path.clone()),
            path: path.clone(),
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
    
    // Update pinned cache
    let filename = full_path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default();
    let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
    let fs_meta = fs::metadata(&full_path)?;
    let modified = fs_meta.modified().ok().and_then(|t| {
        let dt: chrono::DateTime<Utc> = t.into();
        Some(dt.to_rfc3339())
    });
    let note_card = NoteCard {
        id: meta.id.unwrap_or_else(|| path.clone()),
        path: path.clone(),
        title,
        tags: meta.tags,
        modified,
        preview: vault::make_preview(&body),
        pinned: true,
    };
    vault::update_pinned_cache(&path, true, Some(note_card));
    
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
    let (meta, body) = vault::parse_frontmatter(&content);
    let (mut meta, body) = (meta, body);
    meta.pinned = false;
    let frontmatter = vault::build_frontmatter(&meta);
    fs::write(&full_path, format!("{}\n\n{}", frontmatter, body))?;
    
    // Update pinned cache
    vault::update_pinned_cache(&path, false, None);
    
    Ok(())
}


/// Retrieve all notes in a specific folder (or vault root) as NoteCards.
#[tauri::command]
pub async fn get_notes_in_folder(folder: Option<String>) -> Result<Vec<NoteCard>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let target_dir = match &folder {
        Some(f) => vault_path.join(f),
        None => vault_path.clone(),
    };

    if !target_dir.exists() {
        return Ok(vec![]);
    }

    let mut cards = Vec::new();
    let entries = fs::read_dir(&target_dir)?;

    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        
        if path.is_file() && path.extension().map_or(false, |ext| ext == "md") {
            let content = fs::read_to_string(&path)?;
            let (meta, body) = vault::parse_frontmatter(&content);

            let filename = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();
            let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
            
            let fs_meta = entry.metadata()?;
            let modified = fs_meta.modified().ok().and_then(|t| {
                let dt: chrono::DateTime<Utc> = t.into();
                Some(dt.to_rfc3339())
            });

            let relative_path = path
                .strip_prefix(&vault_path)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();

            cards.push(NoteCard {
                id: meta.id.clone().unwrap_or_else(|| relative_path.clone()),
                path: relative_path,
                title,
                tags: meta.tags,
                modified,
                preview: vault::make_preview(&body),
                pinned: meta.pinned,
            });
        }
    }

    // Sort by modified date (descending) by default
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
