## ADDED Requirements

### Requirement: Find Mode Activation
The system SHALL allow users to activate find mode by pressing Ctrl+F (Windows/Linux) or Cmd+F (Mac) when the note editor is focused.

#### Scenario: Activate via Keyboard Shortcut
- **WHEN** user presses Ctrl+F or Cmd+F while the note editor has focus
- **THEN** the find bar appears in the note header toolbar on the right side
- **AND** the search input field receives focus automatically
- **AND** the current editor selection is preserved

#### Scenario: Activate with Existing Text Selected
- **WHEN** user has text selected in the editor and presses Ctrl+F or Cmd+F
- **THEN** the selected text is populated in the find bar search field
- **AND** all matching occurrences are highlighted in the editor

### Requirement: Search Input
The system SHALL provide a text input field in the find bar for users to enter search queries.

#### Scenario: Enter Search Query
- **WHEN** user types text in the find bar search field
- **AND** there is at least one character entered
- **THEN** all matching text occurrences are highlighted in the editor
- **AND** the match counter displays the current match position (e.g., "1 of 5")

#### Scenario: Empty Search Query
- **WHEN** user clears the search input field
- **AND** there are no characters entered
- **THEN** all highlighting is removed from the editor
- **AND** the match counter is hidden or shows "0 matches"

### Requirement: Match Navigation via Buttons
The system SHALL allow users to navigate between matching text occurrences using on-screen buttons.

#### Scenario: Navigate to Next Match
- **WHEN** user clicks the "Next" button in the find bar
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the next match
- **AND** the match counter updates to show the new position

#### Scenario: Navigate to Previous Match
- **WHEN** user clicks the "Previous" button in the find bar
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the previous match
- **AND** the match counter updates to show the new position

### Requirement: Match Navigation via Keyboard
The system SHALL allow users to navigate between matching text occurrences using keyboard shortcuts.

#### Scenario: Navigate to Next Match with Enter
- **WHEN** user presses Enter while the find bar is focused
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the next match
- **AND** the match counter updates to show the new position

#### Scenario: Navigate to Previous Match with Shift+Enter
- **WHEN** user presses Shift+Enter while the find bar is focused
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the previous match
- **AND** the match counter updates to show the new position

#### Scenario: Navigate to Next Match with Tab
- **WHEN** user presses Tab while the find bar is focused
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the next match
- **AND** the match counter updates to show the new position
- **AND** the default Tab behavior (focus change) is prevented

#### Scenario: Navigate to Previous Match with Shift+Tab
- **WHEN** user presses Shift+Tab while the find bar is focused
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the previous match
- **AND** the match counter updates to show the new position

#### Scenario: Navigate to Next Match with Arrow Down
- **WHEN** user presses Arrow Down while the find bar is focused
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the next match
- **AND** the match counter updates to show the new position
- **AND** the default scroll behavior is prevented

#### Scenario: Navigate to Previous Match with Arrow Up
- **WHEN** user presses Arrow Up while the find bar is focused
- **AND** there are multiple matches
- **THEN** the editor scrolls to and highlights the previous match
- **AND** the match counter updates to show the new position
- **AND** the default scroll behavior is prevented

#### Scenario: Navigate Past Last Match
- **WHEN** user navigates forward when on the last match
- **THEN** the editor scrolls to and highlights the first match
- **AND** the match counter wraps to position 1

#### Scenario: Navigate Past First Match
- **WHEN** user navigates backward when on the first match
- **THEN** the editor scrolls to and highlights the last match
- **AND** the match counter wraps to the last position

### Requirement: Find Bar Closure
The system SHALL allow users to close the find bar using the Escape key.

#### Scenario: Close via Escape Key
- **WHEN** user presses Escape while the find bar is visible
- **THEN** the find bar is hidden
- **AND** all search highlighting is removed from the editor
- **AND** focus returns to the editor content

#### Scenario: Close by Clicking Outside
- **WHEN** user clicks outside the find bar (but inside the editor area)
- **THEN** the find bar remains open and focused

### Requirement: Text Highlighting
The system SHALL visually highlight all matching text occurrences in the editor content.

#### Scenario: Highlight Matches
- **WHEN** a search query returns matches
- **THEN** each matching text segment is highlighted with a distinct background color
- **AND** the current active match is highlighted with a different style (e.g., more prominent border)

#### Scenario: Clear Highlighting
- **WHEN** the find bar is closed or search query is cleared
- **THEN** all highlighting is removed from the editor
- **AND** the editor returns to its normal display state
