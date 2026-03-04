# Glade

A local-first, Git-synced markdown note-taking desktop application built with [Tauri v2](https://tauri.app/), [React](https://react.dev/), and [Rust](https://www.rust-lang.org/).

> **Status**: In Development — Local-first markdown editing with Git synchronization.

## Overview

Glade is designed for developers and technical users who want to own their notes as plain files, version-control them automatically, and edit them in a distraction-free rich text environment.

- **Local-first**: Your notes are plain `.md` files stored in `~/.glade/`. No proprietary format, no lock-in.
- **Git as infrastructure**: Version control and sync happen transparently in the background (private GitHub repo).
- **Markdown-native**: Write raw markdown or use the rich text toolbar — both produce the same clean output.

## Features

- 🖋️ **Rich Text Editing** — Powered by [TipTap 2](https://tiptap.dev/) with real-time markdown rendering.
- 📂 **File Tree Organization** — Manage folders and notes in a collapsible sidebar.
- 🏷️ **Tagging System** — YAML frontmatter-based tags with sidebar filtering.
- ⌨️ **Command Palette** — Keyboard-driven navigation and actions (`Cmd/Ctrl + P`).
- 🔍 **Full-Text Search** — Fast search across all notes, performed on the Rust backend.
- 🔄 **Auto-Sync** — Transparent background commits and pushes to GitHub.
- 🌓 **Mode Support** — Clean light and dark modes with a focus on typography and calmness.

## Quick Start

```bash
# Prerequisites: Rust, Node.js (or Bun), Git installed

# Install frontend dependencies
bun install      # or: npm install

# Run in dev mode (launches Tauri window + Vite HMR)
bun tauri dev    # or: npm run tauri dev

# Build for production
bun tauri build  # or: npm run tauri build
```

## Documentation

- **[PRD.md](./PRD.md)** — Comprehensive Product Requirements Document.
- **[feature-backlog.md](./feature-backlog.md)** — Current status and upcoming features.

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
