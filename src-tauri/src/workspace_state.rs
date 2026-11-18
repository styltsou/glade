//! Per-folder app state, kept in Glade's own data directory and keyed by the
//! folder's absolute path, so nothing is ever written inside user folders.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::config;
use crate::error::AppError;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct WorkspaceState {
    /// Absolute root path this state belongs to (informational; the directory
    /// name is the lookup key).
    #[serde(default)]
    pub root: String,
    /// Pinned notes, as paths relative to the root.
    #[serde(default)]
    pub pinned: Vec<String>,
    /// Expanded folders in the tree (relative paths).
    #[serde(default)]
    pub expanded_folders: Vec<String>,
    /// The note that was open when the folder was last used.
    #[serde(default)]
    pub last_file: Option<String>,
    /// Per-note read (false) / edit (true) mode.
    #[serde(default)]
    pub edit_mode: std::collections::HashMap<String, bool>,
    /// Per-note scroll position.
    #[serde(default)]
    pub scroll: std::collections::HashMap<String, f64>,
}

/// The parts of a folder's state the UI owns and saves as a whole. Pins are
/// managed by their own commands and are never overwritten by this.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct UiState {
    #[serde(default)]
    pub expanded_folders: Vec<String>,
    #[serde(default)]
    pub last_file: Option<String>,
    #[serde(default)]
    pub edit_mode: std::collections::HashMap<String, bool>,
    #[serde(default)]
    pub scroll: std::collections::HashMap<String, f64>,
}

impl WorkspaceState {
    pub fn ui(&self) -> UiState {
        UiState {
            expanded_folders: self.expanded_folders.clone(),
            last_file: self.last_file.clone(),
            edit_mode: self.edit_mode.clone(),
            scroll: self.scroll.clone(),
        }
    }

    pub fn apply_ui(&mut self, ui: UiState) {
        self.expanded_folders = ui.expanded_folders;
        self.last_file = ui.last_file;
        self.edit_mode = ui.edit_mode;
        self.scroll = ui.scroll;
    }
}

/// Stable directory key for a root path.
pub fn key_for(root: &Path) -> String {
    let canonical = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let digest = Sha256::digest(canonical.to_string_lossy().as_bytes());
    digest.iter().take(8).map(|b| format!("{:02x}", b)).collect()
}

fn state_file_in(base: &Path, root: &Path) -> PathBuf {
    base.join("workspaces").join(key_for(root)).join("state.json")
}

pub fn load_in(base: &Path, root: &Path) -> WorkspaceState {
    fs::read_to_string(state_file_in(base, root))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| WorkspaceState {
            root: root.to_string_lossy().to_string(),
            ..Default::default()
        })
}

pub fn save_in(base: &Path, root: &Path, state: &WorkspaceState) -> Result<(), AppError> {
    let file = state_file_in(base, root);
    if let Some(dir) = file.parent() {
        fs::create_dir_all(dir)?;
    }
    let mut state = state.clone();
    state.root = root.to_string_lossy().to_string();
    let json = serde_json::to_string_pretty(&state).map_err(|e| AppError::Internal(e.to_string()))?;
    fs::write(file, json)?;
    Ok(())
}

pub fn load(root: &Path) -> Result<WorkspaceState, AppError> {
    Ok(load_in(&config::get_config_dir()?, root))
}

pub fn save(root: &Path, state: &WorkspaceState) -> Result<(), AppError> {
    save_in(&config::get_config_dir()?, root, state)
}

/// Carry a folder's saved state to a new path (after the user locates a moved
/// folder). No-op when there is no saved state.
pub fn move_state_in(base: &Path, old_root: &Path, new_root: &Path) -> Result<(), AppError> {
    let old_dir = state_file_in(base, old_root);
    let old_dir = old_dir.parent().unwrap();
    if !old_dir.exists() {
        return Ok(());
    }
    let mut state = load_in(base, old_root);
    state.root = new_root.to_string_lossy().to_string();
    save_in(base, new_root, &state)?;
    let new_dir = state_file_in(base, new_root);
    if old_dir != new_dir.parent().unwrap() {
        fs::remove_dir_all(old_dir)?;
    }
    Ok(())
}

/// Forget everything saved for a folder.
pub fn discard_in(base: &Path, root: &Path) -> Result<(), AppError> {
    let file = state_file_in(base, root);
    if let Some(dir) = file.parent() {
        if dir.exists() {
            fs::remove_dir_all(dir)?;
        }
    }
    Ok(())
}

/// Pin a note (idempotent). Returns the updated state.
pub fn pin(root: &Path, path: &str) -> Result<WorkspaceState, AppError> {
    let mut state = load(root)?;
    if !state.pinned.iter().any(|p| p == path) {
        state.pinned.push(path.to_string());
    }
    save(root, &state)?;
    Ok(state)
}

pub fn unpin(root: &Path, path: &str) -> Result<WorkspaceState, AppError> {
    let mut state = load(root)?;
    state.pinned.retain(|p| p != path);
    save(root, &state)?;
    Ok(state)
}

/// Rewrite a pinned path after a rename/move (used for notes and for folders:
/// any pinned path under `from` follows).
pub fn rename_path(root: &Path, from: &str, to: &str) -> Result<(), AppError> {
    let mut state = load(root)?;
    let prefix = format!("{}/", from.trim_end_matches('/'));
    let mut changed = false;
    for p in state.pinned.iter_mut() {
        if p == from {
            *p = to.to_string();
            changed = true;
        } else if let Some(rest) = p.strip_prefix(&prefix) {
            *p = format!("{}/{}", to.trim_end_matches('/'), rest);
            changed = true;
        }
    }
    if changed {
        save(root, &state)?;
    }
    Ok(())
}

/// Drop pinned paths under `path` (note or folder deleted).
pub fn forget_path(root: &Path, path: &str) -> Result<(), AppError> {
    let mut state = load(root)?;
    let prefix = format!("{}/", path.trim_end_matches('/'));
    let before = state.pinned.len();
    state.pinned.retain(|p| p != path && !p.starts_with(&prefix));
    if state.pinned.len() != before {
        save(root, &state)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pin_state_round_trips_outside_the_folder() {
        let base = tempfile::tempdir().unwrap();
        let root = tempfile::tempdir().unwrap();
        let mut st = load_in(base.path(), root.path());
        st.pinned.push("a.md".into());
        save_in(base.path(), root.path(), &st).unwrap();

        assert_eq!(load_in(base.path(), root.path()).pinned, vec!["a.md"]);
        // Nothing was created inside the user's folder.
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
    }

    #[test]
    fn locate_carries_state_and_remove_discards_it() {
        let base = tempfile::tempdir().unwrap();
        let old = tempfile::tempdir().unwrap();
        let new = tempfile::tempdir().unwrap();
        let mut st = load_in(base.path(), old.path());
        st.pinned.push("a.md".into());
        save_in(base.path(), old.path(), &st).unwrap();

        move_state_in(base.path(), old.path(), new.path()).unwrap();
        assert_eq!(load_in(base.path(), new.path()).pinned, vec!["a.md"]);
        assert!(load_in(base.path(), old.path()).pinned.is_empty());

        discard_in(base.path(), new.path()).unwrap();
        assert!(load_in(base.path(), new.path()).pinned.is_empty());
    }

    #[test]
    fn ui_state_round_trips_without_touching_pins() {
        let base = tempfile::tempdir().unwrap();
        let root = tempfile::tempdir().unwrap();
        let mut st = load_in(base.path(), root.path());
        st.pinned.push("a.md".into());
        save_in(base.path(), root.path(), &st).unwrap();

        let mut st = load_in(base.path(), root.path());
        st.apply_ui(UiState {
            expanded_folders: vec!["docs".into()],
            last_file: Some("docs/a.md".into()),
            edit_mode: [("docs/a.md".to_string(), true)].into(),
            scroll: [("docs/a.md".to_string(), 120.0)].into(),
        });
        save_in(base.path(), root.path(), &st).unwrap();

        let back = load_in(base.path(), root.path());
        assert_eq!(back.pinned, vec!["a.md"]);
        assert_eq!(back.ui().last_file.as_deref(), Some("docs/a.md"));
        assert_eq!(back.ui().expanded_folders, vec!["docs"]);
        assert_eq!(back.ui().scroll["docs/a.md"], 120.0);
        // Older state files without these fields still load.
        let old = r#"{"root":"/x","pinned":["p.md"]}"#;
        let parsed: WorkspaceState = serde_json::from_str(old).unwrap();
        assert_eq!(parsed.pinned, vec!["p.md"]);
        assert!(parsed.expanded_folders.is_empty());
    }

    #[test]
    fn keys_differ_per_root() {
        let a = tempfile::tempdir().unwrap();
        let b = tempfile::tempdir().unwrap();
        assert_ne!(key_for(a.path()), key_for(b.path()));
        assert_eq!(key_for(a.path()).len(), 16);
    }
}
