use std::fs;
use chrono::Utc;
use crate::config;
use crate::error::AppError;
use crate::types::{AppConfig, Vault, VaultEntry};
use crate::vault;

/// List all files and folders in the vault as a recursive tree.
#[tauri::command]
pub async fn list_vault() -> Result<Vec<VaultEntry>, AppError> {
    let vault_path = vault::get_vault_path()?;
    vault::build_vault_tree(&vault_path)
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

#[tauri::command]
pub async fn initialize_app() -> Result<AppConfig, AppError> {
    config::load_config()
}

#[tauri::command]
pub async fn list_vaults() -> Result<Vec<Vault>, AppError> {
    let config = config::load_config()?;
    Ok(config.vaults)
}

#[tauri::command]
pub async fn get_active_vault() -> Result<Option<Vault>, AppError> {
    let config = config::load_config()?;
    if let Some(active_id) = config.active_vault_id {
        Ok(config.vaults.into_iter().find(|v| v.id == active_id))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn set_active_vault(vault_id: String) -> Result<(), AppError> {
    let mut config = config::load_config()?;
    if !config.vaults.iter().any(|v| v.id == vault_id) {
        return Err(AppError::NotFound("Vault not found".into()));
    }
    config.active_vault_id = Some(vault_id);
    config::save_config(&config)?;
    Ok(())
}

#[tauri::command]
pub async fn create_vault(name: String, slug: String) -> Result<Vault, AppError> {
    let mut config = config::load_config()?;
    
    if config::vault_exists(&config, &slug) {
        return Err(AppError::InvalidPath("A vault with this name already exists".into()));
    }
    
    let vault = config::create_vault(&name, &slug)?;
    vault::get_vault_dir(&vault.slug)?;
    
    config.vaults.push(vault.clone());
    if config.active_vault_id.is_none() {
        config.active_vault_id = Some(vault.id.clone());
    }
    config::save_config(&config)?;
    
    Ok(vault)
}

#[tauri::command]
pub async fn rename_vault(vault_id: String, name: String, slug: String) -> Result<Vault, AppError> {
    let mut config = config::load_config()?;
    
    let vault_idx = config.vaults.iter().position(|v| v.id == vault_id)
        .ok_or_else(|| AppError::NotFound("Vault not found".into()))?;
    
    let old_slug = config.vaults[vault_idx].slug.clone();
    
    if old_slug != slug && config::vault_exists(&config, &slug) {
        return Err(AppError::InvalidPath("A vault with this name already exists".into()));
    }
    
    let vault_dir = vault::get_vault_dir(&old_slug)?;
    let new_vault_dir = vault::get_vault_dir(&slug)?;
    
    if old_slug != slug {
        fs::rename(&vault_dir, &new_vault_dir)?;
    }
    
    config.vaults[vault_idx].name = name;
    config.vaults[vault_idx].slug = slug;
    let updated_vault = config.vaults[vault_idx].clone();
    
    config::save_config(&config)?;
    
    Ok(updated_vault)
}

#[tauri::command]
pub async fn delete_vault(vault_id: String) -> Result<(), AppError> {
    let mut config = config::load_config()?;
    
    let vault_idx = config.vaults.iter().position(|v| v.id == vault_id)
        .ok_or_else(|| AppError::NotFound("Vault not found".into()))?;
    
    let slug = config.vaults[vault_idx].slug.clone();
    let vault_dir = vault::get_vault_dir(&slug)?;
    
    if vault_dir.exists() {
        fs::remove_dir_all(&vault_dir)?;
    }
    
    config.vaults.remove(vault_idx);
    
    if config.active_vault_id.as_ref() == Some(&vault_id) {
        config.active_vault_id = config.vaults.first().map(|v| v.id.clone());
    }
    
    config::save_config(&config)?;
    
    Ok(())
}

#[tauri::command]
pub async fn update_vault_last_opened(vault_id: String) -> Result<(), AppError> {
    let mut config = config::load_config()?;
    
    let vault = config.vaults.iter_mut().find(|v| v.id == vault_id)
        .ok_or_else(|| AppError::NotFound("Vault not found".into()))?;
    
    vault.last_opened = Utc::now().to_rfc3339();
    
    config::save_config(&config)?;
    
    Ok(())
}
