# Spec Delta

## Purpose

Defines how links between markdown files are written, resolved, displayed, opened, and kept valid, using standard relative links that work outside Glade.

## ADDED Requirements

### Requirement: Mentions insert standard relative links
Choosing a note from the `@` mention picker SHALL insert a standard markdown link whose target is the chosen file's path relative to the current file, with the note title as link text.

#### Scenario: Mention a sibling folder note
- **WHEN** the user is editing `guides/intro.md` and picks `reference/api.md` (title "API") from the `@` picker
- **THEN** the saved file contains `[API](../reference/api.md)`

#### Scenario: Path with spaces
- **WHEN** the chosen file is `my notes/plan.md` relative to the current file
- **THEN** the link target is written as `my%20notes/plan.md`

### Requirement: Mention picker is scoped to the open folder
The `@` mention picker SHALL only suggest markdown files inside the open root folder that are not excluded by ignore rules.

#### Scenario: File outside root
- **WHEN** the root is `~/code/api/docs` and the user types `@readme`
- **THEN** `~/code/api/README.md` is not suggested

#### Scenario: Loose file has no picker suggestions
- **WHEN** the window shows a loose file
- **THEN** the `@` picker suggests only files in that file's own directory

### Requirement: Links resolve relative to their file
The system SHALL resolve relative link targets against the directory of the file containing the link, and absolute or `file://` targets as absolute paths, regardless of the open root.

#### Scenario: Link escaping the root
- **WHEN** the root is `~/code/api/docs` and `docs/index.md` contains `[Readme](../README.md)`
- **THEN** the link resolves to `~/code/api/README.md`

### Requirement: Link presentation by target
The system SHALL render links to existing markdown inside the root as normal links, to existing markdown outside the root with an outside marker (↗) and a tooltip showing the full path, and to missing local targets as broken links.

#### Scenario: Outside link marker
- **WHEN** a note links to an existing markdown file outside the root
- **THEN** the link shows an outside marker and hovering shows its full path

#### Scenario: Broken link
- **WHEN** a note links to `./old.md` which does not exist
- **THEN** the link is styled as broken with a "Not found" tooltip

### Requirement: Opening markdown link targets
Clicking a link to markdown inside the root SHALL open it in the current window; clicking a link to markdown outside the root SHALL open it in the current window as a loose file without adding it to the tree.

#### Scenario: Open outside file
- **WHEN** the user clicks a link to `~/code/api/README.md` from root `~/code/api/docs`
- **THEN** the README is shown in the current window, the tree is unchanged, and the breadcrumb shows its full path with "Open its folder"

#### Scenario: Return to root
- **WHEN** the user is viewing an outside file and clicks a note in the tree or presses Back
- **THEN** the root's note is shown

#### Scenario: Modifier-click outside file
- **WHEN** the user Cmd/Ctrl-clicks a link to markdown outside the root
- **THEN** the target's folder opens per the one-window-per-root rule

### Requirement: Non-markdown local targets are never executed
Clicking a link to an existing non-markdown, non-image local file SHALL reveal it in the system file manager and SHALL NOT open or execute it.

#### Scenario: Link to a script
- **WHEN** the user clicks a link to `./scripts/deploy.sh`
- **THEN** the file manager opens with `deploy.sh` selected and the script is not run

#### Scenario: Web link
- **WHEN** the user clicks a link to `https://example.com`
- **THEN** it opens in the default browser

### Requirement: Images resolve anywhere
Images referenced by relative or absolute local paths SHALL render whether they are inside or outside the root.

#### Scenario: Image outside root
- **WHEN** `docs/index.md` in root `docs` embeds `![](../assets/diagram.png)`
- **THEN** the image renders

### Requirement: Create missing link target
The system SHALL offer "Create file" on a broken link to a `.md` target, creating an empty file at the resolved path; if that path is outside the root it SHALL ask for confirmation first.

#### Scenario: Create inside root
- **WHEN** the user chooses "Create file" on a broken link to `./todo.md` inside the root
- **THEN** `todo.md` is created empty and opened

#### Scenario: Create outside root
- **WHEN** the broken link resolves outside the root
- **THEN** the system shows the full path and creates the file only after the user confirms

### Requirement: Backlinks are scoped to the open folder
The system SHALL compute backlinks only from markdown files inside the open root.

#### Scenario: Backlinks list
- **WHEN** `a.md` and `b.md` in the root link to `c.md`
- **THEN** `c.md`'s backlinks list shows `a.md` and `b.md`

### Requirement: Keep links valid on rename and move
When the user renames or moves a markdown file within the root, the system SHALL offer to update links to it from other files in the root, and SHALL rewrite the moved file's own relative links so they still reach the same targets.

#### Scenario: Rename with inbound links
- **WHEN** the user renames `c.md` to `concepts.md` and `a.md` links to `c.md`
- **THEN** the system offers to update 1 link in 1 file, and on accept only that link target changes in `a.md`

#### Scenario: Move with outbound links
- **WHEN** the user moves `guides/intro.md` (containing `[API](../reference/api.md)`) to `intro.md`
- **THEN** the moved file's link becomes `[API](reference/api.md)`

#### Scenario: Links from outside the root
- **WHEN** a file outside the root links to a file that is renamed
- **THEN** that outside file is not modified
