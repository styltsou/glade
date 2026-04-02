## ADDED Requirements

### Requirement: Render mermaid code blocks as diagrams
When the editor is in rich text mode and contains a fenced code block with language `mermaid`, the system SHALL render the block content as an interactive SVG diagram instead of displaying raw code.

#### Scenario: Initial render with valid syntax
- **WHEN** a note contains a mermaid code block with valid syntax and the editor is in rich text mode
- **THEN** the block is displayed as a rendered SVG diagram

#### Scenario: Initial render with invalid syntax
- **WHEN** a note contains a mermaid code block with invalid syntax and the editor is in rich text mode
- **THEN** the block displays an error message indicating invalid diagram syntax, and an edit button is visible so the user can fix the source

### Requirement: Per-block source editing
The system SHALL provide a mechanism to edit the mermaid source code within a single block without enabling the global raw markdown toggle.

#### Scenario: Enter source edit mode
- **WHEN** a user hovers over a rendered mermaid diagram and clicks the "Edit source" button
- **THEN** the diagram is replaced with a textarea containing the raw mermaid source code

#### Scenario: Exit source edit mode with valid syntax
- **WHEN** a user edits mermaid source in the textarea and then blurs the textarea (or clicks Done) with valid syntax
- **THEN** the system renders the updated diagram, switches back to preview mode, and persists the updated source to the document

#### Scenario: Exit source edit mode with invalid syntax
- **WHEN** a user edits mermaid source in the textarea and then blurs with invalid syntax
- **THEN** the system displays an error message, stays in source edit mode, and does NOT update the document

### Requirement: Empty block handling
The system SHALL handle mermaid blocks with empty source gracefully.

#### Scenario: Empty mermaid block
- **WHEN** a mermaid code block contains no source text
- **THEN** the block displays a placeholder message "Empty diagram — click to add source" and does not attempt to render

### Requirement: Global raw mode takes precedence
The system SHALL ensure the global raw markdown toggle overrides per-block rendering.

#### Scenario: Global raw mode enabled
- **WHEN** the global raw markdown toggle is enabled
- **THEN** all mermaid code blocks display as raw fenced code blocks, regardless of their individual state

### Requirement: Document sync on external changes
The system SHALL sync external document changes to the mermaid block's source.

#### Scenario: Undo reverts source
- **WHEN** a user performs undo after editing mermaid source
- **THEN** the diagram re-renders with the reverted source content

### Requirement: Independent rendering for multiple blocks
The system SHALL render multiple mermaid blocks on the same page independently without ID conflicts.

#### Scenario: Multiple mermaid blocks
- **WHEN** a note contains two or more mermaid code blocks
- **THEN** each block renders its own diagram independently with no conflicts
