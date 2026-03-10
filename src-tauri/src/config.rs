use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

use chrono::Utc;
use uuid::Uuid;

use crate::error::AppError;
use crate::types::{AppConfig, Vault, MAX_RECENTS};

static CONFIG_CACHE: RwLock<Option<AppConfig>> = RwLock::new(None);

/// Returns the path to the local app-config JSON file.
/// Uses Tauri's app data directory: e.g. ~/.config/glade/glade-config.json on Linux.
pub fn get_config_path() -> Result<PathBuf, AppError> {
    let home = dirs_next_home()
        .ok_or_else(|| AppError::InvalidPath("Could not determine home directory".into()))?;

    // Platform-specific config directory
    #[cfg(target_os = "macos")]
    let config_dir = home
        .join("Library")
        .join("Application Support")
        .join("glade");
    #[cfg(target_os = "windows")]
    let config_dir = home.join("AppData").join("Roaming").join("glade");
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    let config_dir = home.join(".config").join("glade");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)?;
    }

    Ok(config_dir.join("glade-config.json"))
}

/// Load the app config from disk. Returns a default config if the file doesn't exist.
/// Uses in-memory cache to avoid repeated disk reads.
pub fn load_config() -> Result<AppConfig, AppError> {
    // Check cache first
    if let Some(cached) = CONFIG_CACHE.read().unwrap().clone() {
        return Ok(cached);
    }

    // Load from disk
    let path = get_config_path()?;
    if !path.exists() {
        let default = AppConfig::default();
        *CONFIG_CACHE.write().unwrap() = Some(default.clone());
        return Ok(default);
    }
    let content = fs::read_to_string(&path)?;
    let config: AppConfig = serde_json::from_str(&content).unwrap_or_default();

    // Cache it
    *CONFIG_CACHE.write().unwrap() = Some(config.clone());
    Ok(config)
}

/// Save the app config to disk and update cache.
pub fn save_config(config: &AppConfig) -> Result<(), AppError> {
    let path = get_config_path()?;
    let content =
        serde_json::to_string_pretty(config).map_err(|e| AppError::InvalidPath(e.to_string()))?;
    fs::write(&path, content)?;

    // Update cache
    *CONFIG_CACHE.write().unwrap() = Some(config.clone());
    Ok(())
}

/// Record that a note was opened: prepends to recents list, deduplicates, trims to MAX_RECENTS.
pub fn record_opened(config: &mut AppConfig, path: &str) {
    config.recents.retain(|p| p != path);
    config.recents.insert(0, path.to_string());
    config.recents.truncate(MAX_RECENTS);
}

fn dirs_next_home() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("USERPROFILE").ok().map(PathBuf::from)
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("HOME").ok().map(PathBuf::from)
    }
}

pub fn create_vault(name: &str, slug: &str) -> Result<Vault, AppError> {
    let now = Utc::now().to_rfc3339();
    Ok(Vault {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        slug: slug.to_string(),
        git_remote: None,
        created_at: now.clone(),
        last_opened: now,
    })
}

pub fn vault_exists(config: &AppConfig, slug: &str) -> bool {
    config.vaults.iter().any(|v| v.slug == slug)
}
