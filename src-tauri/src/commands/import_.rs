use crate::config;
use crate::error::AppError;
use crate::vault;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Emitter;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedFile {
    pub relative_path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSource {
    pub root_path: String,
    pub files: Vec<ImportedFile>,
    pub total_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportConflict {
    pub relative_path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSourceWithConflicts {
    pub root_path: String,
    pub files: Vec<ImportedFile>,
    pub total_count: usize,
    pub conflicts: Vec<ImportConflict>,
    pub broken_links: Vec<BrokenLink>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrokenLink {
    pub file_relative_path: String,
    pub link_target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportProgress {
    pub current: usize,
    pub total: usize,
    pub file_name: String,
}

#[tauri::command]
pub fn scan_import_source(path: String) -> Result<ImportSource, AppError> {
    let path = Path::new(&path);

    if !path.exists() {
        return Err(AppError::NotFound(format!(
            "Path not found: {}",
            path.display()
        )));
    }

    let root_path = path.to_string_lossy().to_string();
    let mut files = Vec::new();

    if path.is_dir() {
        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            let entry_path = entry.path();
            if entry_path.is_file() && entry_path.extension().map_or(false, |ext| ext == "md") {
                let relative = entry_path
                    .strip_prefix(path)
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();
                let name = entry_path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();
                files.push(ImportedFile {
                    relative_path: relative,
                    name,
                });
            }
        }
    } else if path.extension().map_or(false, |ext| ext == "md") {
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        files.push(ImportedFile {
            relative_path: name.clone(),
            name,
        });
    }

    let total_count = files.len();

    Ok(ImportSource {
        root_path,
        files,
        total_count,
    })
}

fn extract_markdown_links(content: &str) -> Vec<String> {
    let mut links = Vec::new();

    let link_regex = regex::Regex::new(r"\[([^\]]+)\]\(([^)]+)\)").unwrap();

    for cap in link_regex.captures_iter(content) {
        if let Some(link_target) = cap.get(2) {
            let target = link_target.as_str().to_string();
            if !target.starts_with("http://")
                && !target.starts_with("https://")
                && !target.starts_with("mailto:")
                && !target.starts_with("#")
            {
                links.push(target);
            }
        }
    }

    links
}

fn resolve_link(base_path: &Path, link: &str) -> Option<PathBuf> {
    let link_path = Path::new(link);

    if link_path.is_absolute() {
        return None;
    }

    let resolved = base_path.join(link_path);

    Some(resolved)
}

fn check_broken_links(root_path: &Path, files: &[ImportedFile]) -> Vec<BrokenLink> {
    let mut broken_links = Vec::new();

    let valid_relative_paths: std::collections::HashSet<String> = files
        .iter()
        .map(|f| {
            f.relative_path
                .trim_end_matches(".md")
                .trim_end_matches(".MD")
                .trim_end_matches(".mD")
                .trim_end_matches(".Md")
                .to_lowercase()
        })
        .collect();

    for file in files {
        let full_path = root_path.join(&file.relative_path);

        if let Ok(content) = fs::read_to_string(&full_path) {
            let links = extract_markdown_links(&content);

            for link in links {
                let link_without_fragment = link.split('#').next().unwrap_or(&link).trim();

                if link_without_fragment.is_empty() {
                    continue;
                }

                let file_dir = full_path.parent().unwrap_or(root_path);
                if let Some(resolved) = resolve_link(file_dir, link_without_fragment) {
                    let resolved_str = resolved
                        .to_string_lossy()
                        .trim_end_matches(".md")
                        .trim_end_matches(".MD")
                        .trim_end_matches(".mD")
                        .trim_end_matches(".Md")
                        .to_lowercase();

                    let is_valid = valid_relative_paths
                        .iter()
                        .any(|vp| resolved_str.ends_with(vp) || vp.ends_with(&resolved_str));

                    if !is_valid {
                        broken_links.push(BrokenLink {
                            file_relative_path: file.relative_path.clone(),
                            link_target: link.clone(),
                        });
                    }
                } else {
                    broken_links.push(BrokenLink {
                        file_relative_path: file.relative_path.clone(),
                        link_target: link.clone(),
                    });
                }
            }
        }
    }

    broken_links
}

fn get_vault_dir_by_id(vault_id: &str) -> Result<PathBuf, AppError> {
    let cfg = config::load_config()?;
    let vault = cfg
        .vaults
        .iter()
        .find(|v| v.id == vault_id)
        .ok_or_else(|| AppError::NotFound("Vault not found".into()))?;
    vault::get_vault_dir(&vault.slug)
}

#[derive(Debug, Clone, Deserialize)]
pub struct ConflictResolution {
    pub relative_path: String,
    pub action: String,
}

#[tauri::command]
pub fn check_import_conflicts(
    source_path: String,
    vault_id: String,
) -> Result<ImportSourceWithConflicts, AppError> {
    let source = scan_import_source(source_path.clone())?;
    
    let mut conflicts = Vec::new();
    if !vault_id.is_empty() {
        let vault_dir = get_vault_dir_by_id(&vault_id)?;
        for file in &source.files {
            let dest_file = vault_dir.join(&file.relative_path);
            if dest_file.exists() {
                conflicts.push(ImportConflict {
                    relative_path: file.relative_path.clone(),
                    name: file.name.clone(),
                });
            }
        }
    }

    let root_path = Path::new(&source_path);
    let broken_links = check_broken_links(root_path, &source.files);

    Ok(ImportSourceWithConflicts {
        root_path: source.root_path,
        files: source.files,
        total_count: source.total_count,
        conflicts,
        broken_links,
    })
}

fn generate_title_from_filename(filename: &str) -> String {
    let name = filename
        .trim_end_matches(".md")
        .trim_end_matches(".MD")
        .trim_end_matches(".mD")
        .trim_end_matches(".Md");

    let title = name.replace('-', " ").replace('_', " ");

    let mut chars = title.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

fn process_import_content(content: &str, filename: &str) -> String {
    let (mut meta, body) = vault::parse_frontmatter(content);

    if meta.title.is_none() {
        let title = generate_title_from_filename(filename);
        if !title.is_empty() {
            meta.title = Some(title);
        }
    }

    if meta.id.is_none() {
        meta.id = Some(uuid::Uuid::new_v4().to_string());
    }

    if meta.created.is_none() {
        meta.created = Some(chrono::Utc::now().to_rfc3339());
    }

    let frontmatter = vault::build_frontmatter(&meta);

    if frontmatter.lines().count() > 2 {
        format!("{}\n\n{}", frontmatter, body)
    } else {
        body
    }
}

fn generate_unique_filename(dir: &Path, filename: &str) -> PathBuf {
    let path = dir.join(filename);
    if !path.exists() {
        return path;
    }

    let stem = Path::new(filename)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(filename);
    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("md");

    for i in 1..1000 {
        let new_name = if ext == "md" {
            format!("{}-{}.{}", stem, i, ext)
        } else {
            format!("{}-{}.{}", stem, i, ext)
        };
        let new_path = dir.join(&new_name);
        if !new_path.exists() {
            return new_path;
        }
    }

    dir.join(filename)
}

#[tauri::command]
pub fn import_files(
    source_path: String,
    vault_id: String,
    resolutions: Vec<ConflictResolution>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    eprintln!(
        "import_files called: source_path={}, vault_id={}",
        source_path, vault_id
    );
    let source = scan_import_source(source_path.clone())?;
    eprintln!("Scanned source: {} files found", source.files.len());
    let vault_dir = get_vault_dir_by_id(&vault_id)?;
    eprintln!("Vault dir: {:?}", vault_dir);

    let resolutions_map: HashMap<String, &str> = resolutions
        .iter()
        .map(|r| (r.relative_path.clone(), r.action.as_str()))
        .collect();

    let total = source.files.len();

    for (idx, file) in source.files.iter().enumerate() {
        let source_file = Path::new(&source.root_path).join(&file.relative_path);
        let dest_file = vault_dir.join(&file.relative_path);

        if let Some(parent) = dest_file.parent() {
            if !parent.exists() {
                fs::create_dir_all(parent)?;
            }
        }

        let action = resolutions_map.get(&file.relative_path).copied();

        match action {
            Some("skip") => {
                let _ = app_handle.emit(
                    "import-progress",
                    ImportProgress {
                        current: idx + 1,
                        total,
                        file_name: file.name.clone(),
                    },
                );
                continue;
            }
            Some("replace") => {
                let content = fs::read_to_string(&source_file)?;
                let processed = process_import_content(&content, &file.name);
                fs::write(&dest_file, processed)?;
            }
            Some("keep_both") => {
                let unique_path = generate_unique_filename(
                    dest_file.parent().unwrap_or(&vault_dir),
                    file.relative_path
                        .split('/')
                        .last()
                        .unwrap_or(&file.relative_path),
                );
                let content = fs::read_to_string(&source_file)?;
                let processed = process_import_content(&content, &file.name);
                fs::write(&unique_path, processed)?;
            }
            _ => {
                if dest_file.exists() {
                    let unique_path = generate_unique_filename(
                        dest_file.parent().unwrap_or(&vault_dir),
                        file.relative_path
                            .split('/')
                            .last()
                            .unwrap_or(&file.relative_path),
                    );
                    let content = fs::read_to_string(&source_file)?;
                    let processed = process_import_content(&content, &file.name);
                    fs::write(&unique_path, processed)?;
                } else {
                    let content = fs::read_to_string(&source_file)?;
                    let processed = process_import_content(&content, &file.name);
                    eprintln!("Writing file to: {:?}", dest_file);
                    fs::write(&dest_file, processed)?;
                }
            }
        }

        eprintln!("Emitting progress: {}/{}", idx + 1, total);
        let _ = app_handle.emit(
            "import-progress",
            ImportProgress {
                current: idx + 1,
                total,
                file_name: file.name.clone(),
            },
        );
    }

    vault::invalidate_vault_cache();

    eprintln!("Import completed successfully");
    Ok(())
}
