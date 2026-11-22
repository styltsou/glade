use std::fs;
use std::path::Path;
use crate::config;
use crate::error::AppError;
use crate::types::{AppConfig, VaultEntry};
use crate::vault;
use crate::workspace_state;

/// List all files and folders in the vault as a recursive tree.
#[tauri::command]
pub async fn list_vault(window: tauri::Window) -> Result<Vec<VaultEntry>, AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    vault::build_vault_tree(&vault_path)
}

/// Delete a file or directory from the vault.
#[tauri::command]
pub async fn delete_entry(window: tauri::Window, path: String) -> Result<(), AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let full_path = crate::workspace::resolve_inside(&vault_path, &path)?;

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Entry not found: {}", path)));
    }

    // Move to the system trash so deletions can be undone from the OS.
    trash::delete(&full_path)
        .map_err(|e| AppError::Internal(format!("Could not move to trash: {}", e)))?;
    workspace_state::forget_path(&vault_path, &path)?;

    // Invalidate vault tree cache
    vault::invalidate_vault_cache();

    Ok(())
}

/// Create a new folder inside the vault.
#[tauri::command]
pub async fn create_folder(window: tauri::Window, path: String) -> Result<(), AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    let full_path = crate::workspace::resolve_inside(&vault_path, &path)?;

    if full_path.exists() {
        return Err(AppError::InvalidPath(format!(
            "Folder already exists: {}",
            path
        )));
    }

    fs::create_dir_all(&full_path)?;
    
    // Invalidate vault tree cache
    vault::invalidate_vault_cache();
    
    Ok(())
}

/// Rename a folder inside the vault.
#[tauri::command]
pub async fn rename_folder(window: tauri::Window, path: String, new_name: String) -> Result<String, AppError> {
    let new_name = new_name.trim();
    
    if new_name.is_empty() {
        return Err(AppError::InvalidPath("Folder name cannot be empty".into()));
    }
    
    if new_name.contains('/') || new_name.contains('\\') {
        return Err(AppError::InvalidPath(format!(
            "Folder name cannot contain path separators: {}", new_name
        )));
    }

    let vault_path = crate::workspace::root_for(&window)?;
    let full_path = crate::workspace::resolve_inside(&vault_path, &path)?;

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Folder not found: {}", path)));
    }

    if !full_path.is_dir() {
        return Err(AppError::InvalidPath(format!("Path is not a folder: {}", path)));
    }

    let parent = full_path.parent().unwrap_or(&vault_path);
    let new_full_path = parent.join(new_name);

    let new_rel = new_full_path
        .strip_prefix(&vault_path)
        .unwrap_or(&new_full_path)
        .to_string_lossy()
        .to_string();
    move_at(&vault_path, &path, &new_rel)?;

    vault::invalidate_vault_cache();
    
    Ok(new_rel)
}

/// Move or rename a file or folder inside `root`, never replacing anything.
/// Moved notes keep pointing at the same targets from where they are now.
fn move_at(root: &Path, from: &str, to: &str) -> Result<(), AppError> {
    let full_from = crate::workspace::resolve_inside(root, from)?;
    let full_to = crate::workspace::resolve_inside(root, to)?;

    if !full_from.exists() {
        return Err(AppError::NotFound(format!("Entry not found: {}", from)));
    }

    // Ensure parent of destination exists
    if let Some(parent) = full_to.parent() {
        if !parent.exists() {
            fs::create_dir_all(parent)?;
        }
    }

    crate::relocate::rename_no_replace(&full_from, &full_to)?;

    // The move has happened: report it as done whatever follows, or the window
    // would go on saving to the old path.
    if let Err(e) = workspace_state::rename_path(root, from, to) {
        eprintln!("glade: could not update pins after moving {from}: {e}");
    }
    if let Err(e) = crate::links::rewrite_moved(root, &full_from, &full_to) {
        eprintln!("glade: could not update links after moving {from}: {e}");
    }
    Ok(())
}

/// Move a file or directory to a new location in the vault.
#[tauri::command]
pub async fn move_entry(window: tauri::Window, from_path: String, to_path: String) -> Result<(), AppError> {
    let vault_path = crate::workspace::root_for(&window)?;
    move_at(&vault_path, &from_path, &to_path)?;

    // Invalidate vault tree cache
    vault::invalidate_vault_cache();
    
    Ok(())
}

/// One-time upgrade from app-owned vaults; afterwards just returns the config.
#[tauri::command]
pub async fn initialize_app() -> Result<AppConfig, AppError> {
    let mut config = config::load_config()?;
    if config.schema_version < crate::migration::SCHEMA_VERSION {
        if !config.vaults.is_empty() {
            let vaults_root = vault::get_vaults_root()?;
            crate::migration::migrate(&mut config, &vaults_root, &config::get_config_dir()?)?;
        } else {
            config.schema_version = crate::migration::SCHEMA_VERSION;
        }
        config::save_config(&config)?;
    }
    Ok(config)
}
