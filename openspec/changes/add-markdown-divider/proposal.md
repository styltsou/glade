## Why

Users need a way to visually separate content sections within notes. While markdown supports horizontal rules natively (`---`, `***`, `___`), the current Tiptap editor doesn't provide a way to insert them through the UI—users must switch to raw markdown mode to add them manually.

## What Changes

- Add a horizontal rule (divider) option to the editor toolbar
- Enable standard markdown horizontal rule syntax to work in the rich text editor
- Horizontal rules serialize as `---` (consistent with other markdown output)

## Capabilities

### New Capabilities
- `horizontal-rule`: Insert a horizontal rule/divider to visually separate content sections

### Modified Capabilities
- None

## Impact

- **Editor**: Add HorizontalRule node to Tiptap extensions, add toolbar button
- **Storage**: Horizontal rules already serialize correctly to markdown `---`
