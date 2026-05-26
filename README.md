# Glade

> [!IMPORTANT]
> **Status**: This project is currently **under active development**. The `main` branch may contain incomplete features and minor bugs as it is the primary work-in-progress branch.

> [!NOTE]
> **No pre-built binary yet.** Run from source: see [Getting Started](#getting-started) below.

A local-first, markdown note-taking desktop application built with [Tauri v2](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/).

## Overview

Glade is designed for developers and technical users who want to own their notes as plain files and edit them in a distraction-free rich text environment.

- **Local-first**: Your notes are plain `.md` files stored in `~/.glade/`. No proprietary format, no lock-in.
- **Git-ready**: Notes are plain files — a `.git` repo and remote sync are on the roadmap.
- **Markdown-native**: Write raw markdown or use the rich text toolbar — both produce the same clean output.

## Features

### ✍️ Editing

- **Rich Text Editing** — Powered by [TipTap 2](https://tiptap.dev/) with real-time markdown rendering, slash commands (`/`), and a floating bubble menu for quick formatting.
- **Mermaid Diagrams** — Write ```` ```mermaid ```` code blocks to render flowcharts, sequence diagrams, Gantt charts, and more. Dedicated full-screen editor with live preview, zoom, and **PNG export**.
- **Tables** — Full table support with insert, delete, and (optionally) header rows.
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
- **Command Palette** — `Cmd/Ctrl+P` for keyboard-driven navigation and actions.
- **@-Mentions** — Type `@` to search and link any note; click mentions in read mode to navigate.
- **Breadcrumbs** — `Vault > Folder > Note` path at the top of the editor.

### 🗂️ Organization

- **Tagging System** — YAML frontmatter-based tags with auto-complete, popularity ranking, and click-to-filter (AND-combinable).
- **Pinned Notes** — Pin important notes to a dedicated section at the top of the sidebar.
- **Multi-Vault Support** — Create, rename, delete, and switch between multiple vaults.
- **Read/Edit Mode** — Toggle per-note between editable rich text and read-only view (`Cmd/Ctrl+E`).
- **Raw Markdown Mode** — Switch to a CodeMirror-based raw editor with syntax highlighting (`Cmd/Ctrl+Shift+R`).
- **Editable Titles** — Click the note title to rename inline.

### 💾 Storage & Portability

- **Local-First** — Notes stored as plain `.md` files in `~/.glade/`. No proprietary format, no lock-in.
- **Import** — Import `.md` files and folders from your filesystem with conflict detection (skip / replace / keep both) and broken-link analysis.
- **Export** — Export notes to PDF, Markdown, or PNG (for diagrams). Option to strip YAML frontmatter. Copy clean Markdown to clipboard.

### 🎨 Appearance

- **Themes** — Claude, Everforest, Rose Pine, and Monochrome — each with light and dark variants. Toggle between light, dark, or system-follow mode.
- **Resizable Panels** — Sidebar, tag panel, pinned section, and table of contents are all resizable and collapsible.

### ⚡ Performance

- Zero-latency navigation with background note prefetching on hover, in-memory caching, scroll position restoration, and optimistic UI updates (rename, move, pin, tag changes apply instantly with rollback on error).

### 🎵 Extras

- **Ambient Sounds** — Built-in rain, white noise, and people sounds with individual volume controls and a master toggle in the status bar.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + P` | Command Palette |
| `Cmd/Ctrl + N` | New note |
| `Cmd/Ctrl + F` | New folder (no note open) / Find in note (editor) |
| `Cmd/Ctrl + H` | Find & Replace |
| `Cmd/Ctrl + E` | Toggle read / edit mode |
| `Cmd/Ctrl + Shift + R` | Toggle raw markdown mode |
| `Cmd/Ctrl + Shift + T` | Toggle table of contents |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + ,` | Settings |
| `Cmd/Ctrl + S` | Save note |
| `Cmd/Ctrl + D` | Delete note / folder |
| `Alt + C` | Search: case-sensitive toggle |
| `Alt + W` | Search: whole-word toggle |
| `Alt + R` | Search: regex toggle |

## How It Works (Architecture)

Glade leverages the power of **Tauri v2** to combine a performant Rust backend with a flexible React frontend.

- **Frontend**: Built with React 18, Tailwind CSS v4, and Shadcn/ui for a premium, responsive interface.
- **Backend**: Rust handles the heavy lifting—filesystem operations, import scanning, and full-text search indexing.
- **Local-First**: Notes are stored as standard `.md` files in `~/.glade/`. You own your data.
- **Git (planned)**: Automatic versioning and remote sync via Git is on the roadmap.

---

## Getting Started

### Prerequisites

- **Rust**: [Install Rust](https://www.rust-lang.org/tools/install)
- **Node.js / Bun**: [Install Bun](https://bun.sh/) (recommended) or Node.js
- **Git**: Ensure Git is installed and configured on your system.

### Installation & Run

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/glade.git
   cd glade
   ```

2. **Install dependencies**
   ```bash
   bun install
   # or
   npm install
   ```

3. **Run in Development Mode**
   ```bash
   bun tauri dev
   # or
   npm run tauri dev
   ```

4. **Build for Production**
   ```bash
   bun tauri build
   # or
   npm run tauri build
   ```

## Roadmap

### 🔄 Sync

- [ ] **Git-powered sync** — Automatic background commits, GitHub OAuth Device Flow, remote push/pull, sync status indicator.
- [ ] **Conflict resolution UI** — Visual merge conflict resolution (currently manual via CLI).

### 🔗 Linking & Discovery

- [ ] **Wiki-style links** — `[[Note Name]]` for fast inter-note navigation.
- [ ] **Backlinks panel** — See which notes link to the current note.
- [ ] **Graph view** — Visual note relationship graph.

### 🤖 AI (BYOK)

- [ ] **AI-assisted writing** — Inline suggestions, continue writing, rephrase selection.
- [ ] **Automatic title generation** — Suggest a title based on note content.
- [ ] **Note summaries** — Generate summaries stored in frontmatter.

### 🧩 Editor & UX

- [ ] **Focus mode** — Hide sidebar, center editor, dim surroundings.
- [ ] **Note templates** — Starter templates on new note creation.
- [ ] **Word count & reading time** — Status bar display.

For the full list, see the **[Feature Backlog](./docs/feature-backlog.md)**.

## Technical Documentation

For a deeper dive into the architecture and technical decisions, check out the **[docs/](./docs/README.md)** directory.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Tauri v2 |
| Frontend | React 18 + TypeScript + Vite |
| Editor | TipTap 2 (ProseMirror) |
| Styling | Tailwind CSS v4 + Shadcn/ui |
| State | Zustand |
| Backend | Rust (2021 edition) |

## License

MIT
