## ADDED Requirements

### Requirement: Per-note read/edit mode state
The system SHALL maintain a per-note read/edit mode state that persists when navigating between notes.

#### Scenario: Open a note for the first time
- **WHEN** user opens a note that has never been opened before
- **THEN** the note opens in read mode with scroll position at the top

#### Scenario: Return to a note in read mode
- **WHEN** user returns to a note that was previously in read mode
- **THEN** the note opens in read mode with scroll position restored to where user left off
- **AND** cursor position is NOT restored (no blinking cursor shown)

#### Scenario: Return to a note in edit mode
- **WHEN** user returns to a note that was previously in edit mode
- **THEN** the note opens in edit mode with scroll position restored
- **AND** cursor position is restored to where user last edited

#### Scenario: Switch to another note
- **WHEN** user clicks on a different note in the sidebar
- **THEN** the current note's read/edit mode state is saved
- **AND** the new note loads in its saved read/edit mode state

### Requirement: Enter edit mode via double-click
The system SHALL allow users to enter edit mode by double-clicking anywhere in the editor area.

#### Scenario: Double-click to enter edit mode from read mode
- **WHEN** user double-clicks anywhere in the editor while in read mode
- **THEN** the editor switches to edit mode
- **AND** cursor position is set to the clicked location
- **AND** scroll position remains where user was reading (does not jump)

#### Scenario: Scroll position stays in place when entering edit mode
- **WHEN** user is in read mode, scrolls to a position, then enters edit mode (via double-click or Cmd/Ctrl+E)
- **THEN** the scroll position stays where it was (does not jump to last saved edit mode position)

#### Scenario: Double-click in edit mode stays in edit mode
- **WHEN** user double-clicks while already in edit mode
- **THEN** no mode change occurs (remains in edit mode)

### Requirement: Toggle read/edit mode via keyboard shortcut
The system SHALL allow users to toggle between read and edit mode using Cmd/Ctrl+E.

#### Scenario: Cmd/Ctrl+E in read mode enters edit mode
- **WHEN** user presses Cmd+E (Mac) or Ctrl+E (Windows/Linux) while in read mode
- **THEN** the editor switches to edit mode
- **AND** scroll position stays where user was reading
- **AND** cursor position is NOT automatically set (user clicks to position cursor)

#### Scenario: Cmd/Ctrl+E in edit mode enters read mode
- **WHEN** user presses Cmd+E (Mac) or Ctrl+E (Windows/Linux) while in edit mode
- **THEN** the editor switches to read mode

#### Scenario: Cmd/Ctrl+E with text selected
- **WHEN** user has text selected and presses Cmd/Ctrl+E
- **THEN** mode toggles while preserving text selection in the editor

### Requirement: Exit edit mode when clicking outside
The system SHALL exit edit mode when user clicks on non-editor areas (sidebar, file tree, etc.).

#### Scenario: Click on sidebar while in edit mode
- **WHEN** user clicks on the sidebar while note is in edit mode
- **THEN** the note exits edit mode and switches to read mode

#### Scenario: Click on file tree while in edit mode
- **WHEN** user clicks on a file in the file tree while note is in edit mode
- **THEN** the current note exits edit mode (saved)
- **AND** the clicked note opens in its saved mode

### Requirement: Visual indicator of current mode
The system SHALL display a visual indicator in the header showing the current read/edit mode.

#### Scenario: Mode indicator in read mode
- **WHEN** note is in read mode
- **THEN** header displays a "read mode" indicator (icon or text)

#### Scenario: Mode indicator in edit mode
- **WHEN** note is in edit mode
- **THEN** header displays an "edit mode" indicator (icon or text)

### Requirement: Read mode makes editor non-editable
The system SHALL make the TipTap editor non-editable when in read mode while preserving text selection.

#### Scenario: Attempt to type in read mode
- **WHEN** user tries to type in the editor while in read mode
- **THEN** typing has no effect (editor is read-only)

#### Scenario: Text selection in read mode
- **WHEN** user clicks and drags to select text in read mode
- **THEN** text selection works normally (as in a read-only document)

#### Scenario: Click links in read mode
- **WHEN** user clicks on a hyperlink in read mode
- **THEN** the link behaves according to its href (opens in browser or internal navigation)

### Requirement: Independence from raw mode
The system SHALL treat read/edit mode and raw mode as independent toggles.

#### Scenario: Read mode with raw mode off
- **WHEN** note is in read mode and raw mode is off
- **THEN** rendered markdown is displayed and non-editable

#### Scenario: Read mode with raw mode on
- **WHEN** note is in read mode and raw mode is on
- **THEN** raw markdown is displayed and non-editable

#### Scenario: Edit mode with raw mode off
- **WHEN** note is in edit mode and raw mode is off
- **THEN** rendered markdown is displayed and editable

#### Scenario: Edit mode with raw mode on
- **WHEN** note is in edit mode and raw mode is on
- **THEN** raw markdown is displayed and editable

### Requirement: Title field always editable
The system SHALL keep the note title field editable regardless of read/edit mode.

#### Scenario: Edit title in read mode
- **WHEN** user clicks on the title while note is in read mode
- **THEN** title field is editable

#### Scenario: Edit title in edit mode
- **WHEN** user clicks on the title while note is in edit mode
- **THEN** title field is editable