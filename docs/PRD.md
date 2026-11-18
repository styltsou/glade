# Glade — Product Requirements Document

**Status:** Current. Replaces the original v1 draft (a fixed `~/.glade` vault with built-in Git sync).
**Stack:** Tauri 2 · React 18 · Vite · TypeScript · Tailwind v4 + shadcn/ui · TipTap 3

## 1. What Glade is

Glade is a fast, calm desktop viewer and editor for the markdown files you already have: a notes folder, the docs of a codebase, a single `.md` file. It opens them where they are. It is not a notes database and does not own your files.

### The pivot

The first version was a note-taking app with its own vault (`~/.glade`), import step, frontmatter bookkeeping and planned Git sync. It is now **file-first**:

| Before | Now |
|---|---|
| Fixed vault at `~/.glade`, notes imported into it | Open any folder or `.md` file in place |
| App-managed frontmatter (`created`, `updated`, ids) | Frontmatter is yours; Glade adds nothing |
| Whole document re-serialized on save | Only what you changed is written back |
| Vaults as a special kind of folder | Folders; "pinned" only affects what Home lists |
| Git sync built in (planned) | Out of scope; use git yourself, Glade reloads external changes |
| Single editor | Tabs and split views, each pane with its own tabs |

## 2. Principles

1. **Files stand on their own.** Nothing is written into a user's folder except the `.md` files being edited. App state (recent and pinned folders, pins, open tabs, scroll, expanded folders) lives in Glade's own config directory, keyed by folder path.
2. **Edit, don't rewrite.** Untouched blocks, frontmatter keys, comments and formatting are saved byte for byte. A save that changes nothing writes nothing.
3. **Open anything, fast.** `glade .`, `glade notes/plan.md`, drag and drop, "Open with Glade", or the Home screen.
4. **Live with other tools.** Changes made by git, editors or sync tools appear automatically. Unsaved edits get a "Keep mine / Load theirs" choice, never a silent overwrite.
5. **Quiet, precise UI.** Sentence-case labels, restrained motion, keyboard-first.

## 3. Target user

Developers, technical writers and people who keep markdown in folders (repos, Obsidian-style folders, docs) and want a pleasant reader/editor without importing or converting anything.

## 4. Features

### Opening and Home
- Open a folder or a single file; one window per root, several windows at once.
- Home lists pinned folders, recent folders and recent files; arrow keys and Enter work without a search box. The `Cmd/Ctrl+O` switcher has a filter. `Cmd/Ctrl+O` switches folder; `Cmd/Ctrl+Shift+H` opens Home.
- Last session is restored on launch. Missing folders offer "Locate" or "Remove".

### Editor
- Rich text (TipTap) that reads and writes plain markdown, plus a raw CodeMirror mode.
- Slash commands, bubble menu, task lists, syntax-highlighted code blocks, Mermaid diagrams, images (served through a read-only `glade-img://` protocol).
- Block handles (`+` and drag grip) on any block, including nested list items; tables with add/remove/move/resize controls; preview rail with heading marks.
- The first H1 is the note title (filename if none); it is shown in the title field and preserved in the file.
- Frontmatter shown as collapsible properties; edits change only the lines touched.
- Per-note read/edit mode, find and replace, table of contents.

### Navigation
- File tree with drag-and-drop, pinned notes, tags (from frontmatter), full-text search, command palette (`Cmd/Ctrl+P`).
- Standard relative markdown links (`[API](../reference/api.md)`), inserted with `@`. Links outside the open folder are marked and open as loose files; broken links offer to create the file; renaming or moving a note offers to update links to it. Backlinks panel.
- Collapsing breadcrumbs with a hover card for hidden segments.

### Tabs and split views
- Compact tabs in the window bar; up to two panes, each with its own tabs. A pane closes when its last tab closes. New tabs show a "new tab" page.
- Tabs restore per folder.

### Appearance and extras
- Themes: Claude, Everforest, Rose Pine, Monochrome, each light and dark, or follow the system.
- Safe deletes (system trash), export to PDF / Markdown / PNG for diagrams.

## 5. Out of scope

- Built-in Git sync, commit history and conflict UI (previously planned; files are plain, use git directly).
- Importing into a managed vault.
- App-specific metadata in notes (ids, timestamps, hidden marker folders).
- Mobile and web builds.

## 6. Open questions

- Git awareness as read-only information (branch, dirty files in the tree) without owning sync.
- Wiki-style `[[links]]` as an optional input that still saves standard relative links.
- A published binary / installer (today: build from source or `bun run install:local` on Linux).

## 7. References

- Architecture: [architecture_overview.md](architecture_overview.md)
- Decisions: [technical_decisions.md](technical_decisions.md)
- File-first change: `openspec/changes/file-first-folders/`
