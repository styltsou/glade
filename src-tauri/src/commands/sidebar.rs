use crate::config;
use crate::error::AppError;
use crate::types::SidebarState;

/// Get the current sidebar UI state from the local config.
#[tauri::command]
pub async fn get_sidebar_state() -> Result<SidebarState, AppError> {
    let cfg = config::load_config()?;
    Ok(cfg.sidebar)
}

/// Persist sidebar UI state to the local config file.
#[tauri::command]
pub async fn save_sidebar_state(state: SidebarState) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    cfg.sidebar = state;
    config::save_config(&cfg)?;
    Ok(())
}
