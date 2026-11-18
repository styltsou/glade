# Spec Delta

## Purpose

Lets users open any folder or markdown file on their machine in place, and keeps track of what they opened without storing anything inside their folders.

## ADDED Requirements

### Requirement: Open a folder in place
The system SHALL let the user open any directory as the root of a window without copying, moving, or importing its files.

#### Scenario: Open folder from dialog
- **WHEN** the user chooses "Open folder" and selects `~/code/api/docs`
- **THEN** a window shows that directory as its root, with its markdown files in the tree
- **AND** no files are created inside `~/code/api/docs`

#### Scenario: Open folder by drag and drop
- **WHEN** the user drops a directory onto the Home screen or an empty window
- **THEN** that directory opens as the window's root

### Requirement: Open a loose file
The system SHALL let the user open a single markdown file without opening its folder, showing the file with no file tree.

#### Scenario: Open a single file
- **WHEN** the user opens `~/Downloads/notes.md`
- **THEN** the file is shown without a file tree
- **AND** the breadcrumb shows the file's full path with an "Open containing folder" action

#### Scenario: Offer repository root
- **WHEN** the opened loose file is inside a git repository
- **THEN** the breadcrumb also offers "Open repository root"

### Requirement: One window per root
The system SHALL show each root folder or loose file in at most one window.

#### Scenario: Reopen an already-open folder
- **WHEN** the user opens a folder that is already open in a window
- **THEN** that window is focused and no new window is created

#### Scenario: Open a file inside an open folder
- **WHEN** the user opens a file whose path is inside a folder already open in a window
- **THEN** that window is focused and the file is shown there

### Requirement: Command-line and OS entry points
The system SHALL accept a folder or file path from the command line and from the OS "Open with" / file association, routing it to a single running instance.

#### Scenario: Launch with a folder path
- **WHEN** the user runs `glade .` in a directory
- **THEN** that directory opens as a root

#### Scenario: Launch with a file path while running
- **WHEN** Glade is running and the user runs `glade README.md`
- **THEN** the running instance opens the file per the one-window-per-root rule and no second process stays alive

#### Scenario: Open from file manager
- **WHEN** the user opens a `.md` file with Glade from the OS file manager
- **THEN** the file opens as if passed on the command line

### Requirement: Markdown-only file tree
The system SHALL show in the tree only markdown files (`.md`, `.mdx`, `.markdown`) and the folders that contain them, directly or in a descendant.

#### Scenario: Folder without markdown
- **WHEN** a subfolder contains only `.ts` files
- **THEN** that subfolder is not shown in the tree

#### Scenario: Nested markdown
- **WHEN** `src/a/b/notes.md` exists and no other markdown is under `src/`
- **THEN** the tree shows `src` → `a` → `b` → `notes.md`

#### Scenario: Empty folder stays visible
- **WHEN** the user creates a new empty folder in the tree
- **THEN** it stays visible until it is deleted, even though it contains no markdown yet

### Requirement: Ignored paths are excluded
The system SHALL exclude from the tree, search, tags, and mentions any path matched by the root's `.gitignore` rules, and always exclude `.git`, `node_modules`, and `target` directories.

#### Scenario: Gitignored markdown
- **WHEN** `.gitignore` contains `dist/` and `dist/notes.md` exists
- **THEN** `dist/notes.md` does not appear in the tree or in search results

#### Scenario: node_modules without gitignore
- **WHEN** the root has no `.gitignore` and contains `node_modules/pkg/README.md`
- **THEN** that file does not appear anywhere in the folder's views

### Requirement: No app data inside user folders
The system SHALL NOT create, modify, or delete any file or directory inside an opened folder except markdown files and folders the user explicitly creates, edits, renames, moves, or deletes.

#### Scenario: Opening and browsing
- **WHEN** the user opens a folder, browses notes, pins a note, and collapses tree nodes
- **THEN** the folder's contents on disk are byte-for-byte unchanged

### Requirement: App state is kept per folder outside the folder
The system SHALL persist per-folder state (pinned notes, expanded tree nodes, last open file, scroll positions, index caches) in the app's own data directory, keyed by the folder's absolute path.

#### Scenario: State survives restart
- **WHEN** the user pins a note in `~/notes`, quits, and reopens `~/notes`
- **THEN** the note is still pinned

#### Scenario: Index cache is disposable
- **WHEN** the folder's cached index is deleted from the app data directory
- **THEN** opening the folder rebuilds it and no user-visible state other than speed is affected

### Requirement: Recent files and folders
The system SHALL record every opened folder and loose file in recent lists, most recent first, without duplicates.

#### Scenario: Reopen moves to top
- **WHEN** the user opens a folder that is already third in Recent folders
- **THEN** it moves to the first position and appears once

### Requirement: Pinned folders
The system SHALL let the user pin and unpin folders; pinning only affects what is listed on the Home screen.

#### Scenario: Pin from sidebar
- **WHEN** the user chooses "Pin folder" in an open folder's sidebar menu
- **THEN** the folder appears under Pinned folders on the Home screen

#### Scenario: Unpinned folder keeps features
- **WHEN** a folder is opened but not pinned
- **THEN** search, tags, mentions, pinned notes, and the tree all work the same as for a pinned folder

### Requirement: Missing paths
The system SHALL mark recent or pinned entries whose path no longer exists, and offer to locate or remove them.

#### Scenario: Folder was moved
- **WHEN** a pinned folder's path no longer exists
- **THEN** the entry appears dimmed with "Locate…" and "Remove" actions

#### Scenario: Locate a moved folder
- **WHEN** the user chooses "Locate…" and selects the folder's new location
- **THEN** the entry points to the new path and the folder's saved state (pinned notes, tree state) is carried over

### Requirement: Removing from Glade never deletes files
The system SHALL provide "Remove from Glade" for recent and pinned entries, which forgets the entry and its saved state without touching the disk.

#### Scenario: Remove a pinned folder
- **WHEN** the user chooses "Remove from Glade" on a pinned folder
- **THEN** it disappears from Home and its saved state is discarded
- **AND** the folder and its files on disk are unchanged

### Requirement: Deleting a note uses the system trash
The system SHALL move deleted notes and folders to the operating system's trash rather than deleting them permanently.

#### Scenario: Delete a note
- **WHEN** the user deletes `ideas.md` and confirms
- **THEN** `ideas.md` is in the OS trash and can be restored from there

### Requirement: Migrate legacy vaults
The system SHALL, on first launch after upgrade, pin each existing `~/.glade/vaults/*` directory in place as a pinned folder without moving files.

#### Scenario: Existing vaults
- **WHEN** the user upgrades with vaults `work` and `personal` under `~/.glade/vaults/`
- **THEN** both appear as pinned folders on Home pointing at their existing paths

#### Scenario: Legacy pinned notes
- **WHEN** a migrated note has `pinned: true` in its frontmatter
- **THEN** it appears as a pinned note in that folder
- **AND** the `pinned` and `id` keys Glade previously wrote are removed from files only if the user accepts the offered cleanup

#### Scenario: Migration runs once
- **WHEN** migration has completed and the app is relaunched
- **THEN** migration does not run again, and folders the user later removed are not re-added
