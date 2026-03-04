use serde::{Deserialize, Serialize};

/// A single entry in the vault (file or directory).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    /// Display name (filename without extension for notes)
    pub name: String,
    /// Relative path from vault root (e.g. "work/meetings.md")
    pub path: String,
    /// Whether this is a directory
    pub is_dir: bool,
    /// Child entries (only populated for directories)
    pub children: Vec<VaultEntry>,
    /// Last modified timestamp (ISO 8601)
    pub modified: Option<String>,
}

/// Full note data including parsed frontmatter and body.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteData {
    /// Relative path from vault root
    pub path: String,
    /// Title from frontmatter (falls back to filename)
    pub title: String,
    /// Tags from frontmatter
    pub tags: Vec<String>,
    /// Created timestamp (ISO 8601)
    pub created: Option<String>,
    /// Updated timestamp (ISO 8601)
    pub updated: Option<String>,
    /// Markdown body (everything after frontmatter)
    pub body: String,
    /// Short preview of the body (first ~100 chars)
    pub preview: String,
}

/// Frontmatter metadata parsed from a note.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NoteMeta {
    pub title: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created: Option<String>,
    pub updated: Option<String>,
}

/// Tag with its usage count across all notes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagCount {
    pub name: String,
    pub count: u32,
}
