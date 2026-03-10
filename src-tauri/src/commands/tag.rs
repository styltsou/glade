use std::collections::HashMap;
use std::fs;
use chrono::Utc;
use crate::error::AppError;
use crate::types::TagCount;
use crate::vault;

/// List all unique tags across all notes with their counts (uses cache when available).
#[tauri::command]
pub async fn list_tags() -> Result<Vec<TagCount>, AppError> {
    let vault_path = vault::get_vault_path()?;
    
    // Check cache first
    let cached = vault::get_tags_cache(&vault_path);
    if let Some(tags) = cached {
        return Ok(tags);
    }
    
    // Scan and cache
    let mut tag_map: HashMap<String, u32> = HashMap::new();

    vault::walk_notes(&vault_path, &vault_path, |_path, _relative, meta, _body| {
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

    // Invalidate tags cache since tags changed
    vault::invalidate_vault_cache();

    Ok(())
}
