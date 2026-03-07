# Technical Decisions

This document outlines the rationale behind the key technology choices and architectural patterns in Glade.

## Why Tauri v2?

We chose **Tauri** over Electron for several reasons:
- **Security**: Rust's memory safety and Tauri's fine-grained capability system provide a more secure environment for handling user files.
- **Performance**: The binary size is significantly smaller, and the resource consumption (RAM/CPU) is lower because it uses the system's native webview.
- **Rust Ecosystem**: Leveraging the Rust ecosystem for filesystem operations and Git integration provides a robust foundation for a technical tool.

## Why TipTap 2?

**TipTap** was chosen as the editor core because:
- **Headless**: It doesn't force a specific UI, allowing us to build a completely custom, minimal editor interface.
- **Markdown Mapping**: Its schema-based approach allows for a clean mapping between rich text nodes and Markdown tokens, ensuring "no-loss" conversion.
- **Extensibility**: It's built on ProseMirror, making it easy to add custom nodes like wiki-links, task lists, and code blocks with syntax highlighting.

## Why Zustand for State?

We opted for **Zustand** instead of Redux or Context:
- **Simplicity**: Extremely low boilerplate, making it easy to reason about the state of the sidebar, search, and editor.
- **Performance**: High-performance rendering with selective re-renders out of the box.
- **Transient State**: Perfect for managing fast-changing UI states like search queries and panel visibility.

## Local-First & Git-Based Sync

The decision to use standard Markdown files and Git for sync is central to Glade's philosophy:
- **User Ownership**: Notes are just files. If Glade disappears, the user still has their notes and their history.
- **Git Infrastructure**: Git is a mature, world-class versioning system. It handles diffs, history, and synchronization better than any custom-built solution.
- **Interoperability**: Users can edit their notes in VS Code, Obsidian, or even via the terminal, and Glade will pick up the changes.

## Performance Optimization Strategy

To achieve a "blazingly fast" feel on a local-first app, we implemented several key patterns:
- **Background Pre-fetching**: Hovering over note cards or sidebar items triggers a silent fetch of the note content into a memory cache.
- **Optimistic UI Updates**: When a note is clicked, the UI immediately switches to the new view using already-available metadata (title, tags), making the transition feel instantaneous while the body loads in the background.
- **Stale-While-Revalidate**: The home screen displays previously cached notes immediately while refreshing them in the background, eliminating loading skeletons on repeated visits.
- **Zero-Latency Transitions**: All motion overhead (fades, slides) has been removed from core navigation to ensure zero-latency view switching.
