## ADDED Requirements

### Requirement: Horizontal Rule Insertion
The system SHALL allow users to insert horizontal rules (dividers) in their notes to visually separate content sections.

#### Scenario: Insert via Toolbar
- **WHEN** user selects text and clicks the divider button in the floating toolbar
- **THEN** a horizontal rule is inserted at the cursor position

#### Scenario: Insert via Keyboard Shortcut
- **WHEN** user presses `Mod+Shift+-` (Ctrl/Cmd+Shift+Minus)
- **THEN** a horizontal rule is inserted at the cursor position

### Requirement: Horizontal Rule Rendering
The system SHALL render horizontal rules visually in rich text mode.

#### Scenario: Visual Display
- **WHEN** a note contains a horizontal rule
- **THEN** the horizontal rule is displayed as a visible horizontal line in rich text mode

### Requirement: Horizontal Rule Serialization
The system SHALL serialize horizontal rules to standard markdown syntax.

#### Scenario: Save to Markdown
- **WHEN** a note with a horizontal rule is saved
- **THEN** the horizontal rule is stored as `---` (three dashes) in the markdown file

#### Scenario: Load from Markdown
- **WHEN** a markdown file containing `---` is loaded
- **THEN** the horizontal rule is rendered as a visible horizontal line in rich text mode
