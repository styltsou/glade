## Why

Users need to quickly locate specific text within their notes, especially as notes grow longer. Implementing a find functionality similar to code editors will significantly improve navigation and usability without requiring external tools or workarounds.

## What Changes

- Add a global keyboard shortcut (Ctrl+F / Cmd+F) to activate find mode in the note view
- Implement a search bar that appears at the top of the note editor when activated
- Support incremental search that highlights matching text as user types
- Add next/previous match navigation buttons
- Support Escape key to close the find bar and clear search state

## Capabilities

### New Capabilities
- `note-find`: Search functionality within note content with keyboard-driven UI

### Modified Capabilities
- None (new capability, no existing spec modifications needed)

## Impact

- New UI component: FindBar component with input field and navigation controls
- Keyboard event handling in note editor context
- Text highlighting overlay in editor
- No API or data model changes required
