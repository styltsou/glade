## Why

The sidebar currently sorts directories first (alphabetically), then files (alphabetically). This works well for reference materials but creates friction when actively working on notes. Users must scan through older entries to find recently modified notes. Sorting by most recent reduces friction for the common "return to what I was working on" workflow.

## What Changes

- Modify `sortEntries()` in `src/components/sidebar/file-tree-helpers.ts` to sort files by `modified` timestamp (most recent first)
- Directories remain sorted alphabetically and always positioned at the top (no change)
- Existing drag-and-drop behavior remains unchanged (only move in/out of folders, no manual reordering)
- Edge case: files with `null` modified (unsaved new notes) sort at the top with the newest

## Capabilities

### New Capabilities
None - this is a UX refinement to existing sorting behavior.

### Modified Capabilities
None - no spec-level requirements are changing, only internal sort implementation.

## Impact

- **Code**: `src/components/sidebar/file-tree-helpers.ts` - `sortEntries()` function
- **Testing**: Verify sort order in sidebar tree view with various modified timestamps
