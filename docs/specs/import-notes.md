# Glade — Import Markdown Files Spec

## Overview

The import feature allows users to bring existing markdown files or directories into a Glade vault. Importing creates a full copy of the files inside the target vault — Glade owns the copies from that point on and the originals remain untouched.

---

## Trigger Points

- Vault picker menu → **Import files**
- Command palette → **Import files into vault**

---

## What Can Be Imported

- A single `.md` file
- A directory — Glade recursively walks it, picks up all `.md` files, and preserves the folder structure. All other file types are silently ignored.

---

## Import Flow

### Step 1 — Select source

The user picks a file or directory via the native OS file picker. Glade scans the selection and counts the `.md` files found.

### Step 2 — Preview

A modal shows a summary before committing:

```
┌─────────────────────────────────────────┐
│  Import 14 notes                        │
│                                         │
│  From: ~/projects/my-blog/content       │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 📁 posts        (11 notes)      │    │
│  │ 📁 drafts        (3 notes)     │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Import into:                           │
│  ○ Existing vault   [ Personal    ▾ ]   │
│  ○ New vault        [ my-blog       ]   │
│                                         │
│  [Back]           [Cancel Import]       │
│                   or                     │
│                   [Import]               │
└─────────────────────────────────────────┘
```

- The folder tree preview is scrollable if large
- "Import into" lets the user choose an existing vault or type a name for a new one
- If "New vault" is selected, the name is slugified and validated for uniqueness before proceeding
- Cancel button available during import to abort the operation

### Step 3 — Import

On confirm, Glade:
1. Creates the new vault if needed (same flow as regular vault creation)
2. Copies all discovered `.md` files into the vault, preserving the relative folder structure from the source
3. Shows a progress indicator for large imports
4. Switches to the target vault on completion

---

## Conflict Handling

If a file with the same relative path already exists in the target vault, Glade shows an inline conflict resolution step:

- **Skip** — keep the existing file, discard the incoming one
- **Replace** — overwrite the existing file with the incoming one
- **Keep both** — rename the incoming file with a suffix (e.g. `note-1.md`)

The user can apply a choice to all conflicts at once or resolve per file.

---

## What Does Not Change in the Source

Nothing. The original files and directories are never modified, moved, or deleted. Import is always a copy operation.

---

## Frontmatter Handling

Imported files may or may not have YAML frontmatter. Glade should:
- Preserve existing frontmatter as-is
- Not inject or modify frontmatter during import
- Let the user add tags, titles etc. after import through normal note editing

---

## Out of Scope

- Importing non-md files (images, PDFs, etc.)
- Ongoing sync between the import source and the vault copy
- Bulk re-import / update from source

---

## Error Handling

The import dialog is wrapped in a React Error Boundary to gracefully handle unexpected errors during the import process. If an error occurs, users see a user-friendly message rather than a crash.

- Cancel buttons are available in both preview and conflicts steps
- Errors during scanning are displayed in a red error box within the dialog
- Import progress can be cancelled at any time during the import operation


---

## OS Integration — "Open with Glade"

When the user triggers "Open with Glade" from the OS file manager, Glade first shows a modal asking what they want to do with the file or directory. This spec only covers the import path — the other options are handled by separate features.

```
┌─────────────────────────────────────────┐
│  Open with Glade                        │
│                                         │
│  ~/projects/my-app/docs                 │
│                                         │
│  What would you like to do?             │
│                                         │
│  ○ Import into vault  — copy into Glade │
│  ○ View only          — open as reader  │
│                                         │
│  [Cancel]              [Continue]       │
└─────────────────────────────────────────┘
```

Selecting "Import into vault" continues into the standard import flow with the path pre-filled.

### OS Registration

Glade registers itself as a handler for directories and `.md` files at the OS level via Tauri. When triggered, the path is passed to the app as a launch argument. If Glade is already running, the argument is forwarded to the existing instance via Tauri's `single-instance` plugin — no second window is opened.

### macOS

Declared in `Info.plist` via `tauri.conf.json` using `documentTypes`. Registers Glade as an editor for `.md` files and directories. Shows up in Finder's "Open with" context menu.

### Linux

Declared in the `.desktop` file with `MimeType=text/markdown;inode/directory;`. Shows up in Nautilus, Dolphin, and other file managers that respect `.desktop` entries.

### Windows

`.md` file associations are declared via `tauri.conf.json` under `fileAssociations` and written to the registry by the installer (NSIS or WiX). Directory context menu entries require a separate registry key (`HKEY_CLASSES_ROOT\Directory\shell\Glade`) added via the NSIS installer script.

### Single Instance Behaviour

On all platforms, if Glade is already running when "Open with Glade" is triggered, the path is forwarded to the existing instance via Tauri's `single-instance` plugin. The modal opens inside the running app rather than spawning a new window.

## Note Title Generation

Titles are derived using the following priority order:

1. **Existing `title` in frontmatter** — used as-is, no changes made to the file
2. **No frontmatter title** — derived from the filename and written into the note's frontmatter on import

### Filename to Title Conversion

- Strip the `.md` extension
- Replace hyphens and underscores with spaces
- Title case the result

Examples:
- `my-meeting-notes.md` → `My Meeting Notes`
- `kubernetes_setup.md` → `Kubernetes Setup`
- `README.md` → `Readme`

### Frontmatter Injection

If a note has no frontmatter at all, Glade creates it on import. If it has frontmatter but no `title` field, Glade adds the `title` field to the existing block. All other frontmatter fields are left untouched.

---

## Inter-Note Link Preservation

Imported notes may contain links referencing other notes within the same source directory. These links should continue to work correctly after import into the vault.

This spec is intentionally agnostic about the implementation since note linking is already implemented in Glade and the approach here must be consistent with however linking currently works in the codebase.

Before implementing this section, the agent should:
1. Review how note linking is currently implemented in the codebase (link format, resolution strategy, storage)
2. Assess whether imported links need to be rewritten, resolved, or can be preserved as-is
3. Propose the best approach based on the current implementation before writing any code

### Cases to Consider

- All linked notes are present in the import source — links should resolve correctly after import
- A link points to a note outside the import source — the link will be broken after import since the target was not copied. Glade should detect these during import and handle them gracefully
- Links use relative paths vs note titles vs some other format — handling depends on the current linking implementation

### Broken Link Fallback

When a link cannot be resolved after import, rather than dropping it silently or showing a raw path, Glade should render the link target's title in bold to indicate it was a link that no longer resolves. The note stays readable, the user can see something was linked there, and it's clear it needs attention without being disruptive.

The agent should determine the best way to represent this in the internal linking format based on the current implementation.

### Preview Step Addition

The import preview modal should surface a warning if broken links are detected:

```
⚠ 3 notes contain links to files outside
  this directory. These links will be
  broken after import.
```

The user should be able to proceed anyway or cancel.

---

## Note on Internal vs Serialized Link Format

Glade uses a two-layer approach for note linking:

- **Internal representation** — rich editor format (pills, IDs, or whatever the editor uses internally) for the in-app experience
- **Serialized to disk** — standard markdown relative path links (`[note title](./path/to/note.md)`) written to the `.md` file on save

This means `.md` files on disk always contain clean standard markdown that renders correctly on GitHub and in exports. The editor loads the file, transforms path links into the internal rich format, and converts back on save.

### Implications for Import

Imported notes that already contain standard markdown relative path links should be parsed and converted to the internal format automatically on load, using the same parsing logic already in place for vault notes.

### Rename and Move Reference Updates

Since links on disk are path-based, renaming or moving a note must trigger an update of all relative path links pointing to it across the vault. The agent should verify whether this is already handled and ensure it works correctly for notes that arrive via import.