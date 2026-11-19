# Glade

> [!IMPORTANT]
> **Status**: This project is currently **under active development**. The `main` branch may contain incomplete features and minor bugs as it is the primary work-in-progress branch.

> [!NOTE]
> **No pre-built binary yet.** Run from source: see [Getting Started](#getting-started) below.

A fast, quiet markdown viewer and editor for the files you already have, built with [Tauri v2](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/).

## Overview

Glade opens markdown where it already lives — in a notes folder, inside a codebase, anywhere on disk — and gives you a clean way to read and edit it. Your files stay yours: Glade keeps its own bookkeeping (recent folders, pins, window state) in its app data directory and never writes anything into your folders except the `.md` files you edit.

- **Open anything**: Open a folder, or a single `.md` file. `glade .`, `glade notes/plan.md`, drag and drop, or "Open with Glade".
- **Files stay clean**: Saving only changes what you edited — untouched blocks, frontmatter keys, comments and formatting are written back byte for byte. No ids, timestamps or other app-specific keys are added to your notes.
- **Git-friendly**: Notes are plain files in ordinary folders, so use git however you like; Glade picks up external changes automatically. Glade does not sync for you.
- **Folders, not vaults**: Nothing to import or convert. Pin the folders you use and they appear on Home.
- **Markdown-native**: Write raw markdown or use the rich text toolbar — both produce the same clean output.

## Features

### ✍️ Editing

- **Rich Text Editing** — Powered by [TipTap 3](https://tiptap.dev/) with real-time markdown rendering, slash commands (`/`), and a floating bubble menu for quick formatting.
- **Mermaid Diagrams** — Write ```` ```mermaid ```` code blocks to render flowcharts, sequence diagrams, Gantt charts, and more. Click a diagram to open it full screen: it stays sharp at any zoom (wheel to zoom, drag to pan, double-click to fit), the code editor is one click away, and **PNG export** renders at 3×.
- **Tables** — Rounded, scrollable tables with hover controls: click or drag the bars at the right and bottom edge to add or remove columns and rows, and drag the grip above a column or beside a row to move it (arrow keys work too).
- **Block handles** — Hover any block, including list items and other nested blocks, for a `+` (click to add below, Alt-click to add above) and a grip to drag it to a new place.
- **Preview rail** — Long notes get a slim rail of heading marks on the left edge; hover it for a clickable outline, or click a mark to jump to that section.
- **Task / Checkbox Lists** — Checkable to-do items within your notes.
- **Code Blocks** — Syntax-highlighted code blocks (all languages via `lowlight`) with a language label and one-click copy button.
- **Images & Links** — Embed images inline; add hyperlinks with click-to-navigate in read mode.
- **Formatting** — Bold, italic, strikethrough, underline, inline code, blockquotes, and horizontal rules.
- **Markdown Shortcuts** — Paste rich text as clean markdown automatically.

### 🔍 Navigation & Discovery

- **File Tree** — Collapsible, hierarchical sidebar with drag-and-drop reorganization.
- **Table of Contents** — Auto-generated from headings (H1–H4), clickable with scroll tracking.
- **Full-Text Search** — Blazing fast search across all notes, powered by the Rust backend.
- **Find & Replace** — `Cmd/Ctrl+F` with support for case-sensitive, whole-word, and regex matching.
- **Command Palette** — `Cmd/Ctrl+K` searches notes (recent first, full text for longer queries); `Tab` switches to grouped actions with their shortcuts, `Backspace` on an empty query switches back. `Cmd/Ctrl+Enter` opens a note in a new tab, `Alt+Enter` beside the current one.
- **@-Mentions** — Type `@` to search and link any note; click mentions in read mode to navigate.
- **Breadcrumbs** — `Folder > Note` path at the top of the editor; loose files show their real path with "Open containing folder".
- **Home** — A keyboard-first start screen listing pinned folders, recent folders and recent files (`Cmd/Ctrl+Shift+H`); `Cmd/Ctrl+O` switches between them.
- **Backlinks** — A "Linked from" list under each note shows which notes link to it.
- **Links** — `@` inserts standard relative markdown links (`[API](../reference/api.md)`) that work on GitHub too. Links to files outside the open folder are marked ↗ and open as loose files; broken links offer to create the file; renaming or moving a note offers to update links to it.
- **Properties** — Frontmatter is shown above the title (collapsible). Edits change only the lines you touch.
- **Live files** — Changes made by other programs (git, editors, sync tools) show up automatically; unsaved edits get a "Keep mine / Load theirs" choice instead of being overwritten.

### 🗂️ Organization

- **Tagging System** — YAML frontmatter-based tags with auto-complete, popularity ranking, and click-to-filter (AND-combinable).
- **Pinned Notes** — Pin important notes to a dedicated section at the top of the sidebar.
- **Pinned Folders** — Pin folders to keep them on the Home screen; every opened folder gets the same features, pinned or not.
- **Tabs & split views** — Compact tabs live in the window bar, one row per pane, with up to two panes. Like VS Code, a note has at most one tab per pane, but the same note can be open in both panes: `Cmd/Ctrl+\` splits by copying the current tab, and what you type in one pane appears in the other. Click a note to open it in the current tab; Ctrl/Cmd-click or middle-click opens a new tab; Alt-click opens it in the other pane. Tabs open and close like a browser's, can be dragged to reorder, and are restored per folder. `Ctrl/Cmd+T` new tab, `Ctrl/Cmd+W` close, `Ctrl/Cmd+Tab` cycle, `Ctrl/Cmd+1–9` jump. Right-click a tab to split, move it to the other pane, or close the others.
- **Read/Edit Mode** — Toggle per-note between editable rich text and read-only view (`Cmd/Ctrl+E`).
- **Raw Markdown Mode** — Switch to a CodeMirror-based raw editor with syntax highlighting (`Cmd/Ctrl+Shift+R`).
- **Editable Titles** — Click the note title to rename inline.

### 💾 Storage & Portability

- **Local-First** — Your notes are plain `.md` files wherever you keep them. No proprietary format, no lock-in.
- **Safe deletes** — Deleting a note moves it to the system trash.
- **Export** — Export notes to PDF, Markdown, or PNG (for diagrams). Option to strip YAML frontmatter. Copy clean Markdown to clipboard.

### 🎨 Appearance

- **Themes** — Glade (neutral, the default), Vercel, Linear, Claude, Vesper, Tokyo Night, Catppuccin, Gruvbox, Everforest and Rosé Pine, each in light and dark (Tokyo Night uses Day/Night, Catppuccin Latte/Mocha), or following the system. All meet WCAG AA contrast. `Cmd/Ctrl+,` opens a theme picker in the command palette that previews each theme as you move through it; the workspace menu has the same choices. There is no settings page.
- **Resizable Panels** — Sidebar, tag panel, pinned section, and table of contents are all resizable and collapsible.

### ⚡ Performance

- Zero-latency navigation with background note prefetching on hover, in-memory caching, scroll position restoration, and optimistic UI updates (rename, move, pin, tag changes apply instantly with rollback on error).

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` (or `P`) | Command palette — search notes; `Tab` switches to actions |
| `Cmd/Ctrl + N` | New note |
| `Cmd/Ctrl + Shift + N` | New folder |
| `Cmd/Ctrl + D` | Delete note / folder |
| `Cmd/Ctrl + F` | Find in note |
| `Cmd/Ctrl + H` | Find & Replace |
| `Cmd/Ctrl + E` | Toggle read / edit mode |
| `Cmd/Ctrl + Shift + R` | Toggle raw markdown mode |
| `Cmd/Ctrl + Shift + T` | Toggle table of contents |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + T` / `W` | New tab / close tab |
| `Cmd/Ctrl + \` | Split right |
| `Cmd/Ctrl + Tab`, `Cmd/Ctrl + 1–9` | Cycle / jump to tabs |
| `Cmd/Ctrl + O` | Open recent |
| `Cmd/Ctrl + Shift + O` / `Alt + O` | Open folder / open file |
| `Cmd/Ctrl + Shift + H` | Home |
| `Cmd/Ctrl + ,` | Change theme or mode |
| `Cmd/Ctrl + S` | Save note |
| `Alt + C` | Search: case-sensitive toggle |
| `Alt + W` | Search: whole-word toggle |
| `Alt + R` | Search: regex toggle |

## How It Works (Architecture)

Glade leverages the power of **Tauri v2** to combine a performant Rust backend with a flexible React frontend.

- **Frontend**: Built with React 18, Tailwind CSS v4, and Shadcn/ui for a premium, responsive interface.
- **Backend**: Rust handles the heavy lifting—filesystem operations, `.gitignore`-aware scanning, file watching, link resolution, and full-text search.
- **Local-First**: Notes are standard `.md` files wherever you keep them. App state lives in Glade's own config directory (`~/.config/glade` on Linux), keyed by folder path.
- **No sync layer**: Version control and sync are left to the tools you already use (git, Syncthing, a cloud drive).

---

## Getting Started

There are no prebuilt downloads yet: you build Glade from source once, and the build produces a normal installed app.

### Windows: build and install

Takes about 15 minutes the first time, most of it downloads and the first compile.

**1. Install the tools** (once):

- **Microsoft C++ Build Tools**: download from <https://visualstudio.microsoft.com/visual-cpp-build-tools/>, run it, tick **"Desktop development with C++"**, and install.
- **Rust**: download and run `rustup-init.exe` from <https://rustup.rs>, and accept the defaults (press Enter).
- **Bun**: open **PowerShell** and run:
  ```powershell
  powershell -c "irm bun.sh/install.ps1 | iex"
  ```
- **Git**: <https://git-scm.com/download/win> (defaults are fine). Or skip Git and use **Code → Download ZIP** on the GitHub page, then unzip it.

WebView2, which Glade uses to draw its window, is already part of Windows 10 and 11.

**2. Build the installer.** Close and reopen PowerShell (so it sees the new tools), then:

```powershell
git clone https://github.com/styltsou/glade.git
cd glade
bun install
bun run tauri build --bundles nsis
```

**3. Install.** The installer is created at:

```text
src-tauri\target\release\bundle\nsis\Glade_0.1.0_x64-setup.exe
```

Run it. Windows will warn that the app is from an unknown publisher (it isn't code-signed): click **More info → Run anyway**. Glade then appears in the Start menu, and `.md` files can be opened with it.

**Updating:** in the `glade` folder run `git pull`, then the same `bun install` and `bun run tauri build --bundles nsis`, and run the new installer. It replaces the old version.

If the build fails with `link.exe not found`, the C++ Build Tools are missing the "Desktop development with C++" workload. If `bun` or `cargo` is not found, open a new PowerShell window.

### Linux: install a local build (no sudo)

Needs [Rust](https://www.rust-lang.org/tools/install), [Bun](https://bun.sh/) and the [Tauri system packages](https://v2.tauri.app/start/prerequisites/#linux). Then:

```bash
bun install
bun run install:local
```

This builds the release binary and installs `glade`, a launcher entry and icons under `~/.local`. The icon follows your system theme (white tile on dark desktops, black on light); force one with `ICON_VARIANT=black` or `ICON_VARIANT=white`. Run it again after changing the app to update the installed version. Use `bun run install:local -- --skip-build` to reinstall the last build.

### Development

```bash
bun install
bun tauri dev
```

## Roadmap

### 📦 Distribution

- [ ] **Prebuilt binaries** — Installers for macOS, Windows and Linux.

### 🔗 Linking & Discovery

- [ ] **Wiki-style links** — Optional `[[Note Name]]` input that saves standard relative links.
- [ ] **Read-only git info** — Branch and changed files in the tree, without owning sync.
- [ ] **Graph view** — Visual note relationship graph.

### 🤖 AI (BYOK)

- [ ] **AI-assisted writing** — Inline suggestions, continue writing, rephrase selection.
- [ ] **Automatic title generation** — Suggest a title based on note content.
- [ ] **Note summaries** — Generate summaries stored in frontmatter.

### 🧩 Editor & UX

- [ ] **Focus mode** — Hide sidebar, center editor, dim surroundings.
- [ ] **Note templates** — Starter templates on new note creation.
- [ ] **Word count & reading time** — Shown with the note.

For the full list, see the **[Feature Backlog](./docs/feature-backlog.md)**.

## Technical Documentation

For a deeper dive into the architecture and technical decisions, check out the **[docs/](./docs/README.md)** directory.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri v2 |
| Frontend | React 18 + TypeScript + Vite |
| Editor | TipTap 3 (ProseMirror) |
| Styling | Tailwind CSS v4 + Shadcn/ui |
| State | Zustand |
| Backend | Rust (2021 edition) |

## License

MIT
