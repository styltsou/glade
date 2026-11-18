/** A vault directory under ~/.glade/vaults/ */
export interface Vault {
  id: string;
  name: string;
  slug: string;
  git_remote: string | null;
  created_at: string;
  last_opened: string;
}

/** A single entry in the vault (file or directory). */
export interface VaultEntry {
  /** Stable UUID for the entry */
  id: string;
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
  /** Creation timestamp (ISO 8601) */
  created_at: string | null;
  /** Tags from frontmatter (only populated for notes) */
  tags: string[];
}

/** Full note data including parsed frontmatter and body. */
export interface NoteData {
  /** Stable UUID */
  id: string;
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
  /** Frontmatter as shown in the Properties panel */
  properties?: Properties;
}

/** One top-level frontmatter key. */
export interface PropertyEntry {
  key: string;
  value: unknown;
  /** Original text of this key's lines */
  raw: string;
  /** False for nested/multi-line/anchored values (read-only in the panel) */
  editable: boolean;
}

export interface Properties {
  /** "none" = no frontmatter block; "invalid" = unparseable, shown as text */
  status: "none" | "invalid" | "ok";
  /** Text between the fences, for "Edit as text" */
  yaml: string;
  entries: PropertyEntry[];
}

export type PropertyValue =
  | { kind: "scalar"; value: string }
  | { kind: "list"; value: string[] };

/** Tag with its usage count. */
export interface TagCount {
  name: string;
  count: number;
}

/** Lightweight note representation for the home view grid. */
export interface NoteCard {
  id: string;
  path: string;
  title: string;
  tags: string[];
  modified: string | null;
  preview: string;
  pinned: boolean;
}

/** Note result for command palette search. */
export interface NoteSearchResult {
  id: string;
  title: string;
  path: string;
  preview?: string;
  tags: string[];
}

/** What a window shows: an opened folder or a single loose file (null = Home). */
export interface Target {
  kind: "folder" | "file";
  /** Absolute path */
  path: string;
}

/** One row on the Home screen. */
export interface HomeEntry {
  path: string;
  name: string;
  /** False when the path no longer exists on disk. */
  exists: boolean;
}

export interface HomeData {
  pinned_folders: HomeEntry[];
  recent_folders: HomeEntry[];
  recent_files: HomeEntry[];
}
