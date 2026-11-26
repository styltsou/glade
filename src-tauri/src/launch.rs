//! Routing "open this path" requests (CLI, OS file association, Home, quick
//! switcher) to windows: in-app opens reuse their window; external opens reuse
//! idle Home windows or create a window for the new root.

use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};

use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::config;
use crate::error::AppError;
use crate::vault;
use crate::watch;
use crate::workspace::{Target, TargetInfo, Workspaces};

static NEXT_WINDOW: AtomicU32 = AtomicU32::new(1);

fn focus(app: &AppHandle, label: &str) {
    if let Some(w) = app.get_webview_window(label) {
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// In-app opens stay in the calling window; external opens only reuse Home.
fn reusable_window(ws: &Workspaces, labels: Vec<String>, prefer: Option<&str>) -> Option<String> {
    if let Some(p) = prefer {
        if labels.iter().any(|l| l == p) {
            return Some(p.to_string());
        }
    }
    let mut idle: Vec<String> = labels.into_iter().filter(|l| ws.target(l).is_none()).collect();
    idle.sort();
    idle.into_iter().next()
}

fn create_window(app: &AppHandle, label: &str) -> Result<(), AppError> {
    WebviewWindowBuilder::new(app, label, WebviewUrl::App("index.html".into()))
        .title("Glade")
        .visible(false) // shown by the frontend once its first screen is ready
        .inner_size(1400.0, 900.0)
        .min_inner_size(800.0, 500.0)
        .resizable(true)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .build()
        .map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

/// Remember which folders are open so the next launch can restore them.
pub fn persist_session(app: &AppHandle) {
    let roots: Vec<String> = app
        .state::<Workspaces>()
        .folder_roots()
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect();
    if let Ok(mut cfg) = config::load_config() {
        cfg.session_roots = roots;
        let _ = config::save_config(&cfg);
    }
}

/// Open a folder or markdown file, following the one-window-per-root rule.
pub fn open_path(app: &AppHandle, path: &Path, prefer: Option<&str>) -> Result<(), AppError> {
    let canon = fs::canonicalize(path)
        .map_err(|_| AppError::NotFound(path.display().to_string()))?;
    let ws = app.state::<Workspaces>();
    let canon_str = canon.to_string_lossy().to_string();

    let target = if canon.is_dir() {
        if let Some(label) = ws.window_with_root(&canon) {
            focus(app, &label);
            return Ok(());
        }
        Target::Folder(canon.clone())
    } else {
        if !vault::is_markdown(&canon) {
            return Err(AppError::InvalidPath(format!("Not a markdown file: {}", path.display())));
        }
        let mut cfg = config::load_config()?;
        config::push_recent(&mut cfg.recent_files, &canon_str);
        config::save_config(&cfg)?;

        if let Some(label) = ws.window_with_file(&canon) {
            focus(app, &label);
            return Ok(());
        }
        if let Some(label) = ws.window_containing(&canon) {
            let _ = app.emit_to(label.as_str(), "show-file", canon_str);
            focus(app, &label);
            return Ok(());
        }
        Target::File(canon.clone())
    };

    if let Target::Folder(_) = target {
        let mut cfg = config::load_config()?;
        config::push_recent(&mut cfg.recent_folders, &canon_str);
        config::save_config(&cfg)?;
    }

    let labels = app.webview_windows().keys().cloned().collect();
    let label = match reusable_window(&ws, labels, prefer) {
        Some(label) => {
            ws.set_target(&label, target.clone());
            let _ = app.emit_to(label.as_str(), "workspace-changed", target.info());
            watch::restart(app, &label);
            label
        }
        None => {
            let label = format!("w-{}", NEXT_WINDOW.fetch_add(1, Ordering::SeqCst));
            // Set before the window loads so its frontend finds the target.
            ws.set_target(&label, target);
            create_window(app, &label)?;
            watch::restart(app, &label);
            label
        }
    };
    focus(app, &label);
    persist_session(app);
    Ok(())
}

/// Open every path argument (relative ones resolved against `cwd`). Returns
/// how many were opened.
pub fn handle_args(app: &AppHandle, args: &[String], cwd: &Path) -> usize {
    let mut opened = 0;
    for arg in args.iter().filter(|a| !a.starts_with('-')) {
        let p = Path::new(arg);
        let full = if p.is_absolute() { p.to_path_buf() } else { cwd.join(p) };
        match open_path(app, &full, None) {
            Ok(()) => opened += 1,
            Err(e) => eprintln!("glade: cannot open {}: {}", arg, e),
        }
    }
    opened
}

/// On launch: open the paths given on the command line, otherwise restore the
/// previous session, otherwise leave the first window on Home.
pub fn startup(app: &AppHandle) {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let cwd = std::env::current_dir().unwrap_or_default();
    if handle_args(app, &args, &cwd) > 0 {
        return;
    }
    if let Ok(cfg) = config::load_config() {
        for root in cfg.session_roots.iter().filter(|r| Path::new(r).is_dir()) {
            let _ = open_path(app, Path::new(root), None);
        }
    }
}

/// A note's file was renamed from `window`: recents follow, and so does the
/// window itself when that file is what it shows.
pub fn file_renamed(window: &tauri::Window, from: &Path, to: &Path) {
    let (old, new) = (from.to_string_lossy().to_string(), to.to_string_lossy().to_string());
    if let Ok(mut cfg) = config::load_config() {
        if cfg.recent_files.contains(&old) {
            cfg.recent_files.retain(|p| *p != new);
            for p in cfg.recent_files.iter_mut().filter(|p| **p == old) {
                *p = new.clone();
            }
            if let Err(e) = config::save_config(&cfg) {
                eprintln!("glade: could not update recent files: {e}");
            }
        }
    }
    let workspaces = window.state::<Workspaces>();
    if workspaces.target(window.label()) == Some(Target::File(from.to_path_buf())) {
        workspaces.set_target(window.label(), Target::File(to.to_path_buf()));
        watch::restart(window.app_handle(), window.label());
    }
}

#[tauri::command]
pub async fn open_path_cmd(app: AppHandle, window: tauri::Window, path: String) -> Result<(), AppError> {
    open_path(&app, Path::new(&path), Some(window.label()))
}

/// What this window shows (None = Home).
#[tauri::command]
pub async fn get_window_target(window: tauri::Window) -> Result<Option<TargetInfo>, AppError> {
    Ok(window.state::<Workspaces>().target(window.label()).map(|t| t.info()))
}

/// Return this window to Home.
#[tauri::command]
pub async fn close_target(app: AppHandle, window: tauri::Window) -> Result<(), AppError> {
    window.state::<Workspaces>().clear(window.label());
    watch::stop(&app, window.label());
    vault::invalidate_vault_cache();
    persist_session(&app);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn in_app_open_reuses_the_current_folder_window() {
        let ws = Workspaces::default();
        ws.set_target("main", Target::Folder("/notes".into()));
        let labels = vec!["home".into(), "main".into()];
        assert_eq!(reusable_window(&ws, labels, Some("main")).as_deref(), Some("main"));
    }

    #[test]
    fn in_app_open_reuses_a_loose_file_window() {
        let ws = Workspaces::default();
        ws.set_target("main", Target::File("/notes/a.md".into()));
        assert_eq!(reusable_window(&ws, vec!["main".into()], Some("main")).as_deref(), Some("main"));
    }

    #[test]
    fn external_open_does_not_replace_an_open_folder() {
        let ws = Workspaces::default();
        ws.set_target("main", Target::Folder("/notes".into()));
        assert_eq!(reusable_window(&ws, vec!["main".into()], None), None);
    }

    #[test]
    fn external_open_reuses_home() {
        let ws = Workspaces::default();
        ws.set_target("main", Target::Folder("/notes".into()));
        let labels = vec!["main".into(), "home".into()];
        assert_eq!(reusable_window(&ws, labels, None).as_deref(), Some("home"));
    }
}
