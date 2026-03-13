use serde::{Deserialize, Serialize};

pub const MAX_RECENTS: usize = 6;
pub const PREVIEW_LENGTH: usize = 120;

/// A vault directory under ~/.glade/vaults/
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vault {
    pub id: String,
    pub name: String,
    pub slug: String,
    pub git_remote: Option<String>,
    pub created_at: String,
    pub last_opened: String,
}

/// A single entry in the vault (file or directory).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEntry {
    /// Stable UUID for the entry
    pub id: String,
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
    /// Tags from frontmatter (only populated for notes)
    pub tags: Vec<String>,
}

/// Full note data including parsed frontmatter and body.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteData {
    /// Stable UUID
    pub id: String,
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
    pub id: Option<String>,
    pub title: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub created: Option<String>,
    pub updated: Option<String>,
    #[serde(default)]
    pub pinned: bool,
}

/// A lightweight card representation used in the home view.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteCard {
    /// Stable UUID
    pub id: String,
    /// Relative path from vault root
    pub path: String,
    /// Title from frontmatter (falls back to filename)
    pub title: String,
    /// Tags from frontmatter
    pub tags: Vec<String>,
    /// Last modified timestamp (ISO 8601)
    pub modified: Option<String>,
    /// Short preview of the body
    pub preview: String,
    /// Whether the note is pinned
    pub pinned: bool,
}

/// The persistent sidebar UI state.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SidebarState {
    pub collapsed: bool,
    pub tags_collapsed: bool,
    pub width: u32,
    pub tags_height: u32,
    /// One of: "name-asc", "name-desc", "modified"
    pub sort: String,
    /// Folder paths that are currently expanded in the sidebar
    #[serde(default)]
    pub expanded_folders: Vec<String>,
}

impl Default for SidebarState {
    fn default() -> Self {
        Self {
            collapsed: false,
            tags_collapsed: true,
            width: 260,
            tags_height: 200,
            sort: "name-asc".to_string(),
            expanded_folders: Vec::new(),
        }
    }
}

/// The full local app config (not synced to Git).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppConfig {
    #[serde(default)]
    pub vaults: Vec<Vault>,
    pub active_vault_id: Option<String>,
    #[serde(default)]
    pub recents: Vec<String>,
    #[serde(default)]
    pub sidebar: SidebarState,
}

/// Tag with its usage count across all notes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TagCount {
    pub name: String,
    pub count: u32,
}
