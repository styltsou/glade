## Why

File tree items currently have no way to see when a note was created. Users need to know the creation date to understand note age and context, especially in vaults with many notes.

## What Changes

- Add shadcn Tooltip component to file tree items
- Tooltip shows "Created {relative time}" e.g., "Created 2 days ago"
- Uses existing `formatRelativeDate` function for consistency with modified date display

## Capabilities

### New Capabilities
- `file-tree-tooltips`: Show created_at date in tooltips on file tree items

### Modified Capabilities
- None

## Impact

- New dependency: `@radix-ui/react-tooltip` (via shadcn)
- Modified: `FileTreeNode.tsx` - adds tooltip wrapper
- Uses existing `entry.created_at` field from `VaultEntry` type
