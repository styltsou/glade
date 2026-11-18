# Spec Delta

## Purpose

Keeps Glade's views consistent with files and folders that other programs (editors, git, sync tools) change while they are open.

## ADDED Requirements

### Requirement: Tree reflects external changes
The system SHALL update the file tree, search, tags, and mention suggestions within 2 seconds when markdown files or folders inside the open root are created, deleted, renamed, or moved by another program.

#### Scenario: File added by git
- **WHEN** `git pull` adds `notes/new.md` to the open root
- **THEN** `new.md` appears in the tree without user action

#### Scenario: Ignored change
- **WHEN** a file under `node_modules/` changes
- **THEN** no tree update or re-index is triggered

### Requirement: Silent reload of unmodified files
When the open file changes on disk and the user has no unsaved edits, the system SHALL reload it in place, keeping scroll position as close as possible.

#### Scenario: External edit while reading
- **WHEN** the user is reading `plan.md` and another editor saves a change to it
- **THEN** the new content is shown without a prompt

### Requirement: Conflict banner for unsaved edits
When the open file changes on disk while the user has unsaved edits, the system SHALL stop autosaving that file and show a banner offering "Keep mine" (overwrite disk) or "Load theirs" (discard local edits).

#### Scenario: Concurrent edit
- **WHEN** the user has unsaved edits to `plan.md` and another program writes `plan.md`
- **THEN** a conflict banner appears and the file on disk is not overwritten until the user chooses

#### Scenario: Keep mine
- **WHEN** the user chooses "Keep mine"
- **THEN** the editor's content is written to disk and autosave resumes

### Requirement: Open file deleted or moved externally
When the open file is deleted or moved by another program, the system SHALL keep its content in the editor and show a banner offering to save it again or close it.

#### Scenario: File deleted
- **WHEN** the open `plan.md` is deleted by another program
- **THEN** the editor keeps the content, shows "This file was deleted", and offers "Save again" and "Close"

### Requirement: Own writes are not reported as external
The system SHALL NOT treat its own saves as external changes.

#### Scenario: Autosave
- **WHEN** Glade autosaves `plan.md`
- **THEN** no reload or conflict banner is triggered

### Requirement: Root folder removed
When the open root folder is deleted or moved, the system SHALL show a message in that window with "Locate…" and "Go to Home" actions.

#### Scenario: Root deleted
- **WHEN** the open root directory is deleted
- **THEN** the window shows that the folder is no longer available, with "Locate…" and "Go to Home"
