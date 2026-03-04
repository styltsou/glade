/** A single entry in the vault (file or directory). */
export interface VaultEntry {
  /** Display name (filename without extension for notes) */
  name: string;
  /** Relative path from vault root (e.g. "work/meetings.md") */
  path: string;
  /** Whether this is a directory */
  is_dir: boolean;
  /** Child entries (only populated for directories) */
  children: VaultEntry[];
  /** Last modified timestamp (ISO 8601) */
  modified: string | null;
}

/** Full note data including parsed frontmatter and body. */
export interface NoteData {
  /** Relative path from vault root */
  path: string;
  /** Title from frontmatter (falls back to filename) */
  title: string;
  /** Tags from frontmatter */
  tags: string[];
  /** Created timestamp (ISO 8601) */
  created: string | null;
  /** Updated timestamp (ISO 8601) */
  updated: string | null;
  /** Markdown body (everything after frontmatter) */
  body: string;
  /** Short preview of the body */
  preview: string;
}

/** Tag with its usage count. */
export interface TagCount {
  name: string;
  count: number;
}

/** Lightweight note representation for the home view grid. */
export interface NoteCard {
  path: string;
  title: string;
  tags: string[];
  modified: string | null;
  preview: string;
  pinned: boolean;
}

export type SortMode = "name-asc" | "name-desc" | "modified";

/** Persistent sidebar UI state. */
export interface SidebarState {
  collapsed: boolean;
  sort: SortMode;
}
