//! Opening, pinning and forgetting folders and files. None of these touch the
//! contents of a user's folder.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use crate::config;
use crate::error::AppError;
use crate::workspace_state;

#[derive(Debug, Serialize)]
pub struct HomeEntry {
    pub path: String,
    pub name: String,
    /// False when the path no longer exists on disk.
    pub exists: bool,
}

#[derive(Debug, Serialize)]
pub struct HomeData {
    pub pinned_folders: Vec<HomeEntry>,
    pub recent_folders: Vec<HomeEntry>,
    pub recent_files: Vec<HomeEntry>,
}

fn entry(path: &str) -> HomeEntry {
    let p = Path::new(path);
    HomeEntry {
        path: path.to_string(),
        name: p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string()),
        exists: p.exists(),
    }
}

/// Build Home's lists. A folder that is pinned is not repeated under recents.
pub fn home_data(cfg: &crate::types::AppConfig) -> HomeData {
    HomeData {
        pinned_folders: cfg.pinned_folders.iter().map(|p| entry(p)).collect(),
        recent_folders: cfg
            .recent_folders
            .iter()
            .filter(|p| !cfg.pinned_folders.contains(p))
            .map(|p| entry(p))
            .collect(),
        recent_files: cfg.recent_files.iter().map(|p| entry(p)).collect(),
    }
}

fn canonical_dir(path: &str) -> Result<PathBuf, AppError> {
    let p = fs::canonicalize(path)
        .map_err(|_| AppError::NotFound(format!("Folder not found: {}", path)))?;
    if !p.is_dir() {
        return Err(AppError::InvalidPath(format!("Not a folder: {}", path)));
    }
    Ok(p)
}

/// Record a loose file as recently opened.
#[tauri::command]
pub async fn record_file_opened(path: String) -> Result<(), AppError> {
    let abs = fs::canonicalize(&path)
        .map_err(|_| AppError::NotFound(format!("File not found: {}", path)))?;
    let mut cfg = config::load_config()?;
    config::push_recent(&mut cfg.recent_files, &abs.to_string_lossy());
    config::save_config(&cfg)?;
    Ok(())
}

#[tauri::command]
pub async fn get_home_data() -> Result<HomeData, AppError> {
    Ok(home_data(&config::load_config()?))
}

#[tauri::command]
pub async fn pin_folder(path: String) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    if !cfg.pinned_folders.contains(&path) {
        cfg.pinned_folders.push(path);
    }
    config::save_config(&cfg)
}

#[tauri::command]
pub async fn unpin_folder(path: String) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    cfg.pinned_folders.retain(|p| p != &path);
    config::save_config(&cfg)
}

/// Forget a folder or file: removes it from every list and discards its saved
/// state. Never touches the disk contents.
#[tauri::command]
pub async fn remove_from_glade(path: String) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    cfg.pinned_folders.retain(|p| p != &path);
    cfg.recent_folders.retain(|p| p != &path);
    cfg.recent_files.retain(|p| p != &path);
    config::save_config(&cfg)?;
    workspace_state::discard_in(&config::get_config_dir()?, Path::new(&path))
}

/// Point an entry whose folder moved at its new location, keeping its saved state.
#[tauri::command]
pub async fn locate_folder(old_path: String, new_path: String) -> Result<String, AppError> {
    let new_root = canonical_dir(&new_path)?;
    let new_str = new_root.to_string_lossy().to_string();

    let mut cfg = config::load_config()?;
    for list in [&mut cfg.pinned_folders, &mut cfg.recent_folders] {
        for p in list.iter_mut() {
            if *p == old_path {
                *p = new_str.clone();
            }
        }
        list.dedup();
    }
    config::save_config(&cfg)?;
    workspace_state::move_state_in(&config::get_config_dir()?, Path::new(&old_path), &new_root)?;
    Ok(new_str)
}

/// Whether this window's folder still holds keys older Glade versions wrote.
#[tauri::command]
pub async fn legacy_cleanup_pending(window: tauri::Window) -> Result<bool, AppError> {
    let root = crate::workspace::root_for(&window)?;
    let cfg = config::load_config()?;
    Ok(cfg.legacy_cleanup_roots.contains(&root.to_string_lossy().to_string()))
}

fn clear_pending(root: &Path) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    let key = root.to_string_lossy().to_string();
    cfg.legacy_cleanup_roots.retain(|r| r != &key);
    config::save_config(&cfg)
}

/// Remove legacy `id`/`pinned` keys from this folder's notes (user accepted).
#[tauri::command]
pub async fn cleanup_legacy(window: tauri::Window) -> Result<usize, AppError> {
    let root = crate::workspace::root_for(&window)?;
    let changed = crate::migration::cleanup_legacy_keys(&root)?;
    clear_pending(&root)?;
    crate::vault::invalidate_vault_cache();
    Ok(changed)
}

/// The user declined the cleanup; don't ask again for this folder.
#[tauri::command]
pub async fn dismiss_legacy_cleanup(window: tauri::Window) -> Result<(), AppError> {
    clear_pending(&crate::workspace::root_for(&window)?)
}

/// Nearest ancestor of `path` that contains `.git` (directory or file).
pub fn find_repo_root(path: &Path) -> Option<PathBuf> {
    path.ancestors()
        .skip(1)
        .find(|a| a.join(".git").exists())
        .map(Path::to_path_buf)
}

#[tauri::command]
pub async fn repo_root_of(path: String) -> Result<Option<String>, AppError> {
    Ok(find_repo_root(Path::new(&path)).map(|p| p.to_string_lossy().to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::AppConfig;

    #[test]
    fn finds_repository_root() {
        let dir = tempfile::tempdir().unwrap();
        let nested = dir.path().join("a/b");
        fs::create_dir_all(&nested).unwrap();
        fs::create_dir_all(dir.path().join(".git")).unwrap();
        fs::write(nested.join("n.md"), "x").unwrap();
        assert_eq!(find_repo_root(&nested.join("n.md")).as_deref(), Some(dir.path()));
        let other = tempfile::tempdir().unwrap();
        fs::write(other.path().join("n.md"), "x").unwrap();
        assert!(find_repo_root(&other.path().join("n.md")).map_or(true, |p| p != other.path()));
    }

    #[test]
    fn pinned_folders_are_not_repeated_in_recents() {
        let cfg = AppConfig {
            pinned_folders: vec!["/a".into()],
            recent_folders: vec!["/a".into(), "/b".into()],
            ..Default::default()
        };
        let home = home_data(&cfg);
        assert_eq!(home.pinned_folders.len(), 1);
        assert_eq!(home.recent_folders.len(), 1);
        assert_eq!(home.recent_folders[0].path, "/b");
        assert!(!home.recent_folders[0].exists);
    }
}
