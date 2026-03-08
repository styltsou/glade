use std::fs;
use chrono::Utc;
use crate::error::AppError;
use crate::types::TagCount;
use crate::vault;

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
pub fn collect_tags_recursive(
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
