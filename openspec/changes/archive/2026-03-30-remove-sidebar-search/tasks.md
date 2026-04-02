## 1. Remove Sidebar Search Components

- [x] 1.1 Delete `src/components/sidebar/SidebarSearch.tsx`
- [x] 1.2 Delete `src/components/sidebar/SearchResultsList.tsx`

## 2. Update Sidebar Integration

- [x] 2.1 Open `src/components/Sidebar.tsx` and remove SidebarSearch import
- [x] 2.2 Remove SearchResultsList import and rendering logic
- [x] 2.3 Remove sidebar search state (`isSearchActive`, `sidebarQuery`)
- [x] 2.4 Remove search-related handlers and effects

## 3. Verify and Test

- [x] 3.1 Run the app and confirm sidebar shows only file tree
- [x] 3.2 Verify command palette search still works (`Cmd+P`)
- [x] 3.3 Run lint/typecheck to ensure no broken imports
