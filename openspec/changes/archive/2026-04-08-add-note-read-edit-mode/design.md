## Context

Currently, the Glade editor always feels like it's in "write mode" - the TipTap editor is always editable and often focused when opening a note. Users have no clear distinction between reading and editing, which creates a poor experience when they just want to review notes.

Following Obsidian's convention: notes have distinct read (presentation) and edit (source) modes. Users explicitly enter edit mode rather than always being in it.

## Goals / Non-Goals

**Goals:**
- Per-note read/edit mode state that persists across navigation
- Notes open in read mode with scroll position restored
- Double-click to enter edit mode with cursor position restored
- Cmd/Ctrl+E keyboard shortcut to toggle modes (like Obsidian)
- Click outside note to exit edit mode
- Visual indicator of current mode in header

**Non-Goals:**
- Raw mode toggle is independent - read/edit mode is orthogonal to raw mode
- Backlink panel, outline, etc. remain functional in both modes
- Mobile-specific gestures (future consideration)

## Decisions

**1. State Storage: Per-note in Zustand store**

We already have `lastFocusedPositionRef` and note scroll position tracking. We'll extend this to store:
- `readEditMode`: Map<string, boolean> (note path → isEditMode)
- This persists across navigation, not just session

**2. TipTap editable prop**

Use TipTap's `editable` prop on the Editor component. When in read mode, set `editable={false}`. This makes the editor read-only but still allows text selection.

**3. Double-click handler location**

Add onClick handler to the NoteEditor wrapper div that detects double-click and transitions to edit mode. Need to distinguish single click (for text selection) from double-click.

**4. Scroll position restoration**

Already partially implemented via `noteScrollPositions`. Need to ensure both read and edit mode restore scroll. In edit mode, also restore cursor position.

**5. Exit edit mode trigger**

When clicking on non-editor areas (sidebar, file tree, etc.), the note should exit edit mode. This can be handled in the click-outside logic that's already in NoteEditor.

## Risks / Trade-offs

**Risk: Double-click might conflict with existing Tiptap interactions**

Tiptap already uses click events for cursor positioning. Need to ensure double-click properly triggers mode change without interfering.

*Mitigation:* Use a flag to detect double-click separately from single click, or use the native onDoubleClick event.

**Risk: Persistence layer**

We need to persist read/edit mode to localStorage or electron store.

*Mitigation:* Add to existing note metadata storage. Keep it simple initially - if performance issues arise, optimize later.

**Trade-off: Title field behavior**

Title remains always editable. This is inconsistent with read mode but provides better UX for quick title changes. Accept this minor inconsistency.

**Risk: Interaction with raw mode**

User can be in read mode + raw mode, or edit mode + raw mode. These should be independent.

*Mitigation:* Treat them as orthogonal toggles. Raw mode controls content display, read/edit mode controls editability.