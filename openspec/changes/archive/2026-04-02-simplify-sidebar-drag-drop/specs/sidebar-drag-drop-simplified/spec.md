## ADDED Requirements

### Requirement: Notes cannot be reordered via drag-and-drop
When a user initiates a drag operation on a note (non-directory item), the note SHALL remain in its original position with a visually disabled/grayed appearance throughout the drag operation.

#### Scenario: Dragging a note shows disabled state
- **WHEN** user clicks and holds on a note item in the sidebar
- **THEN** the note remains at its original position with reduced opacity (grayed look)
- **AND** the note does not move or show any drag preview following the cursor

#### Scenario: Dragging a note produces no drop indicators
- **WHEN** user drags a note over any other item in the sidebar
- **THEN** no insertion line indicators (top/bottom lines) appear
- **AND** no drop target highlighting occurs

### Requirement: Only directories are valid drop targets
The system SHALL only accept directories as valid drop targets. Dropping on notes or empty space SHALL have no effect.

#### Scenario: Dropping on a directory moves the item
- **WHEN** user drags an item over a directory
- **AND** releases the drag
- **THEN** the item is moved into that directory

#### Scenario: Dropping on a note is ignored
- **WHEN** user drags an item over a note item
- **AND** releases the drag
- **THEN** the item remains in its original location
- **AND** no move operation occurs

#### Scenario: Dropping outside any directory is ignored
- **WHEN** user drags an item outside any directory
- **AND** releases the drag in empty space
- **THEN** the item remains in its original location

### Requirement: Directory highlight on drag-over
When dragging over a directory, the entire directory area SHALL be visually highlighted to indicate it is a valid drop target.

#### Scenario: Dragging over expanded folder highlights full area
- **WHEN** user drags an item over an expanded folder
- **THEN** the entire folder area including its children is highlighted
- **AND** the highlight uses a distinct visual style (e.g., background color change)

#### Scenario: Dragging over collapsed folder highlights full area
- **WHEN** user drags an item over a collapsed folder
- **THEN** the entire folder row is highlighted
- **AND** the highlight indicates a valid drop target

### Requirement: Simplified drop position detection
The system SHALL use simplified logic that only detects whether the dragged item is over a directory, without calculating insertion positions.

#### Scenario: No top/bottom position calculation
- **WHEN** user drags an item over any item
- **THEN** the system only determines if the target is a directory
- **AND** no "above" or "below" position is calculated

#### Scenario: Drop position returns only into or null
- **WHEN** drop position is calculated
- **THEN** the result is either "into" (if over a directory) or null (otherwise)
- **AND** "top" and "bottom" positions are never returned
