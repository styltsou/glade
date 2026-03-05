use std::fs;

use chrono::Utc;

use crate::config;
use crate::error::AppError;
use crate::types::{NoteCard, NoteData, NoteMeta, SidebarState, TagCount, VaultEntry};
use crate::vault;

/// List all files and folders in the vault as a recursive tree.
#[tauri::command]
pub async fn list_vault() -> Result<Vec<VaultEntry>, AppError> {
    let vault_path = vault::get_vault_path()?;
    vault::build_vault_tree(&vault_path)
}

/// Read a note file and return its parsed data.
#[tauri::command]
pub async fn read_note(path: String) -> Result<NoteData, AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (meta, body) = vault::parse_frontmatter(&content);

    let filename = full_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "Untitled".into());

    let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
    let preview = vault::make_preview(&body);

    Ok(NoteData {
        path,
        title,
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        body,
        preview,
    })
}

/// Write content to a note, updating the `updated` timestamp in frontmatter.
#[tauri::command]
pub async fn write_note(path: String, content: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    // Parse existing frontmatter to preserve metadata
    let existing = if full_path.exists() {
        fs::read_to_string(&full_path)?
    } else {
        String::new()
    };

    let (mut meta, _) = vault::parse_frontmatter(&existing);
    meta.updated = Some(Utc::now().to_rfc3339());

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, content);

    // Ensure parent directory exists
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }

    fs::write(&full_path, full_content)?;
    Ok(())
}

/// Create a new note in the given folder (or vault root).
#[tauri::command]
pub async fn create_note(folder: Option<String>) -> Result<NoteData, AppError> {
    let vault_path = vault::get_vault_path()?;

    let target_dir = match &folder {
        Some(f) => vault_path.join(f),
        None => vault_path.clone(),
    };

    if !target_dir.exists() {
        fs::create_dir_all(&target_dir)?;
    }

    // Find a unique filename
    let mut filename = "Untitled.md".to_string();
    let mut counter = 1;
    while target_dir.join(&filename).exists() {
        filename = format!("Untitled {}.md", counter);
        counter += 1;
    }

    let now = Utc::now().to_rfc3339();
    let meta = NoteMeta {
        title: Some("Untitled".into()),
        tags: vec![],
        created: Some(now.clone()),
        updated: Some(now),
        pinned: false,
    };

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n", frontmatter);

    let full_path = target_dir.join(&filename);
    fs::write(&full_path, &full_content)?;

    let relative_path = full_path
        .strip_prefix(&vault_path)
        .unwrap_or(&full_path)
        .to_string_lossy()
        .to_string();

    Ok(NoteData {
        path: relative_path,
        title: meta.title.unwrap_or_else(|| "Untitled".into()),
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        body: String::new(),
        preview: String::new(),
    })
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

/// Search notes by query string (case-insensitive, matches title and body).
#[tauri::command]
pub async fn search_notes(query: String, title_only: Option<bool>) -> Result<Vec<NoteData>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let query_lower = query.to_lowercase();
    let terms: Vec<&str> = query_lower.split_whitespace().collect();
    
    if terms.is_empty() {
        return Ok(Vec::new());
    }

    let mut scored_results = Vec::new();
    collect_notes_recursive(&vault_path, &vault_path, &terms, &query_lower, title_only.unwrap_or(false), &mut scored_results)?;

    // Sort by score descending, then by modified date
    scored_results.sort_by(|(a_score, a_note), (b_score, b_note)| {
        b_score.cmp(a_score).then_with(|| b_note.updated.cmp(&a_note.updated))
    });

    Ok(scored_results.into_iter().map(|(_, note)| note).collect())
}

/// Recursively collect notes matching a search query.
fn collect_notes_recursive(
    root: &std::path::Path,
    dir: &std::path::Path,
    terms: &[&str],
    full_query: &str,
    title_only: bool,
    results: &mut Vec<(i32, NoteData)>,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_notes_recursive(root, &path, terms, full_query, title_only, results)?;
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path)?;
            let (meta, body) = vault::parse_frontmatter(&content);

            let filename = path
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_default();

            let title = meta.title.filter(|t| !t.is_empty()).unwrap_or_else(|| filename.clone());
            let title_lower = title.to_lowercase();
            let body_lower = body.to_lowercase();
            let tags_lower: Vec<String> = meta.tags.iter().map(|t| t.to_lowercase()).collect();

            // All terms must match somewhere in title, body, or tags
            let mut all_terms_match = true;
            for term in terms {
                let term_matches = if title_only {
                    title_lower.contains(term)
                } else {
                    title_lower.contains(term)
                        || body_lower.contains(term)
                        || tags_lower.iter().any(|t| t.contains(term))
                };
                
                if !term_matches {
                    all_terms_match = false;
                    break;
                }
            }

            if all_terms_match {
                let mut score = 0;

                // Title Matching Tiers
                if title_lower == full_query {
                    score += 100; // Exact match
                } else if title_lower.starts_with(full_query) {
                    score += 80;
                } else if title_lower.contains(full_query) {
                    score += 60;
                } else {
                    // Check if all terms appear in title in any order
                    let all_in_title = terms.iter().all(|t| title_lower.contains(t));
                    if all_in_title {
                        score += 50;
                    }
                }

                // Tag Matching Tiers
                if !title_only {
                    for tag in &tags_lower {
                        if tag == full_query {
                            score += 40;
                        } else if tag.contains(full_query) {
                            score += 30;
                        }
                    }
                }

                // Body Matching
                let mut preview = vault::make_preview(&body);
                if !title_only {
                    if body_lower.contains(full_query) {
                        score += 20;
                        preview = make_context_preview(&body, full_query);
                    } else {
                        // Check individual terms
                        let mut first_match = None;
                        for term in terms {
                            if body_lower.contains(term) {
                                score += 5;
                                if first_match.is_none() {
                                    first_match = Some(*term);
                                }
                            }
                        }
                        if let Some(m) = first_match {
                            preview = make_context_preview(&body, m);
                        }
                    }
                }

                let relative = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();

                results.push((score, NoteData {
                    path: relative,
                    title,
                    tags: meta.tags,
                    created: meta.created,
                    updated: meta.updated,
                    preview,
                    body,
                }));
            }
        }
    }
    Ok(())
}

fn make_context_preview(body: &str, query: &str) -> String {
    let lower = body.to_lowercase();
    let query_lower = query.to_lowercase();
    
    let pos = match lower.find(&query_lower) {
        Some(p) => p,
        None => return vault::make_preview(body),
    };

    let start = if pos > 40 { pos - 40 } else { 0 };
    let end = std::cmp::min(body.len(), pos + 80);
    
    let mut snippet = body[start..end].replace('\n', " ").trim().to_string();
    
    if start > 0 {
        snippet = format!("…{}", snippet.trim_start());
    }
    if end < body.len() {
        snippet = format!("{}…", snippet.trim_end());
    }
    
    if snippet.len() > 140 {
        snippet = format!("{}…", &snippet[..137]);
    }
    
    snippet
}

/// List all unique tags across all notes with their counts.
#[tauri::command]
pub async fn list_tags() -> Result<Vec<TagCount>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let mut tag_map: std::collections::HashMap<String, u32> = std::collections::HashMap::new();

    collect_tags_recursive(&vault_path, &mut tag_map)?;

    let mut tags: Vec<TagCount> = tag_map
        .into_iter()
        .map(|(name, count)| TagCount { name, count })
        .collect();

    tags.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(tags)
}

/// Recursively collect tags from all .md files.
fn collect_tags_recursive(
    dir: &std::path::Path,
    tag_map: &mut std::collections::HashMap<String, u32>,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_tags_recursive(&path, tag_map)?;
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path)?;
            let (meta, _) = vault::parse_frontmatter(&content);
            for tag in meta.tags {
                *tag_map.entry(tag).or_insert(0) += 1;
            }
        }
    }
    Ok(())
}

/// Update the tags for a specific note.
#[tauri::command]
pub async fn update_tags(path: String, tags: Vec<String>) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);

    meta.tags = tags;
    meta.updated = Some(Utc::now().to_rfc3339());

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, body);
    fs::write(&full_path, full_content)?;

    Ok(())
}

/// Rename a note by updating its title in the frontmatter.
#[tauri::command]
pub async fn rename_note(path: String, new_title: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);

    meta.title = Some(new_title);
    meta.updated = Some(Utc::now().to_rfc3339());

    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, body);
    fs::write(&full_path, full_content)?;

    Ok(())
}

/// Duplicate a note, creating a copy of it with " (copy)" appended to its title.
#[tauri::command]
pub async fn duplicate_note(path: String) -> Result<NoteData, AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);

    let curr_title = meta.title.clone().unwrap_or_else(|| {
        full_path.file_stem().map(|s| s.to_string_lossy().to_string()).unwrap_or_default()
    });
    meta.title = Some(format!("{} (copy)", curr_title));
    
    let parent = full_path.parent().unwrap_or(&vault_path);
    let stem = full_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = full_path.extension().unwrap_or_default().to_string_lossy().to_string();
    
    let mut new_filename = format!("{} copy.{}", stem, ext);
    if ext.is_empty() {
        new_filename = format!("{} copy", stem);
    }
    
    let mut counter = 1;
    while parent.join(&new_filename).exists() {
        if ext.is_empty() {
            new_filename = format!("{} copy {}", stem, counter);
        } else {
            new_filename = format!("{} copy {}.{}", stem, counter, ext);
        }
        counter += 1;
    }
    
    let new_full_path = parent.join(&new_filename);
    
    let now = Utc::now().to_rfc3339();
    meta.created = Some(now.clone());
    meta.updated = Some(now.clone());
    
    let frontmatter = vault::build_frontmatter(&meta);
    let full_content = format!("{}\n\n{}", frontmatter, body);
    fs::write(&new_full_path, &full_content)?;
    
    let relative_path = new_full_path.strip_prefix(&vault_path).unwrap_or(&new_full_path).to_string_lossy().to_string();
    
    Ok(NoteData {
        path: relative_path,
        title: meta.title.unwrap(),
        tags: meta.tags,
        created: meta.created,
        updated: meta.updated,
        preview: vault::make_preview(&body),
        body,
    })
}

/// Retrieve all pinned notes as NoteCards (scans the whole vault).
#[tauri::command]
pub async fn get_pinned_notes() -> Result<Vec<NoteCard>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let mut cards = Vec::new();
    collect_note_cards_recursive(&vault_path, &vault_path, &mut cards, |m| m.pinned)?;
    cards.sort_by(|a, b| b.modified.cmp(&a.modified));
    Ok(cards)
}

/// Retrieve up to 12 recently-opened notes as NoteCards (excludes pinned notes).
#[tauri::command]
pub async fn get_recent_notes() -> Result<Vec<NoteCard>, AppError> {
    let vault_path = vault::get_vault_path()?;
    let config = config::load_config()?;
    let mut cards = Vec::new();

    for entry in &config.recents {
        let full_path = vault_path.join(&entry.path);
        if !full_path.exists() {
            continue;
        }
        let content = fs::read_to_string(&full_path)?;
        let (meta, body) = vault::parse_frontmatter(&content);

        if meta.pinned {
            continue;
        }

        let filename = full_path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
        let fs_meta = fs::metadata(&full_path)?;
        let modified = fs_meta.modified().ok().and_then(|t| {
            let dt: chrono::DateTime<Utc> = t.into();
            Some(dt.to_rfc3339())
        });

        cards.push(NoteCard {
            path: entry.path.clone(),
            title,
            tags: meta.tags,
            modified,
            preview: vault::make_preview(&body),
            pinned: false,
        });
    }

    Ok(cards)
}

/// Pin a note by setting `pinned: true` in its frontmatter.
#[tauri::command]
pub async fn pin_note(path: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);
    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }
    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);
    meta.pinned = true;
    let frontmatter = vault::build_frontmatter(&meta);
    fs::write(&full_path, format!("{}\n\n{}", frontmatter, body))?;
    Ok(())
}

/// Unpin a note by removing the `pinned` flag from its frontmatter.
#[tauri::command]
pub async fn unpin_note(path: String) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);
    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }
    let content = fs::read_to_string(&full_path)?;
    let (mut meta, body) = vault::parse_frontmatter(&content);
    meta.pinned = false;
    let frontmatter = vault::build_frontmatter(&meta);
    fs::write(&full_path, format!("{}\n\n{}", frontmatter, body))?;
    Ok(())
}

/// Record that a note was opened, updating the local recents list.
#[tauri::command]
pub async fn record_note_opened(path: String) -> Result<(), AppError> {
    let mut cfg = config::load_config()?;
    config::record_opened(&mut cfg, &path);
    config::save_config(&cfg)?;
    Ok(())
}

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

// ---------------------------------------------------------------------------
// Export commands
// ---------------------------------------------------------------------------

/// Read the raw markdown content of a note (full file including frontmatter).
#[tauri::command]
pub async fn read_note_raw(path: String) -> Result<String, AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_path = vault_path.join(&path);

    if !full_path.exists() {
        return Err(AppError::NotFound(format!("Note not found: {}", path)));
    }

    let content = fs::read_to_string(&full_path)?;
    Ok(content)
}

/// Export a note as a markdown file to the given destination path.
#[tauri::command]
pub async fn export_markdown(
    source_path: String,
    dest_path: String,
    strip_frontmatter: bool,
) -> Result<(), AppError> {
    let vault_path = vault::get_vault_path()?;
    let full_source = vault_path.join(&source_path);

    if !full_source.exists() {
        return Err(AppError::NotFound(format!(
            "Note not found: {}",
            source_path
        )));
    }

    let content = fs::read_to_string(&full_source)?;

    let (meta, body) = vault::parse_frontmatter(&content);
    let filename_fallback = full_source
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let title = meta.title.as_deref().unwrap_or(&filename_fallback);
    
    let mut final_body = body.trim_start().to_string();
    if !final_body.starts_with("# ") {
        final_body = format!("# {}\n\n{}", title, final_body);
    }

    let output = if strip_frontmatter {
        final_body
    } else {
        let frontmatter = vault::build_frontmatter(&meta);
        format!("{}\n\n{}", frontmatter, final_body)
    };

    fs::write(&dest_path, output)?;
    Ok(())
}

/// Export a note as PDF by converting markdown to styled HTML,
/// loading it in a hidden webview, and triggering print-to-PDF.
#[tauri::command]
pub async fn export_pdf(
    app: tauri::AppHandle,
    source_path: String,
    dest_path: String,
    strip_frontmatter: bool,
) -> Result<(), AppError> {
    use pulldown_cmark::{html, Options, Parser};
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    use std::time::{SystemTime, UNIX_EPOCH};

    let vault_path = vault::get_vault_path()?;
    let full_source = vault_path.join(&source_path);

    if !full_source.exists() {
        return Err(AppError::NotFound(format!(
            "Note not found: {}",
            source_path
        )));
    }

    let content = fs::read_to_string(&full_source)?;

    let (meta, body) = vault::parse_frontmatter(&content);
    let filename_fallback = full_source
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();
    let title = meta.title.as_deref().unwrap_or(&filename_fallback);
    
    let mut final_body = body.trim_start().to_string();
    if !final_body.starts_with("# ") {
        final_body = format!("# {}\n\n{}", title, final_body);
    }

    let markdown = if strip_frontmatter {
        final_body
    } else {
        let frontmatter = vault::build_frontmatter(&meta);
        format!("{}\n\n{}", frontmatter, final_body)
    };

    // Parse markdown to HTML
    let options = Options::all();
    let parser = Parser::new_ext(&markdown, options);
    let mut html_body = String::new();
    html::push_html(&mut html_body, parser);

    // Wrap in a styled HTML document with auto-print
    let styled_html = format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {{
  margin: 1in;
  size: A4;
}}
@media print {{
  pre, code {{ page-break-inside: avoid; }}
  h1, h2, h3 {{ page-break-after: avoid; }}
}}
body {{
  font-family: Georgia, "Times New Roman", serif;
  max-width: 680px;
  margin: 0 auto;
  padding: 2rem;
  color: #1a1a1a;
  line-height: 1.7;
  font-size: 14px;
}}
h1 {{ font-size: 2em; margin-top: 1.5em; margin-bottom: 0.5em; }}
h2 {{ font-size: 1.5em; margin-top: 1.3em; margin-bottom: 0.4em; }}
h3 {{ font-size: 1.25em; margin-top: 1.2em; margin-bottom: 0.3em; }}
h4 {{ font-size: 1.1em; margin-top: 1em; margin-bottom: 0.3em; }}
p {{ margin: 0.8em 0; }}
pre {{
  background: #f5f5f5;
  border-radius: 6px;
  padding: 1em;
  overflow-x: auto;
  font-size: 13px;
}}
code {{
  font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace;
  font-size: 0.9em;
}}
pre code {{
  background: none;
  padding: 0;
}}
code:not(pre code) {{
  background: #f0f0f0;
  padding: 0.15em 0.4em;
  border-radius: 3px;
}}
blockquote {{
  border-left: 3px solid #ddd;
  margin: 1em 0;
  padding: 0.5em 1em;
  color: #555;
}}
ul, ol {{ padding-left: 1.5em; }}
li {{ margin: 0.3em 0; }}
hr {{
  border: none;
  border-top: 1px solid #ddd;
  margin: 2em 0;
}}
a {{ color: #2563eb; text-decoration: none; }}
img {{ max-width: 100%; height: auto; }}
table {{
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}}
th, td {{
  border: 1px solid #ddd;
  padding: 0.5em 0.75em;
  text-align: left;
}}
th {{ background: #f5f5f5; font-weight: 600; }}
</style>
</head>
<body>
{html_body}
</body>
</html>"#
    );

    // Create a unique window label
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let label = format!("export-pdf-{}", timestamp);

    use base64::Engine;
    use base64::prelude::BASE64_STANDARD;
    let b64 = BASE64_STANDARD.encode(styled_html.as_bytes());
    let data_url = format!("data:text/html;base64,{}", b64);
    let url = tauri::Url::parse(&data_url)
        .map_err(|e| AppError::Internal(format!("Failed to parse data URL: {}", e)))?;

    // Create hidden window with the HTML content
    let window = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::External(url)
    )
    .visible(false)
    .build()
    .map_err(|e| AppError::Internal(format!("Failed to create print window: {}", e)))?;

    // Wait briefly for content to render, then print to PDF
    // Note: window.print() in Tauri (via wry) delegates to the platform's print machinery.
    window.eval(&format!(r#"
        setTimeout(() => {{
            window.print({{
                destination: "{dest_path}"
            }});
        }}, 500);
    "#)).map_err(|e| AppError::Internal(format!("Failed to execute print script: {}", e)))?;

    Ok(())
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

fn collect_note_cards_recursive(
    root: &std::path::Path,
    dir: &std::path::Path,
    cards: &mut Vec<NoteCard>,
    predicate: impl Fn(&NoteMeta) -> bool + Copy,
) -> Result<(), AppError> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            collect_note_cards_recursive(root, &path, cards, predicate)?;
        } else if name.ends_with(".md") {
            let content = fs::read_to_string(&path)?;
            let (meta, body) = vault::parse_frontmatter(&content);

            if predicate(&meta) {
                let filename = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let title = meta.title.filter(|t| !t.is_empty()).unwrap_or(filename);
                let relative = path
                    .strip_prefix(root)
                    .unwrap_or(&path)
                    .to_string_lossy()
                    .to_string();
                let fs_meta = fs::metadata(&path)?;
                let modified = fs_meta.modified().ok().and_then(|t| {
                    let dt: chrono::DateTime<Utc> = t.into();
                    Some(dt.to_rfc3339())
                });

                cards.push(NoteCard {
                    path: relative,
                    title,
                    tags: meta.tags,
                    modified,
                    preview: vault::make_preview(&body),
                    pinned: meta.pinned,
                });
            }
        }
    }
    Ok(())
}
