# Proposal

## Why

Glade owns its notes: they live in `~/.glade/vaults/`, files must be imported to be opened, and the app writes its own metadata (`id`, `pinned`, `created`, `updated`) into every note's frontmatter. That contradicts how people actually keep markdown — scattered across their machine and inside codebases — and makes Glade unsafe to point at a git repo. Glade should be a reader/editor for markdown that already exists, leaving no trace in the files it opens.

## What Changes

- **BREAKING** Remove the "vault" concept. Users open any folder or any `.md` file in place. The vocabulary becomes *folder*, *pinned folder*, and *file*.
- **BREAKING** Notes are no longer stored under `~/.glade/vaults/`. Existing vaults are migrated by pinning them in place (no files move).
- **BREAKING** Remove the Import feature (opening a folder replaces it).
- New Zed-style Home screen: filter box, pinned folders, recent folders, recent files, open actions. Launch restores the previous session's windows; a new window or a closed folder shows Home.
- One window per root folder or loose file; single instance; `glade <path>` CLI; `.md` file association.
- File tree shows only markdown (and the folders containing it), respects `.gitignore`, and always skips `.git`, `node_modules`, `target`.
- All app state (recents, pinned folders, pinned notes, tree state, search index) lives in the app config directory, keyed by folder path. Glade never writes into user folders except to the `.md` files the user edits.
- **BREAKING** Frontmatter policy: Glade never adds frontmatter on its own; stops writing `id`, `pinned`, `created`, `updated`; derives timestamps from the filesystem and the title from `title:` / first H1 / filename; edits only the keys the user changes, line by line, preserving everything else.
- A file is written to disk only when its content actually changed.
- New Properties panel showing frontmatter above the title, collapsible (globally remembered), with format-preserving edits.
- Links resolve relative to the containing file, anywhere on disk. Markdown targets outside the open folder open as loose files; non-markdown targets are revealed, never executed; missing targets render as broken with a Create action.
- @-mentions, search, tags, and backlinks are scoped to the open folder.
- External-change handling: unmodified files reload silently; files with unsaved edits show a conflict banner.
- "Delete vault" becomes "Remove from Glade" (never touches disk); deleting a note moves it to the system trash.

## Capabilities

### New Capabilities
- `folder-workspaces`: Opening folders and loose files in place, windows per root, CLI/file association, markdown-only tree, pinned and recent tracking, where app state is kept, missing paths, removal and deletion semantics, and migration from legacy vaults.
- `home-screen`: The Home view — what it lists, filtering, keyboard navigation, and when it is shown.
- `file-fidelity`: Guarantees about what Glade writes to a markdown file — frontmatter policy, no-op saves, derived title/timestamps.
- `note-properties`: The Properties panel for viewing and editing frontmatter without reformatting it.
- `note-links`: How links resolve, render, and open (inside, outside, missing, non-markdown), link scope for mentions/backlinks, and link maintenance on rename/move.
- `external-change-sync`: Detecting and reconciling changes made to open files and folders by other programs.

### Modified Capabilities
<!-- None: collapsible-pinned-notes and note-read-edit-mode describe UI behavior that is unchanged; only where pin state is stored changes. -->

## Impact

- **Rust backend** (`src-tauri/src`): `vault.rs`, `config.rs`, `types.rs`, and `commands/{vault,note,sidebar,tag,search,import_}.rs` are reworked around absolute root paths instead of vault slugs; `import_.rs` is removed; new modules for workspace state, frontmatter text editing, link rewriting, file watching, and migration.
- **Dependencies**: add a gitignore-aware walker (`ignore`), a file watcher (`notify`), and a trash crate (`trash`); add `tauri-plugin-cli` (or arg parsing in the existing single-instance handler) and file-association config.
- **Frontend** (`src`): `HomeView`, `Sidebar`/`FileTree`, `PinnedSection`, `Breadcrumbs`, `CommandPalette`, `NoteHeader`/`EditableTitle`, `Editor`/`NoteEditor`, link handling in `noteLinking.ts` and `SuggestionExtension.ts`, and the zustand store slices; `ImportDialog` and vault management UI removed.
- **Multi-window**: windows become per-root; Tauri capability files must cover dynamically created windows.
- **Docs**: README, `docs/PRD.md`, `docs/architecture_overview.md` describe the vault model and need rewriting.
- **Users**: existing `~/.glade/vaults` keep working after migration; notes that already contain `id`/`pinned`/`created`/`updated` keys are left as-is unless the user opts into cleanup.
