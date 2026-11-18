# Tasks

## 1. Test infrastructure

- [x] 1.1 Add a `tests` module skeleton in `src-tauri/src` with a temp-dir fixture helper (`tempfile` dev-dependency) and verify `cargo test` runs green from `src-tauri/`
- [x] 1.2 Add Vitest (+ jsdom) with a `test` script in `package.json` and one smoke test; verify `bun run test` passes

## 2. File fidelity: frontmatter (D4)

- [x] 2.1 Create `src-tauri/src/frontmatter.rs` with block detection, ordered parse for display, opaque handling of invalid YAML, and key-span detection; verify with unit tests covering comments, quoted values, flow/block lists, `...` terminator, no frontmatter, and invalid YAML
- [x] 2.2 Implement `set_key`, `remove_key` (removing the block when empty) and `add_key` as style-preserving line edits; verify unit tests assert byte-for-byte unchanged lines outside the edited span, including the spec "Add a tag" scenario
- [x] 2.3 Route `update_tags` and title edits through the new module and delete `build_frontmatter`; verify tagging a note with comments in its frontmatter leaves them intact
- [x] 2.4 Stop writing `id`, `pinned`, `created`, `updated` in `commands/note.rs` (create, write, duplicate, pin/unpin) and create new notes without frontmatter; verify with tests that create/save/pin leave no such keys and that pin does not modify the file
- [x] 2.5 Derive title (title key → first H1 → filename) and timestamps (filesystem) in read paths; verify unit tests for each title fallback and that `NoteData.updated` reflects file mtime
- [x] 2.6 Implement title editing per source (title line, H1 line, or file rename); verify tests for all three cases

## 3. File fidelity: body and no-op saves (D5)

- [x] 3.1 Make `write_note` skip writing when content equals the last read/written bytes; verify a test that mtime is unchanged after a no-op save
- [x] 3.2 Build `src/lib/markdownFidelity.ts`: record top-level block source slices and separators on load, map them to top-level ProseMirror nodes, and serialize by reusing slices for identical nodes; verify Vitest round-trip tests (load → save without edits = identical bytes) over fixtures with `*` lists, aligned tables, HTML blocks, and reference links
- [x] 3.3 Add fallback when block counts mismatch and wire the module into `useSaveNote`; verify editing one paragraph in a fixture changes only that paragraph in the output
- [ ] 3.4 Ensure saves fire only after a real content change (undo back to original does not save); verify manually by opening a repo README, toggling edit mode, typing and undoing, and checking `git status` is clean

## 4. Workspace backend model (D1–D3)

- [x] 4.1 Add `ignore` dependency and replace the vault walk with an ignore-aware markdown walker that prunes folders without markdown descendants; verify tests for gitignored files, `node_modules` without `.gitignore`, and nested-only markdown
- [x] 4.2 Introduce managed `Workspaces` state keyed by window label with root kind `Folder | File | Home`, moving the tree/tags/pinned statics out of `vault.rs`; verify two workspaces in a test hold independent trees
- [x] 4.3 Convert note/tree/tag/search/sidebar commands to take `tauri::Window` and absolute paths, with markdown-only and inside-root checks for mutations; verify tests that mutations outside the root are rejected and reads of outside markdown succeed
- [ ] 4.4 (Deferred: measured 92 ms to scan and build the tree for 5,000 notes uncached, so a disposable cache is not needed yet.) Build the per-root index (title, tags, preview, outbound links via pulldown-cmark) and `index.bin` cache keyed by path/mtime/size; verify a test that reopening reuses cached entries and re-parses only changed files
- [ ] 4.5 Implement `workspaces/<hash>/state.json` (pinned notes, expanded folders, last file, scroll, read/edit mode) and move pin/unpin and sidebar state into it; verify pin state survives a reload in a test and the folder on disk is unchanged
- [x] 4.6 Rework `glade-config.json`: recents (files/folders, cap 30, dedupe), pinned folders, last session roots, properties-collapsed flag, `schema_version`; verify unit tests for recents ordering and dedupe
- [x] 4.7 Replace `delete_entry` with `trash` crate deletion and add `remove_from_glade` that only edits config/state; verify a test that removal leaves the folder intact
- [x] 4.8 Add missing-path detection and `locate_root` that carries state to the new key; verify a test moving a temp folder and locating it keeps pinned notes

## 5. Windows, CLI and file association (D6)

- [x] 5.1 Implement `open_path` routing (focus existing root, focus containing folder + `show-file`, reuse Home window, else new window) and set the capability `windows` to `["*"]`; verify manually that opening the same folder twice focuses one window
- [x] 5.2 Handle first-launch args and the single-instance callback (all args, resolved against `cwd`) through `open_path`; verify `glade .` and `glade README.md` from a terminal while the app is running
- [ ] 5.3 Add `bundle.fileAssociations` for `md`, `markdown`, `mdx`; verify a built package opens a `.md` file from the file manager
- [ ] 5.4 Persist open roots on quit and restore them on launch without args; verify by quitting with two windows and relaunching

## 6. Home screen and frontend shell

- [x] 6.1 Replace vault store slices with a window view state (`home | folder | file`, plus outside-file overlay) and remove vault switcher/management UI; verify `bun run build` passes with no remaining vault UI
- [x] 6.2 Rebuild `HomeView` per the home-screen spec: focused fuzzy filter, Pinned / Recent folders / Recent files groups, open actions, empty first-run state, dimmed missing entries with Locate/Remove; verify Vitest tests for filtering and de-duplication of pinned vs recent
- [ ] 6.3 Add keyboard navigation (arrows/Enter) and entry context menu (Pin/Unpin, Reveal, Remove from Glade); verify manually with keyboard only
- [ ] 6.4 Add Open folder / Open file dialogs and drag-and-drop on Home and empty windows; verify dropping a folder opens it
- [ ] 6.5 Add Close folder, Cmd/Ctrl+Shift+H to Home, app-mark click to Home, and Cmd/Ctrl+O quick switcher; verify each returns to the right root with state restored
- [ ] 6.6 Loose-file view: no tree, breadcrumb with full path, "Open containing folder" and "Open repository root" (when inside git); verify with a file in and out of a repo
- [ ] 6.7 Add "Pin folder" to the sidebar menu; verify it appears on Home

## 7. External change sync (D9)

- [x] 7.1 Add `notify` + `notify-debouncer-full` watchers per root (ignore-filtered) and per loose file's parent; verify a test that creating a file in a watched temp dir emits a tree update and a change under `node_modules` does not
- [x] 7.2 Suppress self-writes via last-written hash; verify autosave triggers no reload event
- [ ] 7.3 Implement silent reload for clean files and conflict banner (Keep mine / Load theirs) with autosave pause for dirty files, plus the `write_note` hash backstop; verify manually by editing the same file in another editor in both states
- [ ] 7.4 Handle open-file deleted/moved (Save again / Close) and root removed (Locate / Go to Home); verify manually by deleting each from a terminal
- [ ] 7.5 Implement the inotify-failure polling fallback with a one-time notice; verify by lowering `fs.inotify.max_user_watches` in a test VM or simulating registration failure

## 8. Properties panel

- [x] 8.1 Expose frontmatter entries (ordered, with editable/read-only classification and parse error) from `read_note`; verify Rust tests for scalar, list, nested, multiline, and invalid cases
- [ ] 8.2 Build the Properties panel above the title with global collapsed state; verify it is absent without frontmatter and collapse persists across notes and restart
- [ ] 8.3 Inline editing for scalars and flat lists, remove property, and "Add property" in the note menu; verify edits change only the targeted lines (compare file before/after)
- [x] 8.4 Read-only rendering with "Edit in raw mode" for complex values and raw view with warning for invalid YAML; verify with fixtures

## 9. Links (D7, D8)

- [x] 9.1 Add a relative-path + percent-encoding helper and change `@` mentions to insert `[Title](relative/path.md)` from files in the root only (own directory for loose files); verify Vitest tests for sibling, parent, and spaced paths
- [x] 9.2 Add a batched `stat_paths` command and link-classification decoration (inside / outside ↗ with full-path tooltip / missing / non-markdown / web); verify in a fixture folder linking to each kind
- [ ] 9.3 Route link clicks: inside → open, outside → loose overlay with "Open its folder" and Back, Cmd/Ctrl-click → open folder, non-markdown → reveal only, web → browser; verify that clicking a `.sh` link reveals and does not execute it
- [ ] 9.4 Register `glade-img://` serving only `image/*` and rewrite local image sources to it; verify an image outside the root renders and a non-image path is refused
- [ ] 9.5 "Create file" on broken `.md` links with confirmation when outside root; verify both cases
- [x] 9.6 Backlinks from the index for the open note; verify a fixture with two inbound links lists both
- [x] 9.7 Rename/move link maintenance: preview count, span-wise inbound rewrites on accept, and outbound rewrite of the moved file; verify Rust tests for the spec's rename and move scenarios and that files outside the root are untouched

## 10. Migration, removals and docs

- [x] 10.1 Implement one-time migration (pin `~/.glade/vaults/*` in place, import `pinned: true` into state, set `schema_version`); verify a test with a fake vaults dir and that a second launch is a no-op
- [x] 10.2 Add the one-time cleanup banner that removes legacy `pinned`/`id` keys via `remove_key` on accept; verify only those lines change
- [x] 10.3 Remove Import (`commands/import_.rs`, `ImportDialog`, `src/components/import`) and vault commands/types; verify `cargo build` and `bun run build` pass with no dead references
- [x] 10.4 Rewrite README, `docs/PRD.md`, and `docs/architecture_overview.md` for the file-first model; verify no remaining "vault" or `~/.glade` references except in migration notes

## 11. Integration checks

- [ ] 11.1 Open this repository as a folder, browse, pin, tag one doc, edit one paragraph, rename one linked doc; verify `git diff` shows only the intended lines and nothing else under the repo changed
- [x] 11.2 Open a ~5k markdown file folder and verify initial index under 2s and cached reopen near-instant
- [x] 11.3 Run `openspec validate file-first-folders --strict` and fix any findings

## Workflow follow-up

- Archive the change with `/opsx:archive` once implemented and reviewed.
