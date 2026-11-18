use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::error::AppError;
use crate::links::{self, LinkInfo};
use crate::vault;
use crate::workspace::{resolve_inside, resolve_markdown, root_for};

/// Classify the links of a note (relative to the note's own directory).
#[tauri::command]
pub async fn classify_links(window: tauri::Window, from: String, hrefs: Vec<String>) -> Result<Vec<LinkInfo>, AppError> {
    let root = root_for(&window)?;
    let from_abs = resolve_markdown(&root, &from)?;
    let base = from_abs.parent().unwrap_or(&root).to_path_buf();
    Ok(hrefs.iter().map(|h| links::classify(&root, &base, h)).collect())
}

/// Create the empty markdown file a broken link points at. A target outside
/// the open folder needs `confirmed` (the UI shows the full path first).
#[tauri::command]
pub async fn create_linked_note(window: tauri::Window, from: String, href: String, confirmed: bool) -> Result<String, AppError> {
    let root = root_for(&window)?;
    let from_abs = resolve_markdown(&root, &from)?;
    let base = from_abs.parent().unwrap_or(&root);
    let target = links::resolve_href(base, &href)
        .filter(|p| vault::is_markdown(p))
        .ok_or_else(|| AppError::InvalidPath(format!("Not a markdown link: {}", href)))?;
    if !target.starts_with(&root) && !confirmed {
        return Err(AppError::InvalidPath("Creating a file outside the open folder needs confirmation".into()));
    }
    if target.exists() {
        return Err(AppError::InvalidPath(format!("Already exists: {}", target.display())));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    crate::watch::write_file(&target, "")?;
    vault::invalidate_vault_cache();
    Ok(target.to_string_lossy().to_string())
}

#[derive(Serialize)]
pub struct DirNote {
    pub name: String,
    pub path: String,
}

/// Markdown files next to a loose file (for its `@` picker).
#[tauri::command]
pub async fn list_dir_markdown(file: String) -> Result<Vec<DirNote>, AppError> {
    let file = Path::new(&file);
    let Some(dir) = file.parent() else { return Ok(vec![]) };
    let mut out = Vec::new();
    for entry in fs::read_dir(dir)?.flatten() {
        let p = entry.path();
        if p != file && p.is_file() && vault::is_markdown(&p) {
            out.push(DirNote {
                name: p.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default(),
                path: p.to_string_lossy().to_string(),
            });
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(out)
}

#[derive(Serialize)]
pub struct Backlink {
    pub path: String,
    pub title: String,
}

/// Notes in the open folder that link to `path`.
#[tauri::command]
pub async fn get_backlinks(window: tauri::Window, path: String) -> Result<Vec<Backlink>, AppError> {
    let root = root_for(&window)?;
    let target = resolve_markdown(&root, &path)?;
    Ok(links::backlinks(&root, &target)?
        .into_iter()
        .map(|rel| {
            let rel_str = rel.to_string_lossy().to_string();
            let title = vault::note_card(&root, &rel_str, false)
                .map(|c| c.title)
                .unwrap_or_else(|| rel_str.clone());
            Backlink { path: rel_str, title }
        })
        .collect())
}

#[derive(Serialize)]
pub struct LinkUpdates {
    pub links: usize,
    pub files: usize,
}

/// How many links elsewhere in the folder point at `from` (a note that was
/// just renamed or moved to `to`).
#[tauri::command]
pub async fn preview_link_updates(window: tauri::Window, from: String, to: String) -> Result<LinkUpdates, AppError> {
    let root = root_for(&window)?;
    let old = links::normalize(&resolve_inside(&root, &from)?);
    let (links, files) = links::inbound_counts(&root, &old)?;
    let _ = to;
    Ok(LinkUpdates { links, files })
}

/// Rewrite those links so they reach `to`.
#[tauri::command]
pub async fn apply_link_updates(window: tauri::Window, from: String, to: String) -> Result<usize, AppError> {
    let root = root_for(&window)?;
    let old = links::normalize(&resolve_inside(&root, &from)?);
    let new = links::normalize(&resolve_inside(&root, &to)?);
    let changed = links::apply_inbound(&root, &old, &new)?;
    vault::invalidate_vault_cache();
    Ok(changed)
}
