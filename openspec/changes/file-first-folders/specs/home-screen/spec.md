# Spec Delta

## Purpose

Gives users a keyboard-first starting point that lists the folders and files they work with and lets them open new ones.

## ADDED Requirements

### Requirement: Home screen content
The Home screen SHALL show, in order: a filter input, Pinned folders, Recent folders, Recent files, and actions (Open folder, Open file) with their keyboard shortcuts.

#### Scenario: Populated Home
- **WHEN** the user has 2 pinned folders, 5 recent folders, and 4 recent files
- **THEN** Home shows each group under its heading with entries showing the name and a home-shortened path (e.g. `~/code/glade/docs`)

#### Scenario: Pinned folder not repeated
- **WHEN** a folder is both pinned and recent
- **THEN** it is listed only under Pinned folders

#### Scenario: First run
- **WHEN** there are no pinned or recent entries
- **THEN** Home shows only the filter and the open actions, with a short hint to open a folder or file

### Requirement: Filter and keyboard navigation
The Home screen SHALL focus the filter on display, filter all listed entries by fuzzy match on name and path, and allow selecting and opening an entry with arrow keys and Enter.

#### Scenario: Type to filter
- **WHEN** Home is shown and the user types `gla`
- **THEN** only entries whose name or path fuzzy-match `gla` remain, and the first is highlighted

#### Scenario: Open with Enter
- **WHEN** an entry is highlighted and the user presses Enter
- **THEN** that folder or file opens per the one-window-per-root rule

### Requirement: Entry actions
Each Home entry SHALL offer Pin/Unpin, Reveal in file manager, and Remove from Glade via context menu.

#### Scenario: Unpin from Home
- **WHEN** the user right-clicks a pinned folder and chooses Unpin
- **THEN** it moves to Recent folders

### Requirement: When Home is shown
The system SHALL restore the previous session's windows on launch without arguments, and SHALL show Home when there is nothing to restore, when a new empty window is opened, or when the user closes the folder or file in a window.

#### Scenario: Launch restores session
- **WHEN** the user quit with `~/notes` and `~/code/api` open in two windows and relaunches with no arguments
- **THEN** both windows reopen on their folders

#### Scenario: Launch with nothing to restore
- **WHEN** the user launches with no arguments and the last session had no open roots
- **THEN** a window shows Home

#### Scenario: Close folder
- **WHEN** the user chooses "Close folder" in a window
- **THEN** that window shows Home

#### Scenario: Launch with a path
- **WHEN** the user launches with `glade ~/notes`
- **THEN** `~/notes` opens and the previous session is not restored

### Requirement: Home is always reachable
The system SHALL let the user switch the current window to Home from any root via a keyboard shortcut (Cmd/Ctrl+Shift+H) and by clicking the app mark in the sidebar.

#### Scenario: Shortcut to Home
- **WHEN** a folder is open and the user presses Cmd/Ctrl+Shift+H
- **THEN** the window shows Home, and choosing the same folder again returns to it with its state restored

### Requirement: Quick switcher
The system SHALL provide a quick switcher (Cmd/Ctrl+O) over pinned and recent folders and files, usable from any window without returning to Home.

#### Scenario: Switch folders
- **WHEN** a folder is open and the user presses Cmd/Ctrl+O, types `api`, and presses Enter
- **THEN** `~/code/api` opens per the one-window-per-root rule
