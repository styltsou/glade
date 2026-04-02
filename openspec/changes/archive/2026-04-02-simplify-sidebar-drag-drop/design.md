## Context

The current sidebar drag-and-drop implementation uses `@dnd-kit` with complex position calculation logic in `dropPosition.ts`. It supports:
- Reordering notes within the same parent
- Inserting items above/below any item (shown with insertion line indicators)
- Moving items into folders

This creates visual noise (insertion lines) and allows scattered note placement that undermines folder organization.

## Goals / Non-Goals

**Goals:**
- Simplify drag-and-drop to only allow moving items into directories
- Improve visual feedback when dragging over folders (highlight entire folder area)
- Remove complexity from drop position calculations

**Non-Goals:**
- Adding new features beyond simplification
- Changing the file tree data structure
- Modifying other sidebar functionality

## Decisions

### 1. Disable note reordering
**Decision**: When dragging a note (non-directory item), the note stays in place with a disabled/grayed appearance. Dragging is effectively disabled for notes.

**Rationale**: Notes should be organized within folders, not reordered arbitrarily. This matches the user's requirement and simplifies UX.

### 2. Only directories as drop targets
**Decision**: All drag operations only consider directories as valid drop targets. Dropping on a note is ignored.

**Rationale**: Eliminates the need for "top"/"bottom" position calculations entirely. Only "into" position matters.

### 3. Remove insertion line indicators
**Decision**: Remove the visual insertion lines (the `h-0.5 bg-primary` divs) that appear above/below items during drag.

**Rationale**: These are no longer needed since we don't support reordering. Reduces visual noise.

### 4. Full directory highlight (Mintlify-style)
**Decision**: When dragging over a directory, highlight the entire directory area (including children when expanded) rather than just a portion.

**Rationale**: Provides clearer feedback that the directory is a valid drop target. Mimics Mintlify UX as requested.

### 5. Simplified drop position logic
**Decision**: Simplify `dropPosition.ts` to only return `into` or `null`. Remove `top` and `bottom` variants.

**Rationale**: Dramatically reduces code complexity. No longer need to calculate relative positions within an item.

## Risks / Trade-offs

- **Risk**: Users who previously relied on note reordering may be confused
  - **Mitigation**: This is an intentional simplification. Users can still organize notes by moving them between folders.

- **Risk**: Breaking change for existing users who use drag-drop extensively
  - **Mitigation**: The new behavior is more restrictive but more organized. Clear UX signals (grayed notes, highlighted directories) make the change obvious.

- **Trade-off**: Less flexibility in exchange for simpler code and more predictable UI
  - **Acceptable**: The majority use case is organizing notes into folders, not fine-grained reordering.
