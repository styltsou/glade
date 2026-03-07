# Glade — Home View, Pinned Notes & Recents Spec

## Overview

When Glade opens, the main area shows a **Home view** — a lightweight dashboard with two sections: pinned notes and recently opened notes. The sidebar is always visible by default and can be toggled. Together these features give the user a sense of place and fast access to what matters most without cluttering the core navigation.

---

## Layout

```
┌─────────────────┬──────────────────────────────────────┐
│                 │                                      │
│  SIDEBAR        │  HOME VIEW                           │
│                 │                                      │
│  [Glade logo]   │  Pinned                              │
│                 │  ┌──────┐ ┌──────┐ ┌──────┐         │
│  📌 Pinned      │  │      │ │      │ │      │         │
│  > Note A       │  └──────┘ └──────┘ └──────┘         │
│  > Note B       │                                      │
│                 │  Recently Opened                     │
│  ─────────────  │  ┌──────┐ ┌──────┐ ┌──────┐         │
│                 │  │      │ │      │ │      │         │
│  📁 Folder 1    │  └──────┘ └──────┘ └──────┘         │
│    > Note C     │                                      │
│  📁 Folder 2    │                                      │
│    > Note D     │                                      │
│  > Note E       │                                      │
│                 │                                      │
│  [sort icon]    │                                      │
└─────────────────┴──────────────────────────────────────┘
```

Clicking any note — from the home view or the sidebar — opens it in the editor, replacing the home view in the main area.

---

## Sidebar

### Structure

- **Header** — app name/logo, collapse toggle button
- **Pinned section** — small dedicated section at the top, shows pinned notes only
- **Divider**
- **File tree** — full folder/note hierarchy
- **Footer** — sort toggle icon

### Toggle

- **Shortcut:** `Cmd+B` (macOS) / `Ctrl+B` (Windows/Linux)
- **Collapse button:** chevron icon in the sidebar header
- When collapsed, the sidebar shrinks to zero width and the main area expands to fill the full window
- Toggle state is persisted to local app config so it survives restarts

### Sorting

A single icon button in the sidebar footer cycles through three sort modes:

| Mode | Label | Behavior |
|---|---|---|
| `name-asc` | A → Z | Alphabetical ascending |
| `name-desc` | Z → A | Alphabetical descending |
| `modified` | Recent | Last modified date, newest first |

The active sort mode is shown via a small label next to the icon. Sort applies to the file tree only, not to the pinned section. Sort state is persisted to local app config.

### Pinned Section in Sidebar

- Shows only pinned notes, flat list regardless of which folder they live in
- If no notes are pinned, the section is hidden entirely
- Right-click a pinned note → context menu includes **Unpin**

---

## Home View

Shown in the main area on app launch and when no note is open. Replaced by the editor when a note is opened.

### Pinned Notes Grid

- Section title: **Pinned**
- Displays all pinned notes as cards in a responsive grid (3 columns default)
- If no notes are pinned, the section is hidden and the recents section moves up
- Card contents:
  - Note title
  - Tags (up to 3, truncated)
  - Last modified date
  - First ~100 characters of content as a preview excerpt

### Recently Opened Grid

- Section title: **Recently Opened**
- Displays the last 12 opened notes as cards, same layout as pinned cards
- Ordered by `last_opened` timestamp, newest first
- If a note is both pinned and recent, it appears in the pinned section only

### Note Card

```
┌────────────────────────┐
│ Note title             │
│                        │
│ Preview of the note    │
│ content truncated...   │
│                        │
│ #tag1 #tag2            │
│                 Jan 10 │
└────────────────────────┘
```

- Click → open note in editor
- Right-click → context menu (pin/unpin, open in editor, delete)

---

## Pinning

### How to Pin

- Right-click a note in the sidebar → **Pin note**
- Right-click a note card on the home view → **Pin note**
- Command palette → **Pin note** (acts on currently active note)

### Storage

Pinned state is stored as a `pinned: true` flag in the note's YAML frontmatter:

```yaml
---
title: Kubernetes setup
tags: [devops, infra]
created: 2026-01-10
pinned: true
---
```

This keeps the pinned state portable — it travels with the file and is preserved through Git sync.

### Unpinning

- Right-click → **Unpin note** (available in sidebar, home view, and command palette)
- Removes `pinned: true` from frontmatter (or sets `pinned: false`)

---

## Recently Opened — Storage

`last_opened` is **not** stored in frontmatter since it's device-specific and would create noisy Git commits on every note open. Instead it is stored in a local app config file that is excluded from Git sync.

### Config File

Location: Tauri's app data directory (e.g. `~/.config/glade/` on Linux, `~/Library/Application Support/glade/` on macOS)

```json
{
  "recents": [
    { "path": "notes/kubernetes-setup.md", "last_opened": 1736500000 },
    { "path": "notes/meeting-q1.md", "last_opened": 1736499000 }
  ],
  "sidebar": {
    "collapsed": false,
    "sort": "modified"
  }
}
```

- Max 12 entries in `recents`
- On note open: prepend to list, remove duplicates, trim to 12
- This file is added to `.gitignore` automatically by Glade on vault init

---

## Tauri Commands

```rust
#[tauri::command]
fn get_pinned_notes() -> Vec<NoteCard>

#[tauri::command]
fn get_recent_notes() -> Vec<NoteCard>

#[tauri::command]
fn pin_note(path: String) -> Result<(), String>

#[tauri::command]
fn unpin_note(path: String) -> Result<(), String>

#[tauri::command]
fn record_note_opened(path: String) -> Result<(), String>

#[tauri::command]
fn get_sidebar_state() -> SidebarState

#[tauri::command]
fn save_sidebar_state(state: SidebarState) -> Result<(), String>
```

---

## Out of Scope for v1

- Drag to reorder pinned notes
- Custom home view layout or widgets
- Per-device sync of recents across machines
- "Favourites" as a concept separate from pinned
