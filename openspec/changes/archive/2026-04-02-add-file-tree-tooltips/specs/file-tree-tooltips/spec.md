## ADDED Requirements

### Requirement: File tree items display created_at in tooltip
The system SHALL display a tooltip on file tree items showing the note's creation date in relative time format (e.g., "Created 2 days ago").

#### Scenario: Tooltip shows created date for notes
- **WHEN** a user hovers over a note file tree item
- **THEN** a tooltip appears showing "Created {relative time}"

#### Scenario: Tooltip shows created date for folders
- **WHEN** a user hovers over a folder file tree item
- **THEN** a tooltip appears showing "Created {relative time}"

#### Scenario: No tooltip when created_at is null
- **WHEN** a file tree item has no created_at date
- **THEN** no tooltip is displayed

#### Scenario: Tooltip uses consistent date formatting
- **WHEN** a tooltip is displayed
- **THEN** the date uses the same formatRelativeDate function used elsewhere in the app
