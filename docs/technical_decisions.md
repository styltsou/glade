# Technical Decisions

Rationale for the key choices in Glade.

## Why Tauri v2?

- **Security**: Rust's memory safety and Tauri's capability system suit an app that reads and writes user files.
- **Footprint**: Small binary and low RAM/CPU use, thanks to the system webview.
- **Rust ecosystem**: Fast `.gitignore`-aware scanning, file watching and search in the backend.

## Why TipTap (ProseMirror)?

- **Headless**: A fully custom, minimal editor UI.
- **Markdown mapping**: A schema-based mapping between rich text and markdown.
- **Extensible**: Custom nodes (Mermaid, tables with controls, block handles). We pin `@tiptap/core` and `@tiptap/pm` to one version and patch the drag-handle package so nested blocks (list items) work.

## Why Zustand?

Minimal boilerplate, selective re-renders, and a good fit for fast-changing UI state. State is split into slices (workspace, tabs, home, notes, UI).

## File-first, not vault-first

Glade used to own a vault in `~/.glade`. It now opens files where they live:

- **User ownership**: If Glade disappears, nothing about your files has changed. No marker directories, no injected ids or timestamps.
- **Interoperability**: Notes stay editable from VS Code, Obsidian, git or the terminal; Glade reloads external changes.
- **Per-folder state outside the folder**: Pins, open tabs, scroll and expanded folders live in Glade's config directory (`~/.config/glade/workspaces/<hash>/state.json` on Linux), keyed by a hash of the folder path. `GLADE_CONFIG_DIR` overrides the location (used by tests).
- **One window per root**: Each window has its own workspace; commands resolve their root from the calling window.

## Format-preserving saves

Re-serializing a document rewrites formatting the user never touched. Instead:

- The editor remembers the original text of each top-level block (`lib/markdownFidelity.ts`); unchanged blocks are written back as-is, and only edited blocks are re-serialized.
- Frontmatter is edited at line level (`frontmatter.rs`); a save that changes nothing writes nothing.
- Trailing blank lines map to empty paragraphs, so pressing Enter at the end of a note survives a save.
- Writes are refused if the file changed on disk since it was read, and the editor offers "Keep mine / Load theirs".

## No built-in Git sync

Earlier plans included automatic commits and GitHub sync. Because files are plain and live in ordinary folders, users can already use git as they like, and the watcher picks up changes. Owning sync would reintroduce the app-specific state this design avoids.

## Tabs and panes as plain data

Tab state (`lib/tabs.ts`) is a pure data model: up to two panes, each with its own tabs and active tab, all operations returning new state. This keeps behavior easy to unit test and to persist per folder.

## Performance

- Background prefetch of notes on hover, an in-memory note cache, and scroll restoration.
- Optimistic updates (rename, move, pin, tag changes) with rollback on error.
- Restrained motion: keyboard actions and high-frequency surfaces do not animate; interactions use short, interruptible transitions.

## Color tokens and themes

All colors come from `src/styles/tokens.css`:

- A 12-step grey scale per mode, where each step has one job (1 app background, 2 subtle surfaces, 3–5 element states, 6–8 borders, 9–10 solids, 11–12 text). Light and dark use the same step for the same role, so they stay consistent.
- Semantic tokens (`--background`, `--muted-foreground`, `--border`, ...) map roles onto steps. Components use only these.
- A theme (`src/styles/themes/*.css`) sets only knobs: tint hue and saturation, a separate ink hue for text, how far surfaces sink (light) or lift (dark), a brand color, and optional syntax colors. The default "Glade" theme is neutral grey with a black/white brand and has no theme file.

The tokens apply to any element with `data-theme` and `data-mode`, so the settings cards render each theme live. Every built-in theme meets WCAG AA for body, sidebar and muted text in both modes.
