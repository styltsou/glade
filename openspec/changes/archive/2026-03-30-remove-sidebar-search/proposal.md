## Why

The sidebar search bar takes valuable vertical space in the sidebar and provides redundant functionality. The command palette (opened via `Cmd+P` or `Cmd+K`) already offers global note search with full-content search capabilities. The sidebar search only searches titles, which doesn't justify its UI footprint.

## What Changes

- **Remove** `SidebarSearch.tsx` component from `src/components/sidebar/`
- **Remove** `SearchResultsList.tsx` component from `src/components/sidebar/`
- **Update** `Sidebar.tsx` to remove search-related state and rendering logic
- **Clean up** any unused store actions related to sidebar search (`setSidebarQuery`, etc.)

## Capabilities

### New Capabilities
None - this is a removal of existing functionality.

### Modified Capabilities
None - removing a UI component doesn't change any capability requirements.

## Impact

- **Removed files**:
  - `src/components/sidebar/SidebarSearch.tsx`
  - `src/components/sidebar/SearchResultsList.tsx`
- **Modified files**:
  - `src/components/Sidebar.tsx` - remove search integration
  - `src/store/slices/vaultSlice.ts` - may retain search action but won't be called from sidebar
- **User impact**: Users will need to use command palette (`Cmd+P`) for searching notes. Sidebar will show only file tree.
