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

/// The tag list after renaming `from` to `to`. Merges when `to` is already
/// there. `None` when the note doesn't carry `from`.
fn renamed_tags(tags: &[String], from: &str, to: &str) -> Option<Vec<String>> {
    if !tags.iter().any(|t| t == from) {
        return None;
    }
    let mut out: Vec<String> = Vec::with_capacity(tags.len());
    for t in tags {
        let t = if t == from { to } else { t.as_str() };
        if !out.iter().any(|o| o == t) {
            out.push(t.to_string());
        }
    }
    Some(out)
}

/// Rename a tag in every note that has it. Giving it the name of an existing
/// tag merges the two. Returns the notes that changed.
#[tauri::command]
pub async fn rename_tag(window: tauri::Window, from: String, to: String) -> Result<Vec<String>, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let to = to.trim().trim_start_matches('#').trim().to_string();
    if to.is_empty() || to.contains(',') || to.contains('\n') {
        return Err(AppError::InvalidPath("Tag names can't be empty or contain commas".into()));
    }
    if to == from {
        return Ok(Vec::new());
    }

    let mut changed = Vec::new();
    let candidates = vault::walk_notes(&vault_path, |path, relative, meta, _body| {
        meta.tags.iter().any(|t| t == &from).then(|| (path.to_path_buf(), relative.to_string()))
    })?;
    for (full_path, relative) in candidates {
        let content = fs::read_to_string(&full_path)?;
        let Some(tags) = renamed_tags(&frontmatter::get_tags(&content), &from, &to) else {
            continue;
        };
        let updated = frontmatter::set_tags(&content, &tags)
            .map_err(|e| AppError::InvalidPath(format!("Cannot update tags in {}: {}", relative, e)))?;
        if updated != content {
            crate::watch::write_file(&full_path, updated)?;
            changed.push(relative);
        }
    }

    vault::invalidate_vault_cache();
    Ok(changed)
}

#[cfg(test)]
mod tests {
    use super::renamed_tags;

    fn v(items: &[&str]) -> Vec<String> {
        items.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn renames_in_place() {
        assert_eq!(renamed_tags(&v(&["a", "b"]), "a", "c"), Some(v(&["c", "b"])));
    }

    #[test]
    fn merges_into_an_existing_tag() {
        assert_eq!(renamed_tags(&v(&["a", "b"]), "a", "b"), Some(v(&["b"])));
        assert_eq!(renamed_tags(&v(&["b", "a"]), "a", "b"), Some(v(&["b"])));
    }

    #[test]
    fn skips_notes_without_the_tag() {
        assert_eq!(renamed_tags(&v(&["b"]), "a", "c"), None);
    }
}
