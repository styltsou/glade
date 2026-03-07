# Glade

> [!IMPORTANT]
> **Status**: This project is currently **under active development**. The `main` branch may contain incomplete features and minor bugs as it is the primary work-in-progress branch.

A local-first, Git-synced markdown note-taking desktop application built with [Tauri v2](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/).

## Overview

Glade is designed for developers and technical users who want to own their notes as plain files, version-control them automatically, and edit them in a distraction-free rich text environment.

- **Local-first**: Your notes are plain `.md` files stored in `~/.glade/`. No proprietary format, no lock-in.
- **Git as infrastructure**: Version control and sync happen transparently in the background (private GitHub repo).
- **Markdown-native**: Write raw markdown or use the rich text toolbar — both produce the same clean output.

## Features

- 🖋️ **Rich Text Editing** — Powered by [TipTap 2](https://tiptap.dev/) with real-time markdown rendering and a seamless toolbar.
- 📂 **File Tree Organization** — Manage folders and notes in a collapsible, hierarchical sidebar.
- 🏷️ **Tagging System** — YAML frontmatter-based tags with sidebar filtering and auto-complete.
- ⌨️ **Command Palette** — Keyboard-driven navigation and actions (`Cmd/Ctrl + P`) for maximum efficiency.
- 🔍 **Full-Text Search** — Blazing fast search across all notes, powered by the Rust backend.
- 🔄 **Git-Powered Sync** — Transparent background commits and pushes to a private GitHub repository.
- 🌓 **Theming** — Multiple beautiful themes (Clayde, Everforest, Rose Pine) with full dark mode support.
- 📄 **Export & Copy** — Export notes to PDF or Markdown, or copy clean Markdown to your clipboard.
- ⚡ **Blazingly Fast Performance** — Zero-latency navigation with background pre-fetching, intelligent caching, and scroll restoration.

## How It Works (Architecture)

Glade leverages the power of **Tauri v2** to combine a performant Rust backend with a flexible React frontend.

- **Frontend**: Built with React 18, Tailwind CSS v4, and Shadcn/ui for a premium, responsive interface.
- **Backend**: Rust handles the heavy lifting—filesystem operations, Git integration, and full-text search indexing.
- **Local-First**: Notes are stored as standard `.md` files in `~/.glade/`. You own your data.
- **Git Sync**: Your notes are automatically versioned and synced via Git, using GitHub's Device Flow for secure authentication.

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

---

- **Conflict Resolution**: Currently, Git conflicts must be resolved manually if they occur.

## Roadmap

- [ ] **Wiki-style Linking**: `[[Note Name]]` for fast inter-note navigation.
- [ ] **AI-Assisted Writing**: Bring-your-own-key LLM support for summaries and rephrasing.
- [ ] **Slash Commands**: Quick insertion of blocks using `/`.

For the full list of planned features, see the **[Feature Backlog](./docs/feature-backlog.md)**.

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
