## Context

The current editor has a top toolbar (`EditorToolbar.tsx`) that syncs with Tiptap's editor state. This causes issues and takes up vertical space. The existing `BubbleMenu` only handles inline formatting (bold, italic, strike, link) but doesn't support block type conversion.

This design addresses implementing slash commands and enhanced BubbleMenu for block conversion.

## Goals / Non-Goals

**Goals:**
- Remove top toolbar completely
- Implement slash commands that trigger at line start on empty lines
- Enable block type conversion via BubbleMenu when text is selected
- Show empty line hint to discover slash commands

**Non-Goals:**
- Slash command auto-complete (just the menu, not full fuzzy search)
- Mobile/touch UI optimization (focus on desktop keyboard-first)
- Changing how links are inserted (keep current prompt-based approach)

## Decisions

### 1. Slash Command Implementation: Use Tiptap Suggestion Extension

**Decision:** Use `@tiptap/suggestion` (already used by `@tiptap/extension-mention`) to power slash commands.

**Rationale:** The suggestion extension provides the exact pattern needed — trigger character, render a React component popup, handle keyboard navigation. It's battle-tested and already in the codebase via mention.

**Alternative considered:** Build custom input rule — would require more boilerplate and reinvent the wheel.

### 2. Trigger Behavior: Line Start on Empty Lines Only

**Decision:** Slash triggers when:
- Line is empty (no content)
- OR cursor is at position 0 after pressing Enter (new line)

**Rationale:** This matches Notion's behavior and prevents "/" in mid-sentence from triggering the menu accidentally.

**Alternative considered:** Trigger anywhere — too error-prone since "/" is common in text.

### 3. Block Type Conversion: Convert Parent Block

**Decision:** When text is selected and user picks a block type from BubbleMenu dropdown, convert the entire parent block (not just selection).

**Rationale:** Matches Mintlify's UX. If user selects text, they likely want the whole block transformed. Partial selection edge case: just convert parent block, selection is cleared.

### 4. Empty Line Hint: Ghost Text Placeholder

**Decision:** Use Tiptap's placeholder extension to show "Type '/' for commands" on empty lines.

**Rationale:** Subtle, non-intrusive, similar to Mintlify. No need for a separate popup.

**Alternative considered:** Show hint only after "/" is typed — placeholder is better discoverability.

### 5. Slash Command List

| Command | Description | Icon |
|---------|-------------|------|
| `/h1` | Heading 1 | H1 |
| `/h2` | Heading 2 | H2 |
| `/h3` | Heading 3 | H3 |
| `/h4` | Heading 4 | H4 |
| `/bullet` | Bullet list | List |
| `/ordered` | Ordered list | ListOrdered |
| `/task` | Task list | CheckSquare |
| `/quote` | Blockquote | Quote |
| `/code` | Code block | Code |
| `/hr` | Horizontal rule | Minus |
| `/link` | Add link | Link2 |

### 6. BubbleMenu Enhancement

**Current:** Inline formatting only (bold, italic, strike, link)

**Proposed:**
```
┌──────────────────────────────────────────┐
│ [B] [I] [S] [🔗]  ▼ (dropdown)          │
└──────────────────────────────────────────┘
              ↓ click ▼
┌──────────────────────────────────────────┐
│ [B] [I] [S] [🔗]  │ Paragraph            │
│                   │ Heading 1            │
│                   │ Heading 2            │
│                   │ Heading 3            │
│                   │ Heading 4            │
│                   │ ──────────           │
│                   │ Bullet list          │
│                   │ Ordered list         │
│                   │ Task list            │
│                   │ ──────────           │
│                   │ Blockquote           │
│                   │ Code block           │
└──────────────────────────────────────────┘
```

## Risks / Trade-offs

- **[Risk]** Users won't discover slash commands
  → **Mitigation:** Empty line placeholder hint ("Type '/' for commands")

- **[Risk]** "/" is a common character in notes
  → **Mitigation:** Only triggers at line start on empty lines

- **[Risk]** Removing toolbar breaks muscle memory for some users
  → **Mitigation:** Keep keyboard shortcuts (Ctrl+B, Ctrl+I, etc.) — power users won't need toolbar

- **[Risk]** Block conversion might feel aggressive when selecting partial text
  → **Mitigation:** Accept this as the trade-off; if user wants to convert only part, they can do it manually

## Migration Plan

1. Add slash command extension with basic commands
2. Enhance BubbleMenu with block type dropdown
3. Add empty line placeholder hint
4. Remove top toolbar from UI
5. Test all formatting paths work correctly

No rollback needed — this is purely additive then subtractive to UI.

## Open Questions

1. Should we keep any top-bar actions? (Currently: Raw mode toggle, TOC toggle, export) — These could move to a context menu or keyboard shortcuts.
