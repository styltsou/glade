# Spec Delta

## Purpose

Shows a note's frontmatter as an editable, hideable Properties panel that never reformats the underlying YAML.

## ADDED Requirements

### Requirement: Properties panel shows frontmatter
The system SHALL show a Properties panel above the note title listing each top-level frontmatter key and value in the file's original order.

#### Scenario: Note with frontmatter
- **WHEN** a note has frontmatter `status: draft` then `tags: [a, b]`
- **THEN** the panel lists `status: draft` then `tags: a, b`, in that order

#### Scenario: Note without frontmatter
- **WHEN** a note has no frontmatter
- **THEN** no Properties panel is shown

### Requirement: Panel can be hidden globally
The system SHALL let the user collapse and expand the Properties panel, remembering the choice across all notes and restarts.

#### Scenario: Collapse persists across notes
- **WHEN** the user collapses the panel on one note and opens another note with frontmatter
- **THEN** the panel is collapsed on the second note too

#### Scenario: Collapse persists across restart
- **WHEN** the user collapses the panel and restarts the app
- **THEN** the panel is still collapsed

### Requirement: Edit scalar and list values
The system SHALL let the user edit scalar values and flat lists of scalars inline, writing changes per the file-fidelity line-preservation rule.

#### Scenario: Edit a value
- **WHEN** the user changes `status: draft` to `status: done` in the panel
- **THEN** only that line in the file changes

### Requirement: Complex values are read-only
The system SHALL show nested maps, multi-line strings, anchors/aliases, and lists of non-scalars as read-only text with an "Edit in raw mode" action.

#### Scenario: Nested value
- **WHEN** a note has `author: {name: A, url: B}`
- **THEN** the panel shows it as read-only text and offers "Edit in raw mode"

### Requirement: Invalid frontmatter is shown raw
The system SHALL show frontmatter that fails to parse as raw text with a warning, and SHALL NOT modify it.

#### Scenario: Broken YAML
- **WHEN** a note's frontmatter contains `title: "unclosed`
- **THEN** the panel shows the raw frontmatter text with a "Couldn't parse properties" warning and no editable fields

### Requirement: Add and remove properties explicitly
The system SHALL let the user add a property via a note menu action (creating the frontmatter block only then) and remove a property from the panel, deleting only that key's lines.

#### Scenario: Add first property
- **WHEN** the user chooses "Add property" on a note without frontmatter and enters `status` = `draft`
- **THEN** the file gains a frontmatter block containing only `status: draft`, and the body is unchanged

#### Scenario: Remove last property
- **WHEN** the user removes the only remaining property
- **THEN** the frontmatter block is removed entirely
