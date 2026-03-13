use std::fs;
use crate::error::AppError;
use crate::types::NoteData;
use crate::vault;

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
pub fn collect_notes_recursive(
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
                    id: meta.id.unwrap_or_else(|| relative.clone()),
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

pub fn make_context_preview(body: &str, query: &str) -> String {
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
