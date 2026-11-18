//! What each window is showing: a folder, a single loose file, or (no entry)
//! Home. Commands never receive a root from the frontend; they resolve it from
//! the calling window, so several windows can show different folders at once.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::Serialize;
use tauri::Manager;

use crate::error::AppError;
use crate::vault;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Target {
    Folder(PathBuf),
    File(PathBuf),
}

#[derive(Debug, Clone, Serialize)]
pub struct TargetInfo {
    pub kind: &'static str,
    pub path: String,
}

impl Target {
    pub fn info(&self) -> TargetInfo {
        match self {
            Target::Folder(p) => TargetInfo { kind: "folder", path: p.to_string_lossy().to_string() },
            Target::File(p) => TargetInfo { kind: "file", path: p.to_string_lossy().to_string() },
        }
    }
}

#[derive(Default)]
pub struct Workspaces(Mutex<HashMap<String, Target>>);

impl Workspaces {
    pub fn set_target(&self, label: &str, target: Target) {
        self.0.lock().unwrap().insert(label.to_string(), target);
    }

    pub fn target(&self, label: &str) -> Option<Target> {
        self.0.lock().unwrap().get(label).cloned()
    }

    pub fn clear(&self, label: &str) {
        self.0.lock().unwrap().remove(label);
    }

    /// Directory commands resolve relative paths against: the folder root, or
    /// a loose file's parent directory.
    pub fn root(&self, label: &str) -> Option<PathBuf> {
        match self.target(label)? {
            Target::Folder(p) => Some(p),
            Target::File(p) => p.parent().map(Path::to_path_buf),
        }
    }

    pub fn window_with_root(&self, root: &Path) -> Option<String> {
        self.0.lock().unwrap().iter().find_map(|(l, t)| match t {
            Target::Folder(r) if r == root => Some(l.clone()),
            _ => None,
        })
    }

    pub fn window_with_file(&self, file: &Path) -> Option<String> {
        self.0.lock().unwrap().iter().find_map(|(l, t)| match t {
            Target::File(f) if f == file => Some(l.clone()),
            _ => None,
        })
    }

    /// A folder window whose root contains `path`.
    pub fn window_containing(&self, path: &Path) -> Option<String> {
        self.0.lock().unwrap().iter().find_map(|(l, t)| match t {
            Target::Folder(r) if path.starts_with(r) => Some(l.clone()),
            _ => None,
        })
    }

    /// Open folder roots in a stable order (by window label).
    pub fn folder_roots(&self) -> Vec<PathBuf> {
        let map = self.0.lock().unwrap();
        let mut items: Vec<(&String, &PathBuf)> = map
            .iter()
            .filter_map(|(l, t)| match t {
                Target::Folder(r) => Some((l, r)),
                _ => None,
            })
            .collect();
        items.sort_by(|a, b| a.0.cmp(b.0));
        items.into_iter().map(|(_, r)| r.clone()).collect()
    }
}

/// Root directory for the calling window; errors when the window shows Home.
pub fn root_for(window: &tauri::Window) -> Result<PathBuf, AppError> {
    window
        .state::<Workspaces>()
        .root(window.label())
        .ok_or_else(|| AppError::InvalidPath("No folder is open in this window".into()))
}

/// Resolve a path for a *mutation* (create, delete, rename, move): it must be
/// relative to the root and must not escape it.
pub fn resolve_inside(root: &Path, rel: &str) -> Result<PathBuf, AppError> {
    let p = Path::new(rel);
    let escapes = p.is_absolute()
        || p.components().any(|c| matches!(c, std::path::Component::ParentDir | std::path::Component::Prefix(_)));
    if escapes {
        return Err(AppError::InvalidPath(format!("Path is outside the open folder: {}", rel)));
    }
    Ok(root.join(p))
}

/// Resolve a path for reading or editing a note. Relative paths are under the
/// root; absolute paths address files elsewhere (outside links, loose files).
/// Only markdown files are accepted.
pub fn resolve_markdown(root: &Path, path: &str) -> Result<PathBuf, AppError> {
    let full = root.join(path);
    if !vault::is_markdown(&full) {
        return Err(AppError::InvalidPath(format!("Not a markdown file: {}", path)));
    }
    Ok(full)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mutations_cannot_escape_the_root() {
        let root = Path::new("/r");
        assert!(resolve_inside(root, "a/b.md").is_ok());
        assert!(resolve_inside(root, "../x.md").is_err());
        assert!(resolve_inside(root, "a/../../x.md").is_err());
        assert!(resolve_inside(root, "/etc/passwd").is_err());
    }

    #[test]
    fn reads_allow_outside_markdown_only() {
        let root = Path::new("/r");
        assert_eq!(resolve_markdown(root, "a.md").unwrap(), Path::new("/r/a.md"));
        assert_eq!(resolve_markdown(root, "/other/b.md").unwrap(), Path::new("/other/b.md"));
        assert!(resolve_markdown(root, "/etc/passwd").is_err());
        assert!(resolve_markdown(root, "../../.ssh/id_rsa").is_err());
    }
}
