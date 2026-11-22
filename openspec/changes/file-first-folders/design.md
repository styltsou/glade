# Design

## Context

See proposal.md (Why) for motivation and `specs/` for required behavior. The current code assumes one app-owned root:

- **Global active vault.** Commands such as `list_vault`, `read_note` and `search_notes` resolve paths against a single "active vault" from `config.rs`. The tree, tags and pinned caches in `vault.rs` are process-wide statics keyed by that one root, so two windows on different folders can't coexist.
- **Note identity lives in the file.** It's a UUID written into frontmatter (`meta.id` in `commands/note.rs`). `pinned` is a frontmatter key, and `updated` gets cleared and rewritten on save.
- **Frontmatter is rewritten wholesale.** `build_frontmatter` re-serializes the whole block with `serde_yaml`, which reorders keys, drops comments and requotes values.
- **Markdown is reserialized wholesale.** The body round-trips through TipTap + `tiptap-markdown` (markdown-it in, its own serializer out).
- **Some pieces already exist.** The single-instance plugin is installed and forwards `args[1]` as an `open-file` event. There's a single `main` window and one capability file scoped to it.
- **No automated tests** exist on either side.

## Goals / Non-Goals

**Goals:**
- Several windows, each bound to a different root (folder or loose file), all served by one backend.
- Saving touches only the bytes the user changed, in both frontmatter and body.
- Opening a large repo stays fast. Initial index of ~5k markdown files in under 2s, and reopening is near-instant from the cache.

**Non-Goals:**
- Git integration (status, commit, sync). This is unchanged and stays on the roadmap.
- Wikilinks (`[[...]]`) syntax, whether reading or writing it.
- Cross-folder search or a global index spanning several roots.
- Character-perfect preservation *inside* a block the user edited. That block is reserialized in Glade's style.
- Windows/macOS-specific polish beyond what Tauri gives by default, such as Dock menus or Jump Lists.

## Decisions

### D1. Backend state: a workspace per window, looked up by window label
Rust keeps a managed `Workspaces` state, `HashMap<WindowLabel, Workspace>`. Each `Workspace` holds:
- the root kind (`Folder(PathBuf)`, `File(PathBuf)` or `Home`)
- its index
- its persisted state handle

Commands take `window: tauri::Window` and resolve their root from it. The frontend never sends a root. Note paths cross the IPC boundary as **absolute paths**, so loose and outside files work through the same commands. Each command checks that the path is a markdown file. Where the command mutates the tree (create, rename, move, delete), it also checks that the path is inside the window's root, unless the action was one the user confirmed for an outside path, like creating a missing link target.

**Path convention (refined during implementation):** note paths stay relative to the root for files inside it, and are absolute only for files outside it (outside links, loose files). Commands resolve with `root.join(path)`, which already yields the absolute path when given one, so the existing frontend keeps working. Mutations (create, delete, rename, move) accept relative paths only and reject anything that escapes the root; reads and edits accept outside paths only for markdown files.

*Alternative:* pass `root` from the frontend on every call. That was rejected because it's easy to get wrong, and it leaves a single global cache in place.

The process-wide statics in `vault.rs` move into `Workspace`.

### D2. Identity = path; app state keyed by path hash
- **Note identity is its path.** The frontmatter `id` is no longer written. Existing `id` keys are ignored on read.
- **Per-folder state** lives in `<config_dir>/glade/workspaces/<key>/`, where `<key>` is the first 16 hex chars of the SHA-256 of the canonicalized root path. The directory contains:
  - `state.json`: the root path, pinned note paths (relative), expanded folders, last open file, scroll positions and the per-note read/edit mode.
  - `index.bin`: the disposable index cache.
- **"Locate…"** rewrites the stored root and renames the directory to the new key.
- **Renames and moves done in Glade** update the relative paths in `state.json`. External renames that the watcher reports as a rename pair do the same. Otherwise, pins to a vanished path are dropped silently.
- **`glade-config.json`** keeps the global data: the recent files and folders lists (capped at 30 each), pinned folders, the last session's open roots, the Properties panel collapsed flag, theme and sounds, plus a `schema_version` for migration.

*Alternative:* a `.glade/` dir inside each folder, like `.vscode`. Rejected because it breaks the no-trace rule.

*Alternative:* SQLite. Deferred, since JSON plus bincode is enough at this scale.

### D3. Walking and indexing with the `ignore` crate
- **Walk.** `ignore::WalkBuilder` handles `.gitignore`, `.ignore` and global git excludes, plus hard-coded excludes for `.git`, `node_modules` and `target`. It walks in parallel.
- **Index contents.** For each markdown file:
  - mtime and size
  - title (`title:`, then the first H1, then the filename)
  - tags
  - a preview
  - outbound links parsed with `pulldown-cmark` (already a dependency)
- **Cache.** `index.bin` is keyed by path, mtime and size. On open, unchanged entries are reused and changed ones re-parsed.
- **Built from it.** Search, tags, mention suggestions and backlinks are all built from this index.
- **Tree pruning.** A folder that has no markdown descendant is pruned from the tree.

### D4. Frontmatter edits are line-level text edits
A new `frontmatter` module works on the raw text and never re-serializes the whole block.
- **Locating it.** It finds the block: a leading `---` line through the next `---` or `...` line.
- **Parsing for display.** `serde_yaml` parses the block into an ordered map. If parsing fails, the block is treated as opaque and is never edited (this covers the "invalid YAML shown raw" rule).
- **Finding a key's lines.** A key's span is its column-0 `key:` line plus the continuation lines that follow: indented lines or `- ` items.
- **Editing.** An edit replaces only that span. Values are emitted in the original style: a flow list `[a, b]` stays flow, a block list stays block, and quotes are kept if the original was quoted.
- **Adding and removing keys.** Adding a key appends it before the closing fence. Removing the last key deletes the whole block.
- **Who uses it.** Tags (`update_tags`), the Properties panel and title edits all go through this module.
- **What gets removed.** `build_frontmatter`, and the `NoteMeta` fields `id`, `pinned`, `created` and `updated` as write targets.

### D5. Body fidelity: reuse source text for untouched top-level blocks
- **On load.** Markdown is parsed with markdown-it, which `tiptap-markdown` already uses. Each top-level token's `map` gives its line range, and we record the source slice of each top-level block plus the whitespace between blocks.
- **Tracking unchanged blocks.** After `setContent`, we map each top-level ProseMirror node to its slice. ProseMirror nodes are immutable and shared between doc versions, so a top-level node the user didn't touch is the *same object* (`===`) in later docs.
- **On save.** For each top-level node, emit the original slice if the node is identical, otherwise serialize it with `tiptap-markdown`. Blocks are joined with the original separators where both neighbours are unchanged, and a blank line otherwise.
- **No-op saves.** Before writing, the backend compares the new full text with the bytes it last read or wrote. If they're equal, it doesn't write.
- **Where this lives.** It's a frontend module (`lib/markdownFidelity.ts`) used by `useSaveNote`. If source mapping fails, for example on a top-level count mismatch, it falls back to full serialization, but only for a file the user has edited.

*Alternative:* write a custom markdown serializer that matches the input style. Rejected because it's endless work, and it can never be exact.

### D6. Windows, CLI and file association
- **Window labels.** Windows are created with `WebviewWindowBuilder` using labels like `w-<n>`. The capability file's `windows` becomes `["*"]`.
- **Routing a path.** Opening a path goes through one Rust function, `open_path(path)`. It canonicalizes the path, then picks the first match:
  1. A window whose root equals the path: focus it.
  2. A folder window whose root contains the path (when the path is a file): focus it and emit `show-file`.
  3. A window currently on Home: use it.
  4. Otherwise, create a new window.
- **CLI and associations.** Command-line args on first launch and the single-instance callback both call `open_path`, now with all args, resolved against the provided `cwd`. `bundle.fileAssociations` registers `md`, `markdown` and `mdx`. On Linux the packaged binary is already on PATH. On macOS, "Install `glade` command" is a later palette action (see Open Questions).
- **Session restore.** On quit, the open roots are written to config. Launch with no args restores them; if there are none, it shows Home.

### D7. Link handling in the editor
- **Resolving and styling.** A TipTap mark extension decorates link marks by resolving `href` against the current file's directory, using the index plus a batched `stat` command for paths outside the root. The result is one of: `inside`, `outside`, `missing`, `nonMarkdown` or `web`.
- **Clicking.** The click handler routes by that class. `nonMarkdown` calls `opener`'s `reveal_item_in_dir` and never `open_path`.
- **Images.** These come through a custom URI scheme, `glade-img://`, registered in Rust. It serves only files whose MIME type is `image/*` and rejects everything else. This avoids granting the asset protocol broad `$HOME/**` read access.
- **Mentions.** A mention inserts a link mark whose `href` is computed with a relative-path helper, percent-encoding only what markdown or URLs need (non-Latin letters stay readable).
- **Outside files.** An outside file opens as a *loose overlay* in the folder window. That's a view state (`viewing: {kind: 'outside', path}`) and it isn't added to the tree.

### D8. Link maintenance on rename and move
These run in the backend, using the link index from D3.
1. **Inbound links.** Find the files whose outbound links resolve to the old path. The preview tells the user how many links in how many files, and on accept, only the matching URL substrings are rewritten in place: pulldown-cmark offset ranges identify the destination span.
2. **The moved file's own links.** Its relative links are rewritten the same span-wise way.

Both are text edits, so they also honour the file-fidelity rules.

### D9. Watching with `notify` and `notify-debouncer-full`
- **Scope.** There's one recursive watcher per open folder root, with a 300 ms debounce and events filtered through the same ignore matcher. For loose files, the parent directory is watched non-recursively.
- **Ignoring Glade's own saves.** Every save records `(path, sha256)`, and an event whose current content hash matches the last write is dropped.
- **Unsaved edits.** On a change to the open file with unsaved edits, the backend emits `file-conflict`, and the frontend pauses autosave for that path.
- **Before every write.** As a backstop, `write_note` also compares the on-disk hash with the last-known hash. If they differ, it returns a `Conflict` error instead of writing.

### D10. Deletion and migration
- **Deletion.** Delete uses the `trash` crate. "Remove from Glade" only edits config and the workspace directory.
- **Migration.** It runs when `schema_version` is missing:
  1. Each `~/.glade/vaults/*` directory is added as a pinned folder.
  2. Notes with `pinned: true` are recorded in that folder's `state.json`.
  3. On first open of a migrated folder, a one-time banner offers to remove the legacy `pinned` and `id` keys, using the D4 key removal.
  4. `schema_version` is set to `2`.
- **Leftovers.** Nothing in `~/.glade` is moved or deleted.

## Risks / Trade-offs

- **[D5 source mapping drifts from what TipTap parses.]** Some markdown splits into a different number of top-level nodes than markdown-it top-level tokens, for example HTML blocks or front-of-doc edge cases. → Validate that the counts match. If they don't, disable fidelity for that file and fall back to full serialization only after an edit. Add round-trip tests over a corpus of real READMEs.
- **[Frontmatter span detection misreads unusual YAML]** such as multi-document blocks, flow maps spanning lines, or tab indentation. → Any key whose span can't be identified confidently is shown read-only. Edits to other keys still work. Unit-test against tricky fixtures.
- **[Huge roots]**, for example opening `~` or `/`. → The walk is capped at 20k markdown files. Beyond that, show a banner suggesting a narrower folder, and keep the tree lazy beyond depth 3.
- **[The watcher hits Linux inotify limits]** in big repos. → Watch only directories that survive the ignore filter. If registration fails, fall back to polling the open file every 2s and show a one-time notice.
- **[Path-keyed state is lost when folders move outside Glade.]** → Accepted. Missing entries get "Locate…" with state carry-over.
- **[Multi-window raises memory use.]** Each window is a webview. → Accepted. It's the same trade-off VS Code and Zed make.
- **[Outside files and images widen the backend's read surface.]** → Reads are limited to markdown files and `image/*` types. Writes outside the root happen only on an explicit, confirmed user action.
- **[Breaking change for existing users.]** → Migration keeps the vaults in place, and nothing is deleted.

## Migration Plan

1. Ship the fidelity work (D4, D5, and dropping app-owned keys) first. It's independent and makes opening real repos safe.
2. Ship the workspace model, Home, windows and migration together, since the vault UI disappears in that release.
3. **Rollback.** Old builds still find `~/.glade/vaults` untouched. New state lives in new files (`workspaces/`, plus extra keys in `glade-config.json` that old builds ignore via serde defaults). Notes are never rewritten by migration unless the user accepts the cleanup.

## Open Questions

- On macOS, how should the `glade` CLI be exposed: an "Install command" palette action that symlinks into `/usr/local/bin`, or documentation only? This doesn't affect the specs, and it can be decided when packaging for macOS.
- Should the Recent lists cap be user-configurable? Default is 30; it can be decided later.
