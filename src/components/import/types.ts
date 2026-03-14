export interface ImportedFile {
  relative_path: string;
  name: string;
}

export interface ImportSource {
  root_path: string;
  files: ImportedFile[];
  total_count: number;
}

export interface ImportSourceWithConflicts extends ImportSource {
  conflicts: ImportedFile[];
  broken_links: BrokenLink[];
}

export interface BrokenLink {
  file_relative_path: string;
  link_target: string;
}

export type ConflictAction = "skip" | "replace" | "keep_both";

export interface FolderNode {
  name: string;
  path: string;
  isDir: boolean;
  children: FolderNode[];
  fileCount?: number;
}

export type ImportStep = "pick" | "preview" | "conflicts";
export type VaultTarget = "existing" | "new";
