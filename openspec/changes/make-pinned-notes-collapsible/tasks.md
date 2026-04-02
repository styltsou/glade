## 1. Add Pinned Notes Collapse State to Store

- [ ] 1.1 Add `pinnedNotesCollapsed` boolean state to the store
- [ ] 1.2 Add `togglePinnedNotesCollapsed` action to toggle the state
- [ ] 1.3 Add persistence for `pinnedNotesCollapsed` in `saveSidebarState`/`loadSidebarState`

## 2. Update PinnedSection with Collapsible Toggle

- [ ] 2.1 Import ChevronRight and ChevronDown icons from lucide-react
- [ ] 2.2 Add collapsible header with toggle button (matching TagsPanel pattern)
- [ ] 2.3 Add grid transition for collapse/expand animation
- [ ] 2.4 Connect toggle button to `togglePinnedNotesCollapsed` store action

## 3. Apply Consistent Styling with FileTree Notes

- [ ] 3.1 Update PinnedItem styling to match FileTreeNode note styling exactly
- [ ] 3.2 Ensure hover states use `hover:bg-sidebar-accent` consistently
- [ ] 3.3 Ensure font weight differs between active/inactive (font-normal vs font-medium like FileTreeNode)