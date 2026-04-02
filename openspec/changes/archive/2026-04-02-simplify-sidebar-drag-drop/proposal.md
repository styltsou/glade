## Why

The current sidebar drag-and-drop implementation allows reordering notes and inserting items between siblings. This adds unnecessary complexity to the drop position logic and creates a poor user experience where notes can be scattered arbitrarily. Simplifying to directory-only drops will make the UI more predictable and significantly reduce code complexity.

## What Changes

- Notes cannot be reordered - when dragging a note, it stays in place with a disabled/grayed appearance
- Only directories are valid drop targets for all items
- Remove insertion line indicators (top/bottom lines) that show between siblings
- When dragging over a directory, highlight the entire directory area (Mintlify-style UX)
- Simplify drop position logic to only detect whether the item is over a valid directory target
- Refactor `dropPosition.ts` to remove sibling position calculations

## Capabilities

### New Capabilities
- `sidebar-drag-drop-simplified`: Simplified drag-and-drop that only allows moving items into directories

### Modified Capabilities
- (none)

## Impact

- **Files Modified**: `src/components/FileTree.tsx`, `src/components/FileTreeNode.tsx`, `src/utils/dropPosition.ts`
- **User Experience**: Simplified, more predictable sidebar organization
- **Code Reduction**: Significantly simpler drop position detection logic
