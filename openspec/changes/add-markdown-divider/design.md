## Context

The app uses Tiptap (ProseMirror-based) as its rich text editor with React components. Notes are stored as CommonMark markdown. A global raw markdown toggle exists to switch between rendered rich text and raw source. The goal is to add horizontal rule support to the editor.

## Goals / Non-Goals

**Goals:**
- Enable users to insert horizontal rules via toolbar button
- Ensure horizontal rules render visually in rich text mode
- Serialize horizontal rules to standard markdown `---` syntax

**Non-Goals:**
- Custom styling for horizontal rules beyond the default
- Multiple divider styles (single line, double line, etc.)

## Decisions

### 1. Tiptap Extension Choice
**Decision:** Use Tiptap's built-in `HorizontalRule` node extension.

**Rationale:** Tiptap provides a native `HorizontalRule` extension that handles parsing and serialization. No need to create a custom node—use the standard extension.

### 2. Toolbar Integration
**Decision:** Add divider button to the floating toolbar that appears on text selection.

**Rationale:** This matches the existing UI pattern—other formatting options like bold, italic, and headings use the floating toolbar. The divider is a formatting element, not a block-level insertion.

### 3. Keyboard Shortcut
**Decision:** Use `Mod+Shift+-` (Ctrl/Cmd+Shift+Minus) to insert a horizontal rule.

**Rationale:** This follows common editor conventions. VS Code uses this shortcut for horizontal rules in markdown.

## Risks / Trade-offs

- **[Risk]** None identified—horizontal rules are a simple, well-understood markdown feature
