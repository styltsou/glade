use std::fs;
use crate::error::AppError;
use crate::vault;

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
