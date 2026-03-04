use std::fs;

use chrono::Utc;

use crate::error::AppError;
use crate::types::{NoteData, NoteMeta, TagCount, VaultEntry};
use crate::vault;

/// List all files and folders in the vault as a recursive tree.
#[tauri::command]
pub async fn list_vault() -> Result<Vec<VaultEntry>, AppError> {
    let vault_path = vault::get_vault_path()?;
    vault::build_vault_tree(&vault_path)
}

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

    let title = meta.title.unwrap_or(filename);
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

/// Delete a file or directory from the vault.
#[tauri::command]
pub async fn delete_entry(path: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Entry not found: {}", path)));
    }

    if full_path.is_dir() {
        fs::remove_dir_all(&full_path)?;
    } else {
        fs::remove_file(&full_path)?;
    }

    Ok(())
}

/// Create a new folder inside the vault.
#[tauri::command]
pub async fn create_folder(path: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if full_path.exists() {
        return Err(AppError::InvalidPath(format!(
            "Folder already exists: {}",
            path
        )));
    }

    fs::create_dir_all(&full_path)?;
    Ok(())
}

/// Search notes by query string (case-insensitive, matches title and body).
#[tauri::command]
pub async fn search_notes(query: String) -> Result<Vec<NoteData>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    collect_notes_recursive(&vault_path, &vault_path, &query_lower, &mut results)?;

    // Sort by relevance: title matches first, then by modified date
    results.sort_by(|a, b| {
        let a_title_match = a.title.to_lowercase().contains(&query_lower);
        let b_title_match = b.title.to_lowercase().contains(&query_lower);
        match (a_title_match, b_title_match) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => b.updated.cmp(&a.updated),
        }
    });

    Ok(results)
}

/// Recursively collect notes matching a search query.
fn collect_notes_recursive(
    root: &std::path::Path,
    dir: &std::path::Path,
    query: &str,
    results: &mut Vec<NoteData>,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_notes_recursive(root, &path, query, results)?;
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path)?;
            let (meta, body) = vault::parse_frontmatter(&content);

            let filename = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let title = meta.title.clone().unwrap_or_else(|| filename.clone());

            // Check if query matches title, body, or tags
            let matches = title.to_lowercase().contains(query)
                || body.to_lowercase().contains(query)
                || meta.tags.iter().any(|t| t.to_lowercase().contains(query));

            if matches {
                let relative = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();

                results.push(NoteData {
                    path: relative,
                    title,
                    tags: meta.tags,
                    created: meta.created,
                    updated: meta.updated,
                    preview: vault::make_preview(&body),
                    body,
                });
            }
        }
    }
    Ok(())
}

/// List all unique tags across all notes with their counts.
#[tauri::command]
pub async fn list_tags() -> Result<Vec<TagCount>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let mut tag_map: std::collections::HashMap<String, u32> = std::collections::HashMap::new();

    collect_tags_recursive(&vault_path, &mut tag_map)?;

    let mut tags: Vec<TagCount> = tag_map
        .into_iter()
        .map(|(name, count)| TagCount { name, count })
        .collect();

    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}

/// Recursively collect tags from all .md files.
fn collect_tags_recursive(
    dir: &std::path::Path,
    tag_map: &mut std::collections::HashMap<String, u32>,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_tags_recursive(&path, tag_map)?;
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path)?;
            let (meta, _) = vault::parse_frontmatter(&content);
            for tag in meta.tags {
                *tag_map.entry(tag).or_insert(0) += 1;
            }
        }
    }
    Ok(())
}

/// Update the tags for a specific note.
#[tauri::command]
pub async fn update_tags(path: String, tags: Vec<String>) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);

    meta.tags = tags;
    meta.updated = Some(Utc::now().to_rfc3339());

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, body);
    fs::write(&full_path, full_content)?;

    Ok(())
}

