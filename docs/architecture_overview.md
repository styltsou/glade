# Architecture Overview

Glade is a cross-platform desktop application built with **Tauri v2**. It is a viewer and editor for markdown files that already exist on disk: the user's files are the source of truth, and Glade stores only its own bookkeeping elsewhere.

## High-Level Diagram

```mermaid
graph TD
    User((User))
    Webview[Tauri Webview - React/TS]
    Core[Tauri Core - Rust]
    Files[(Any folder or .md file)]
    State[(App data dir - recents, pins, window state)]

    User -->|Interacts| Webview
    Webview -->|IPC: invoke / events| Core
    Core -->|Read, edit only what changed| Files
    Files -.->|Watcher: external changes| Core
    Core -->|Own bookkeeping| State
```

## Principles

- **Files stand on their own.** Glade never writes into a user's folder except the `.md` files being edited. No `.glade` marker directories, no ids or timestamps injected into frontmatter.
- **Edit, don't rewrite.** Saving writes only what changed: frontmatter edits replace just the lines of one key; untouched body blocks are written back as their original text; a save that changes nothing writes nothing.
- **Folders, not vaults.** Any folder can be opened; "pinned" only controls what Home lists. Every opened folder gets the same features.

## Backend (Rust, `src-tauri/src`)

| Module | Responsibility |
|---|---|
| `workspace.rs` | What each window shows (a folder, a loose file, or Home). Commands resolve their root from the calling window, so several windows can show different folders. Also path guards: mutations must stay inside the root; reads/edits outside it are markdown-only. |
| `launch.rs` | `open_path` routing for the CLI, OS file association, Home and the switcher: one window per root, idle Home windows are reused, the last session is restored on launch. |
| `workspace_state.rs` | Per-folder state (pinned notes, ...) in the app data dir, keyed by a hash of the folder path. |
| `config.rs` / `migration.rs` | Global app config (recent and pinned folders, session roots) and the one-time upgrade from legacy `~/.glade/vaults`. |
| `vault.rs` | `.gitignore`-aware scanner (always skips `.git`, `node_modules`, `target`), tree building, note cards. |
| `frontmatter.rs` | Format-preserving frontmatter: parse for display, line-level set/remove of a key, derived title and tags. |
| `links.rs` | Relative link resolution and classification, backlinks, and rewriting links when a note is renamed or moved. |
| `watch.rs` | File watching with self-write suppression (content hashes) and the "changed behind your back" check that backs the conflict banner. |
| `commands/*` | The IPC surface. |

## Frontend (React/TypeScript, `src`)

- **Editor**: TipTap rendering markdown. `lib/markdownFidelity.ts` remembers the original text of each top-level block so unedited blocks are saved byte for byte.
- **State**: Zustand slices; `workspaceSlice` holds what the window shows (Home / folder / file) and Home data.
- **Links**: `LinkBehavior` marks links (outside folder, broken, reveal-only files) and routes clicks; images load through a `glade-img://` protocol that serves images only.

## Data Flow: Saving a Note

1. The editor's top-level blocks are compared with those loaded; unchanged blocks keep their source text.
2. The frontend sends the new body to `write_note`.
3. The backend re-attaches the file's existing frontmatter text verbatim, and skips the write if the result is byte-identical.
4. If the file changed on disk since Glade last read it, the write is refused (`Conflict`) and the editor offers "Keep mine" / "Load theirs".
5. The write is recorded by content hash so the watcher does not report it as an external change.
