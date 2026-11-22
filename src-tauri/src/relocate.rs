//! Renaming on disk without ever destroying what is at the destination.

use std::fs;
use std::path::Path;

use crate::error::AppError;

/// `fs::rename` silently replaces files and empty folders; this refuses to.
pub fn rename_no_replace(from: &Path, to: &Path) -> Result<(), AppError> {
    if from == to {
        return Ok(());
    }
    // symlink_metadata: a dangling symlink is still something to lose.
    if let Ok(existing) = fs::symlink_metadata(to) {
        // On a case-insensitive disk `notes.md` -> `Notes.md` finds itself.
        let only_case_differs = !existing.file_type().is_symlink()
            && from.to_string_lossy().to_lowercase() == to.to_string_lossy().to_lowercase()
            && fs::canonicalize(from)? == fs::canonicalize(to)?;
        if !only_case_differs {
            let name = to.file_name().unwrap_or_default().to_string_lossy();
            return Err(AppError::InvalidPath(format!("\"{name}\" already exists there")));
        }
    }
    fs::rename(from, to)?;
    crate::watch::record_moved(from, to);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn never_replaces_a_file() {
        let dir = tempfile::tempdir().unwrap();
        let (from, to) = (dir.path().join("a.md"), dir.path().join("b.md"));
        fs::write(&from, "source").unwrap();
        fs::write(&to, "destination").unwrap();
        assert!(rename_no_replace(&from, &to).is_err());
        assert_eq!(fs::read_to_string(&from).unwrap(), "source");
        assert_eq!(fs::read_to_string(&to).unwrap(), "destination");
    }

    #[test]
    fn never_replaces_an_empty_folder() {
        let dir = tempfile::tempdir().unwrap();
        let (from, to) = (dir.path().join("a"), dir.path().join("b"));
        fs::create_dir(&from).unwrap();
        fs::create_dir(&to).unwrap();
        assert!(rename_no_replace(&from, &to).is_err());
        assert!(from.is_dir() && to.is_dir());
    }

    #[cfg(unix)]
    #[test]
    fn never_replaces_a_dangling_symlink() {
        let dir = tempfile::tempdir().unwrap();
        let (from, to) = (dir.path().join("a.md"), dir.path().join("b.md"));
        fs::write(&from, "source").unwrap();
        std::os::unix::fs::symlink(dir.path().join("gone"), &to).unwrap();
        assert!(rename_no_replace(&from, &to).is_err());
        assert!(from.exists());
    }

    #[test]
    fn what_was_known_about_a_file_follows_it() {
        let dir = tempfile::tempdir().unwrap();
        let (from, to) = (dir.path().join("a"), dir.path().join("b"));
        fs::create_dir(&from).unwrap();
        crate::watch::write_file(&from.join("n.md"), "mine").unwrap();
        rename_no_replace(&from, &to).unwrap();
        fs::write(to.join("n.md"), "theirs").unwrap();
        assert_eq!(crate::watch::disk_state(&to.join("n.md")), crate::watch::DiskState::Modified);
    }
}
