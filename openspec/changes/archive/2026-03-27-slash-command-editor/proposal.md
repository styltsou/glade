## Why

The note editor currently has a top toolbar for formatting (headings, bold, lists, etc.) that has state syncing issues and clutters the interface. Replacing it with slash commands (like Notion/Mintlify) provides a cleaner, keyboard-first experience while also solving the BubbleMenu limitation — when users highlight text, they'll be able to convert entire blocks to different types (paragraph, heading 1-4, list, etc.) via an expanded popover.

## What Changes

- **Remove top toolbar** (`EditorToolbar.tsx` and `ToolbarGroups.tsx`) — eliminates the state syncing issues and reclaims vertical space
- **Add slash command menu** — triggers anywhere in line when user types "/", provides formatting options (headings, lists, blockquote, code block, horizontal rule, link). When selecting a command, converts the current parent block to the selected type.
- **Expand BubbleMenu on selection** — when text is selected, show current formatting options PLUS a dropdown to convert the parent block to a different type (heading 1-4, paragraph, bullet list, ordered list, blockquote, code block)
- **Add empty line hint** — show subtle "Type '/' for commands" hint on empty lines, similar to Mintlify

## Capabilities

### New Capabilities
- `slash-commands`: Triggers anywhere in line when user types "/", provides inline and block formatting options. Converts current parent block to selected type.
- `block-type-conversion`: When text is selected and BubbleMenu is open, allow converting the entire parent block to a different type via dropdown

### Modified Capabilities
- (none — existing formatting capabilities remain, just moved to different UI)

## Impact

- **Code removed**: `EditorToolbar.tsx`, `ToolbarGroups.tsx`, references in `NoteEditor.tsx`
- **Code added**: Slash command extension (using Tiptap Suggestion), BubbleMenu enhancement
- **UI change**: Toolbar gone, slash menu and enhanced BubbleMenu added
- **Dependencies**: Already using `@tiptap/suggestion` for note-linking, will reuse for slash commands
