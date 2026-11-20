use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::config;
use crate::error::AppError;
use crate::links;
use crate::workspace::{resolve_markdown, root_for};

const IMAGE_EXTENSIONS: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"];

fn clean_extension(ext: &str) -> Option<String> {
    let ext = ext.trim_start_matches('.').to_ascii_lowercase();
    IMAGE_EXTENSIONS.contains(&ext.as_str()).then_some(ext)
}

/// Where new images go: next to the note, or in a subfolder of that directory
/// when the user named one. The subfolder is never allowed to leave the note's directory.
pub fn attachment_dir(note_dir: &Path, folder: &str) -> PathBuf {
    let folder = folder.trim().trim_matches('/');
    let p = Path::new(folder);
    let safe = !folder.is_empty()
        && !p.is_absolute()
        && p.components().all(|c| matches!(c, Component::Normal(_)));
    if safe {
        note_dir.join(p)
    } else {
        note_dir.to_path_buf()
    }
}

/// `stem.ext`, or `stem 2.ext`, `stem 3.ext`... when that name is taken.
pub fn unique_path(dir: &Path, stem: &str, ext: &str) -> PathBuf {
    let first = dir.join(format!("{stem}.{ext}"));
    if !first.exists() {
        return first;
    }
    (2..)
        .map(|n| dir.join(format!("{stem} {n}.{ext}")))
        .find(|p| !p.exists())
        .expect("unbounded range")
}

fn note_context(window: &tauri::Window, note: &str) -> Result<(PathBuf, String), AppError> {
    let root = root_for(window)?;
    let note_abs = resolve_markdown(&root, note)?;
    let dir = note_abs.parent().unwrap_or(&root).to_path_buf();
    let stem = note_abs
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".into());
    Ok((dir, stem))
}

fn destination(note_dir: &Path) -> Result<PathBuf, AppError> {
    let folder = config::load_config().map(|c| c.image_folder).unwrap_or_default();
    let dir = attachment_dir(note_dir, &folder);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Copy an image file next to the note (or into the chosen subfolder) and
/// return the link to it, relative to the note.
#[tauri::command]
pub async fn import_image_file(window: tauri::Window, note: String, src: String) -> Result<String, AppError> {
    let (note_dir, _) = note_context(&window, &note)?;
    let src = PathBuf::from(src);
    let ext = src
        .extension()
        .and_then(|e| e.to_str())
        .and_then(clean_extension)
        .ok_or_else(|| AppError::InvalidPath("Not an image file".into()))?;
    if !src.is_file() {
        return Err(AppError::NotFound(src.display().to_string()));
    }
    let stem = src
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "image".into());
    let dir = destination(&note_dir)?;
    let to = unique_path(&dir, &stem, &ext);
    fs::copy(&src, &to)?;
    Ok(links::relative_href(&note_dir, &to))
}

/// Save pasted or dropped image data. The bytes are the request body; the note
/// and file type come in headers (`x-note` percent-encoded, `x-ext`).
#[tauri::command]
pub async fn save_pasted_image(window: tauri::Window, request: tauri::ipc::Request<'_>) -> Result<String, AppError> {
    let header = |name: &str| {
        request
            .headers()
            .get(name)
            .and_then(|v| v.to_str().ok())
            .map(links::percent_decode)
            .unwrap_or_default()
    };
    let note = header("x-note");
    let ext = clean_extension(&header("x-ext")).unwrap_or_else(|| "png".into());
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err(AppError::InvalidPath("Expected image data".into()));
    };
    let (note_dir, note_stem) = note_context(&window, &note)?;
    let dir = destination(&note_dir)?;
    let stamp = chrono::Local::now().format("%Y-%m-%d %H%M%S");
    let to = unique_path(&dir, &format!("{note_stem} {stamp}"), &ext);
    fs::write(&to, bytes)?;
    Ok(links::relative_href(&note_dir, &to))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn images_go_next_to_the_note_unless_a_safe_subfolder_is_named() {
        let dir = Path::new("/n/docs");
        assert_eq!(attachment_dir(dir, ""), dir);
        assert_eq!(attachment_dir(dir, "  "), dir);
        assert_eq!(attachment_dir(dir, "assets"), dir.join("assets"));
        assert_eq!(attachment_dir(dir, "/assets/"), dir.join("assets"));
        assert_eq!(attachment_dir(dir, "a/b"), dir.join("a/b"));
        assert_eq!(attachment_dir(dir, "../x"), dir);
        assert_eq!(attachment_dir(dir, "a/../../x"), dir);
    }

    #[test]
    fn names_never_overwrite() {
        let tmp = tempfile::tempdir().unwrap();
        assert_eq!(unique_path(tmp.path(), "pic", "png"), tmp.path().join("pic.png"));
        fs::write(tmp.path().join("pic.png"), b"x").unwrap();
        assert_eq!(unique_path(tmp.path(), "pic", "png"), tmp.path().join("pic 2.png"));
        fs::write(tmp.path().join("pic 2.png"), b"x").unwrap();
        assert_eq!(unique_path(tmp.path(), "pic", "png"), tmp.path().join("pic 3.png"));
    }

    #[test]
    fn only_image_extensions_are_accepted() {
        assert_eq!(clean_extension(".PNG").as_deref(), Some("png"));
        assert_eq!(clean_extension("exe"), None);
    }
}
