## 1. Implementation Complete

The drag-and-drop has been rethought from scratch with a simpler approach:

### FileTree.tsx
- Uses `useDroppable` for root drop zone
- Single `DndContext` without `SortableContext`
- `handleDragOver` tracks `overId` to detect valid targets
- `handleDragEnd` processes drops: root or directory only

### FileTreeNode.tsx
- Uses `useSortable` only for drag state (isDragging, isOver)
- No more position calculations
- Notes show disabled state when dragging
- Directories show ring + background highlight when isOver
- Children area also highlighted when folder is drop target

### Removed
- `dropPosition.ts` - no longer needed
- All position calculation logic
- SortableContext (was forcing reordering)

## 2. Testing Required

- [ ] Notes show disabled/grayed when dragging
- [ ] Directories highlight with ring + background when dragging over
- [ ] Children area also highlighted when folder is target
- [ ] Root area highlights when dragging over empty space
- [ ] Items can be moved into directories
- [ ] Items can be moved to root
- [ ] Dropping on notes is ignored
- [ ] ESC cancels drag
