## 1. Add Pinned Notes Collapse State to Store

- [x] 1.1 Add `pinnedNotesCollapsed` boolean state to the store
- [x] 1.2 Add `togglePinnedNotesCollapsed` action to toggle the state
- [x] 1.3 Add persistence for `pinnedNotesCollapsed` in `saveSidebarState`/`loadSidebarState`

## 2. Update PinnedSection with Collapsible Toggle

- [x] 2.1 Import ChevronRight and ChevronDown icons from lucide-react
- [x] 2.2 Add collapsible header with toggle button (matching TagsPanel pattern)
- [x] 2.3 Add grid transition for collapse/expand animation
- [x] 2.4 Connect toggle button to `togglePinnedNotesCollapsed` store action

## 3. Apply Consistent Styling with FileTree Notes

- [x] 3.1 Update PinnedItem styling to match FileTreeNode note styling exactly
- [x] 3.2 Ensure hover states use `hover:bg-sidebar-accent` consistently
- [x] 3.3 Ensure font weight differs between active/inactive (font-normal vs font-medium like FileTreeNode)