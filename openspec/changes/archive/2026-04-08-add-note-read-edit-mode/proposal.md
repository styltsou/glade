## Why

Currently, notes always feel like they're in "write mode" - the editor is always editable and focused when you open a note. This creates a poor reading experience when users just want to review their notes without accidentally typing. We should follow Obsidian's convention of having distinct read and edit modes, where notes open in read mode by default and users explicitly enter edit mode.

## What Changes

- Add per-note read/edit mode state that persists when navigating away and back
- Notes open in read mode by default with scroll position restored
- Double-click anywhere in editor to enter edit mode, restoring cursor position
- Cmd/Ctrl+E keyboard shortcut to toggle between read/edit mode (like Obsidian)
- Clicking outside the note (sidebar, etc.) exits to read mode
- Visual indicator showing current mode (icon or badge in header)
- When returning to a note in edit mode, restore both scroll AND cursor position
- Title field remains always editable (not affected by read/edit mode)

## Capabilities

### New Capabilities

- `note-read-edit-mode`: Per-note read/edit mode state that persists across navigation, including entry triggers (double-click, Cmd/Ctrl+E), exit triggers (click outside), and visual indicator

### Modified Capabilities

- None - this is a new capability

## Impact

- `src/components/Editor.tsx` - Main editor component, needs state management for read/edit mode
- `src/components/editor/NoteEditor.tsx` - Editor UI, needs double-click handler and editable toggle
- `src/components/editor/NoteHeader.tsx` - Needs mode indicator display
- Store/slice for note state - May need to persist read/edit mode per note