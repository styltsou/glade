# Spec Delta

## Purpose

Guarantees that Glade changes a markdown file only where the user changed it, so files stay clean, app-agnostic, and safe to keep in version control.

## ADDED Requirements

### Requirement: No write without a content change
The system SHALL NOT write a file to disk unless the user changed its content in the current session.

#### Scenario: Open and close
- **WHEN** the user opens a file, scrolls, switches to edit mode, and navigates away without typing
- **THEN** the file's bytes and modification time are unchanged

#### Scenario: Edit then undo
- **WHEN** the user types a character and then undoes it before the save fires
- **THEN** the file is not written

### Requirement: Never add frontmatter unasked
The system SHALL NOT add a frontmatter block to a file that has none, except when the user explicitly adds a property or a tag.

#### Scenario: Edit a file without frontmatter
- **WHEN** the user edits the body of a file that has no frontmatter
- **THEN** the saved file still has no frontmatter

#### Scenario: Create a new note
- **WHEN** the user creates a new note
- **THEN** the file is created with no frontmatter

### Requirement: No app-owned metadata in files
The system SHALL NOT write `id`, `pinned`, `created`, `updated`, or any other app-internal key into a file's frontmatter.

#### Scenario: Pin a note
- **WHEN** the user pins a note
- **THEN** the note's file is not modified

#### Scenario: Save an edited note
- **WHEN** the user edits and saves a note
- **THEN** no timestamp or id key is added or updated in its frontmatter

### Requirement: Preserve untouched frontmatter text
When the system changes a frontmatter value, it SHALL rewrite only the lines of that key and leave all other lines — order, comments, quoting, spacing, and unknown keys — byte-for-byte unchanged.

#### Scenario: Add a tag
- **GIVEN** frontmatter `# draft\ntitle: "Plan"\nauthor: me\ntags: [a]`
- **WHEN** the user adds tag `b`
- **THEN** the frontmatter becomes `# draft\ntitle: "Plan"\nauthor: me\ntags: [a, b]` with all other lines unchanged

#### Scenario: Unparseable frontmatter
- **WHEN** a file's frontmatter is not valid YAML
- **THEN** the system does not modify the frontmatter, even if the user edits the body

### Requirement: Preserve untouched body text
When saving an edited file, the system SHALL keep the original text of markdown blocks the user did not change.

#### Scenario: Edit one paragraph
- **WHEN** a file uses `*` list markers and aligned tables, and the user edits one paragraph elsewhere
- **THEN** a diff of the saved file shows only that paragraph changed

#### Scenario: Images inside text
- **WHEN** a note has images in a sentence, a link, a list item, a heading or a table cell, and the user edits a different block
- **THEN** those images and the text around them are byte-for-byte unchanged

#### Scenario: Source the editor does not show
- **WHEN** a note has link reference definitions or HTML comments between blocks, and the user edits, adds, deletes or moves a neighbouring block
- **THEN** the definitions and comments are still in the saved file

### Requirement: Derived title
The system SHALL display a note's title from its first level-1 heading, else its filename without extension; a frontmatter `title` is ordinary metadata. The title field is a view of that heading: the system SHALL write a title into the file only when the user edits it, and then only as that heading.

#### Scenario: No title key
- **WHEN** a file `setup.md` has no `title` key and starts with `# Getting set up`
- **THEN** the displayed title is "Getting set up"

#### Scenario: Edit title from its source
- **WHEN** the user edits the displayed title of a note that has a level-1 heading
- **THEN** only that heading line changes, and the file is not renamed

#### Scenario: Title a note without a heading
- **WHEN** the user edits the displayed title of `README.md`, which has no level-1 heading
- **THEN** a level-1 heading with that title is added at the top of the body, and the file is not renamed

#### Scenario: Title left untouched
- **WHEN** the user opens the title field and leaves it unchanged
- **THEN** the file's content is not modified

### Requirement: File names
A note's file name SHALL follow its title only once, while the file is untitled (`untitled` or `untitled-N`, case-insensitive, a space also allowed before N). Names the system generates SHALL be lowercase kebab-case in the title's own script; names the user types SHALL be used as typed.

#### Scenario: Create a note
- **WHEN** the user creates a note in a folder that already has `untitled.md`
- **THEN** `untitled-2.md` is created empty, opened in editing mode, with its title field focused

#### Scenario: First title
- **WHEN** the user finishes typing the title "Meeting Notes" on `untitled.md`
- **THEN** the body starts with `# Meeting Notes`, the file becomes `meeting-notes.md` (or `meeting-notes-2.md` if taken), and links to it are updated without asking

#### Scenario: Later titles
- **WHEN** the user changes the title of `meeting-notes.md` to "Retro"
- **THEN** the heading changes and the file is still `meeting-notes.md`

#### Scenario: Autosave
- **WHEN** an untitled note is autosaved while a title or heading is still being typed
- **THEN** the file is not renamed

#### Scenario: Rename file
- **WHEN** the user renames a note's file to `My File`
- **THEN** the file becomes `My File` with its original extension, and its content is not modified

#### Scenario: Rename file to a taken name
- **WHEN** the user renames a note's file to the name of another file in that folder
- **THEN** the rename is refused with a message in the dialog, and neither file changes

### Requirement: Derived timestamps
The system SHALL take created and modified times from the filesystem, and SHALL only read (never write) `created`/`updated`/`date` frontmatter values.

#### Scenario: Sort by recent
- **WHEN** the user sorts notes by last modified
- **THEN** the order follows the files' filesystem modification times
