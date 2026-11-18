//! Keeping Glade in step with files changed by other programs (editors, git,
//! sync tools), and telling Glade's own writes apart from those.

use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_full::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::vault;
use crate::workspace::{Target, Workspaces};

/// What Glade last read from or wrote to each file (content hash). A file whose
/// current content hashes differently was changed by someone else.
static KNOWN: Mutex<Option<HashMap<PathBuf, u64>>> = Mutex::new(None);

pub fn content_hash(bytes: &[u8]) -> u64 {
    let mut h = DefaultHasher::new();
    bytes.hash(&mut h);
    h.finish()
}

pub fn record_known(path: &Path, bytes: &[u8]) {
    KNOWN
        .lock()
        .unwrap()
        .get_or_insert_with(HashMap::new)
        .insert(path.to_path_buf(), content_hash(bytes));
}

fn known_hash(path: &Path) -> Option<u64> {
    KNOWN.lock().unwrap().as_ref().and_then(|m| m.get(path).copied())
}

/// Write a file and remember its content so the watcher ignores our own write.
pub fn write_file(path: &Path, content: impl AsRef<[u8]>) -> io::Result<()> {
    std::fs::write(path, content.as_ref())?;
    record_known(path, content.as_ref());
    Ok(())
}

#[derive(Debug, PartialEq, Eq)]
pub enum DiskState {
    /// Same as what Glade last saw (or never seen).
    Unchanged,
    Modified,
    Removed,
}

/// Compare a file on disk with what Glade last read or wrote.
pub fn disk_state(path: &Path) -> DiskState {
    let Ok(bytes) = std::fs::read(path) else {
        return DiskState::Removed;
    };
    match known_hash(path) {
        Some(h) if h != content_hash(&bytes) => DiskState::Modified,
        _ => DiskState::Unchanged,
    }
}

#[derive(Clone, Serialize)]
struct ExternalChange {
    path: String,
    kind: &'static str,
}

type Watcher = Debouncer<RecommendedWatcher, RecommendedCache>;

#[derive(Default)]
pub struct Watchers(Mutex<HashMap<String, Watcher>>);

const SKIPPED: [&str; 3] = [".git", "node_modules", "target"];

fn is_ignored(root: &Path, path: &Path, gitignore: &ignore::gitignore::Gitignore) -> bool {
    let Ok(rel) = path.strip_prefix(root) else { return false };
    if rel.components().any(|c| {
        let s = c.as_os_str().to_string_lossy();
        SKIPPED.contains(&s.as_ref()) || s.starts_with('.')
    }) {
        return true;
    }
    gitignore.matched_path_or_any_parents(path, path.is_dir()).is_ignore()
}

pub struct Outcome {
    /// Markdown files changed by someone else, with what happened to them.
    pub external: Vec<(PathBuf, &'static str)>,
    /// Whether the file tree (and search/tags) should be refreshed.
    pub tree_changed: bool,
}

/// Turn raw changed paths into what Glade should react to.
pub fn process_paths(
    root: &Path,
    gitignore: &ignore::gitignore::Gitignore,
    loose_file: Option<&Path>,
    paths: Vec<PathBuf>,
) -> Outcome {
    let mut out = Outcome { external: Vec::new(), tree_changed: false };
    for p in paths {
        if is_ignored(root, &p, gitignore) {
            continue;
        }
        if let Some(f) = loose_file {
            if p != f {
                continue;
            }
        }
        let exists = p.exists();
        let markdown = vault::is_markdown(&p);
        // Our own writes match what we recorded; everything else is external.
        if markdown && exists && known_hash(&p).is_some() && disk_state(&p) == DiskState::Unchanged {
            continue;
        }
        if markdown || !exists || p.is_dir() {
            out.tree_changed = true;
        }
        if markdown {
            out.external.push((p, if exists { "modified" } else { "removed" }));
        }
    }
    out
}

/// (Re)start watching what `label`'s window shows. Failure is reported to the
/// window so it can fall back to polling the open file.
pub fn restart(app: &AppHandle, label: &str) {
    let watchers = app.state::<Watchers>();
    watchers.0.lock().unwrap().remove(label);

    let Some(target) = app.state::<Workspaces>().target(label) else { return };
    let (watch_path, mode, root) = match &target {
        Target::Folder(r) => (r.clone(), RecursiveMode::Recursive, r.clone()),
        Target::File(f) => {
            let Some(parent) = f.parent() else { return };
            (parent.to_path_buf(), RecursiveMode::NonRecursive, parent.to_path_buf())
        }
    };

    let mut builder = ignore::gitignore::GitignoreBuilder::new(&root);
    let _ = builder.add(root.join(".gitignore"));
    let gitignore = builder.build().unwrap_or_else(|_| ignore::gitignore::Gitignore::empty());

    let handle = app.clone();
    let window_label = label.to_string();
    let loose_file = if let Target::File(f) = &target { Some(f.clone()) } else { None };

    let debouncer = new_debouncer(Duration::from_millis(300), None, move |result: DebounceEventResult| {
        let Ok(events) = result else { return };
        let mut paths: Vec<PathBuf> = events.into_iter().flat_map(|e| e.event.paths).collect();
        paths.sort();
        paths.dedup();

        if !root.exists() {
            let _ = handle.emit_to(window_label.as_str(), "root-removed", ());
            return;
        }

        let outcome = process_paths(&root, &gitignore, loose_file.as_deref(), paths);
        for (p, kind) in outcome.external {
            let _ = handle.emit_to(
                window_label.as_str(),
                "external-change",
                ExternalChange { path: p.to_string_lossy().to_string(), kind },
            );
        }
        if outcome.tree_changed {
            let _ = handle.emit_to(window_label.as_str(), "tree-changed", ());
        }
    });

    match debouncer {
        Ok(mut d) => match d.watch(&watch_path, mode) {
            Ok(()) => {
                watchers.0.lock().unwrap().insert(label.to_string(), d);
            }
            Err(_) => {
                let _ = app.emit_to(label, "watch-unavailable", ());
            }
        },
        Err(_) => {
            let _ = app.emit_to(label, "watch-unavailable", ());
        }
    }
}

pub fn stop(app: &AppHandle, label: &str) {
    app.state::<Watchers>().0.lock().unwrap().remove(label);
}

/// Polling fallback / manual check: has this file changed behind our back?
#[tauri::command]
pub async fn check_external(window: tauri::Window, path: String) -> Result<String, crate::error::AppError> {
    let root = crate::workspace::root_for(&window)?;
    let full = crate::workspace::resolve_markdown(&root, &path)?;
    Ok(match disk_state(&full) {
        DiskState::Unchanged => "unchanged",
        DiskState::Modified => "modified",
        DiskState::Removed => "removed",
    }
    .to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn own_writes_are_recognised_and_external_ones_are_not() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("a.md");

        write_file(&file, "mine").unwrap();
        assert_eq!(disk_state(&file), DiskState::Unchanged);

        std::fs::write(&file, "theirs").unwrap();
        assert_eq!(disk_state(&file), DiskState::Modified);

        // Reading it (what Glade shows now) makes it the new baseline.
        record_known(&file, b"theirs");
        assert_eq!(disk_state(&file), DiskState::Unchanged);

        std::fs::remove_file(&file).unwrap();
        assert_eq!(disk_state(&file), DiskState::Removed);
    }

    #[test]
    fn real_watcher_reports_new_markdown_but_not_node_modules() {
        let dir = tempfile::tempdir().unwrap();
        let root = std::fs::canonicalize(dir.path()).unwrap();
        let (tx, rx) = std::sync::mpsc::channel();
        let mut d = new_debouncer(Duration::from_millis(100), None, move |r: DebounceEventResult| {
            let _ = tx.send(r);
        })
        .unwrap();
        d.watch(&root, RecursiveMode::Recursive).unwrap();

        std::fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        std::fs::write(root.join("node_modules/pkg/README.md"), "x").unwrap();
        std::fs::write(root.join("new.md"), "x").unwrap();

        let mut paths = Vec::new();
        let deadline = std::time::Instant::now() + Duration::from_secs(5);
        while std::time::Instant::now() < deadline && !paths.iter().any(|p: &PathBuf| p.ends_with("new.md")) {
            if let Ok(Ok(events)) = rx.recv_timeout(Duration::from_millis(500)) {
                paths.extend(events.into_iter().flat_map(|e| e.event.paths));
            }
        }
        let gi = ignore::gitignore::Gitignore::empty();
        let outcome = process_paths(&root, &gi, None, paths);
        assert!(outcome.tree_changed);
        assert!(outcome.external.iter().any(|(p, k)| p.ends_with("new.md") && *k == "modified"));
        assert!(!outcome.external.iter().any(|(p, _)| p.to_string_lossy().contains("node_modules")));
    }

    #[test]
    fn never_seen_files_are_not_conflicts() {
        let dir = tempfile::tempdir().unwrap();
        let file = dir.path().join("fresh.md");
        std::fs::write(&file, "x").unwrap();
        assert_eq!(disk_state(&file), DiskState::Unchanged);
    }

    #[test]
    fn ignore_rules_apply_to_events() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::write(root.join(".gitignore"), "dist/\n").unwrap();
        let mut b = ignore::gitignore::GitignoreBuilder::new(root);
        let _ = b.add(root.join(".gitignore"));
        let gi = b.build().unwrap();
        assert!(is_ignored(root, &root.join("node_modules/p/R.md"), &gi));
        assert!(is_ignored(root, &root.join(".git/x.md"), &gi));
        assert!(is_ignored(root, &root.join("dist/a.md"), &gi));
        assert!(!is_ignored(root, &root.join("docs/a.md"), &gi));
    }
}
