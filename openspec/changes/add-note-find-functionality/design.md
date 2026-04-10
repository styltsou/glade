## Context

The note editor component (`NoteEditor.tsx`) uses Tiptap as the rich text editor. It already handles various keyboard shortcuts and has UI elements like the BubbleMenu for text formatting. The editor has a clear structure where the main content is rendered within a container that manages scrolling.

## Goals / Non-Goals

**Goals:**
- Implement Ctrl+F / Cmd+F keyboard shortcut to activate find mode
- Display a search bar at the top of the note editor when activated
- Highlight all matching text occurrences in the editor content
- Provide next/previous match navigation
- Allow closing find bar with Escape key

**Non-Goals:**
- Replace functionality with browser's native find (Ctrl+F)
- Support regex or advanced search patterns (plain text only)
- Support case sensitivity toggle (keep simple for now)
- Search across multiple notes simultaneously
- Persist search state between note switches

## Decisions

**1. Find Bar Placement: Top of NoteEditor container**
- Placed inside the scroll container but above the editor content
- Uses fixed positioning relative to the editor container
- Allows search bar to remain visible while scrolling through long notes

**2. Text Highlighting: Tiptap Mark Extension**
- Create a custom Tiptap extension using marks to highlight matching text
- Marks are non-destructive and can be easily cleared on search term change
- Alternatively, use CSS/DOM overlay approach for highlighting

**3. Keyboard Shortcut Handling: Document-level listener with editor check**
- Add keyboard listener at document level that checks if editor is focused
- Use `Mod` key detection for cross-platform compatibility (Ctrl on Windows/Linux, Cmd on Mac)
- Prevent default browser find when editor is active

**4. State Management: Local component state**
- Manage find state (query, match index, visible) within NoteEditor or separate FindBar component
- No need for global state since find is per-note

## Risks / Trade-offs

- **Risk:** Tiptap's contentEditable DOM structure may complicate text highlighting
- **Mitigation:** Use Tiptap marks or decorations API for highlighting, which integrates with editor's state

- **Risk:** Performance issues with many matches in long notes
- **Mitigation:** Limit highlighting to visible portion or use decorations with limit

- **Risk:** Conflict with other keyboard shortcuts
- **Mitigation:** Check editor focus state before handling find shortcut; let other handlers manage their Escape keys

## Migration Plan

1. Create `FindBar` component with input, navigation buttons, match counter
2. Add Tiptap extension or decorations for text highlighting
3. Add keyboard shortcut listener in `NoteEditor.tsx`
4. Integrate FindBar into NoteEditor layout
5. Test keyboard navigation between matches
