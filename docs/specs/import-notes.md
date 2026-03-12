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
│  │ 📁 drafts        (3 notes)      │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Import into:                           │
│  ○ Existing vault   [ Personal    ▾ ]   │
│  ○ New vault        [ my-blog       ]   │
│                                         │
│  [Cancel]              [Import]         │
└─────────────────────────────────────────┘
```

- The folder tree preview is scrollable if large
- "Import into" lets the user choose an existing vault or type a name for a new one
- If "New vault" is selected, the name is slugified and validated for uniqueness before proceeding

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

## OS Integration — "Open with Glade"

Users can trigger the import flow directly from the OS file manager by right-clicking a directory or `.md` file and selecting "Open with Glade". This skips the in-app file picker and pre-fills the import modal with the selected path.

### How It Works

Glade registers itself as a handler for directories and `.md` files at the OS level via Tauri. When the user triggers "Open with Glade", the path is passed to the app as a launch argument. If Glade is already running, the argument is forwarded to the existing instance via Tauri's `single-instance` plugin — no second window is opened.

### macOS

Declared in `Info.plist` via `tauri.conf.json` using `documentTypes`. Registers Glade as an editor for `.md` files and directories. Shows up in Finder's "Open with" context menu.

### Linux

Declared in the `.desktop` file with `MimeType=text/markdown;inode/directory;`. Shows up in Nautilus, Dolphin, and other file managers that respect `.desktop` entries.

### Windows

`.md` file associations are declared via `tauri.conf.json` under `fileAssociations` and written to the registry by the installer (NSIS or WiX). Directory context menu entries (`Right-click → Open with Glade`) require a separate registry key (`HKEY_CLASSES_ROOT\Directory\shell\Glade`) added via the NSIS installer script.

### Single Instance Behaviour

On all platforms, if Glade is already running when "Open with Glade" is triggered, the path is forwarded to the existing instance via Tauri's `single-instance` plugin. The import modal opens inside the running app rather than spawning a new window.

---

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
