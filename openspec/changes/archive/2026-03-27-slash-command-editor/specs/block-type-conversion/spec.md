## ADDED Requirements

### Requirement: BubbleMenu shows block type dropdown on selection
When text is selected in the editor, the BubbleMenu SHALL display inline formatting options AND a dropdown to change the parent block's type.

#### Scenario: BubbleMenu appears on selection
- **WHEN** user selects text in the editor
- **THEN** BubbleMenu appears with inline formatting (bold, italic, strike, link) AND a dropdown arrow

#### Scenario: Dropdown shows block types
- **WHEN** BubbleMenu is visible and user clicks the dropdown arrow
- **THEN** dropdown shows: Paragraph, Heading 1-4, Bullet list, Ordered list, Task list, Blockquote, Code block

### Requirement: Block type conversion converts parent block
When user selects a block type from the BubbleMenu dropdown, the entire parent block SHALL be converted to the selected type.

#### Scenario: Convert to heading
- **WHEN** user selects text within a paragraph and chooses "Heading 1" from dropdown
- **THEN** the entire paragraph is converted to Heading 1

#### Scenario: Convert to list
- **WHEN** user selects text within a paragraph and chooses "Bullet list" from dropdown
- **THEN** the entire paragraph is converted to a bullet list item

#### Scenario: Convert to blockquote
- **WHEN** user selects text within a paragraph and chooses "Blockquote" from dropdown
- **THEN** the entire paragraph is converted to a blockquote

#### Scenario: Convert to code block
- **WHEN** user selects text within a paragraph and chooses "Code block" from dropdown
- **THEN** the entire paragraph is converted to a code block

### Requirement: Inline formatting remains accessible
Inline formatting options SHALL remain functional when text is selected, regardless of block type dropdown.

#### Scenario: Bold on selection
- **WHEN** text is selected and user clicks bold button
- **THEN** selection is wrapped in bold formatting

#### Scenario: Italic on selection
- **WHEN** text is selected and user clicks italic button
- **THEN** selection is wrapped in italic formatting

#### Scenario: Link on selection
- **WHEN** text is selected and user clicks link button
- **THEN** prompt appears for URL, then link is applied to selection
