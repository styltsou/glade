use std::collections::HashMap;
use std::fs;
use crate::error::AppError;
use crate::types::TagCount;
use crate::frontmatter;
use crate::vault;

/// List all unique tags across all notes with their counts (uses cache when available).
#[tauri::command]
pub async fn list_tags(window: tauri::Window) -> Result<Vec<TagCount>, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    
    // Check cache first
    let cached = vault::get_tags_cache(&vault_path);
    if let Some(tags) = cached {
        return Ok(tags);
    }
    
    // Scan and cache
    let mut tag_map: HashMap<String, u32> = HashMap::new();

    vault::walk_notes(&vault_path, |_path, _relative, meta, _body| {
        for tag in &meta.tags {
            *tag_map.entry(tag.clone()).or_insert(0) += 1;
        }
        None::<()>
    })?;

    let mut tags: Vec<TagCount> = tag_map
        .into_iter()
        .map(|(name, count)| TagCount { name, count })
        .collect();

    tags.sort_by(|a, b| a.name.cmp(&b.name));
    
    // Cache the result
    vault::set_tags_cache(&vault_path, tags.clone());
    
    Ok(tags)
}

/// Update the tags for a specific note.
#[tauri::command]
pub async fn update_tags(window: tauri::Window, path: String, tags: Vec<String>) -> Result<(), AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let full_path = crate::workspace::resolve_markdown(&vault_path, &path)?;

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let updated = frontmatter::set_tags(&content, &tags)
        .map_err(|e| AppError::InvalidPath(format!("Cannot update tags: {}", e)))?;
    if updated != content {
        crate::watch::write_file(&full_path, updated)?;
    }

    // Invalidate tags cache since tags changed
    vault::invalidate_vault_cache();

    Ok(())
}
