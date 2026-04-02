## ADDED Requirements

### Requirement: Slash command triggers anywhere in line
Slash commands SHALL trigger when the user types "/" anywhere in a line, not just at line start.

#### Scenario: Type slash at line start
- **WHEN** user types "/" at the start of a line (cursor at position 0)
- **THEN** slash command menu appears below the cursor

#### Scenario: Type slash mid-line
- **WHEN** user types "/" in the middle of existing text (e.g., "Hello /world")
- **THEN** slash command menu appears, allowing conversion of the current block

#### Scenario: Type slash after Enter
- **WHEN** user presses Enter to create a new line, then types "/"
- **THEN** slash command menu appears (new line is empty)

### Requirement: Slash command menu displays formatting options
The slash command menu SHALL display a list of available formatting commands with their icons and descriptions.

#### Scenario: Menu displays all commands
- **WHEN** slash command menu is open
- **THEN** menu displays: Heading 1-4, Bullet list, Ordered list, Task list, Blockquote, Code block, Horizontal rule, Link

#### Scenario: Menu keyboard navigation
- **WHEN** user presses Arrow Down/Arrow Up
- **THEN** selection moves to next/previous command

#### Scenario: Menu command selection
- **WHEN** user presses Enter while command is selected
- **THEN** the selected command is executed and menu closes

#### Scenario: Menu mouse selection
- **WHEN** user clicks on a command
- **THEN** the command is executed and menu closes

### Requirement: Slash command executes formatting on parent block
Each slash command SHALL apply the corresponding formatting to the current parent block (not insert new blocks).

#### Scenario: Heading commands convert parent block
- **WHEN** user selects "/h1" from menu
- **THEN** current parent block is converted to Heading 1
- **WHEN** user selects "/h2" from menu
- **THEN** current parent block is converted to Heading 2
- **WHEN** user selects "/h3" from menu
- **THEN** current parent block is converted to Heading 3
- **WHEN** user selects "/h4" from menu
- **THEN** current parent block is converted to Heading 4

#### Scenario: List commands convert parent block
- **WHEN** user selects "/bullet" from menu
- **THEN** current parent block is converted to bullet list
- **WHEN** user selects "/ordered" from menu
- **THEN** current parent block is converted to ordered list
- **WHEN** user selects "/task" from menu
- **THEN** current parent block is converted to task list

#### Scenario: Block commands convert parent block
- **WHEN** user selects "/quote" from menu
- **THEN** current parent block is converted to blockquote
- **WHEN** user selects "/code" from menu
- **THEN** current parent block is converted to code block
- **WHEN** user selects "/hr" from menu
- **THEN** a horizontal rule is inserted below current block and cursor moves to new line

#### Scenario: Link command
- **WHEN** user selects "/link" from menu
- **THEN** system prompts for URL input, then applies link formatting to selection or inserts link at cursor

### Requirement: Empty line hint for discoverability
An empty line SHALL show a placeholder hint indicating slash commands are available.

#### Scenario: Empty line shows hint
- **WHEN** user creates a new line with no content
- **THEN** placeholder text "Type '/' for commands" is visible (subtle, ghost style)

#### Scenario: Hint disappears when typing
- **WHEN** user starts typing on empty line
- **THEN** placeholder hint disappears

### Requirement: Menu closes on Escape
The slash command menu SHALL close when user presses Escape.

#### Scenario: Escape closes menu
- **WHEN** slash command menu is open and user presses Escape
- **THEN** menu closes and "/" character is removed from the line
