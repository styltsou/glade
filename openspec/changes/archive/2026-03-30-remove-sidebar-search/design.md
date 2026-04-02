## Context

This is a straightforward UI simplification - removing redundant search functionality from the sidebar. The command palette (`Cmd+P`) already provides search capabilities with full-content search, making sidebar search redundant.

## Goals / Non-Goals

**Goals:**
- Remove sidebar search bar and search results components
- Simplify sidebar to show only file tree
- Maintain command palette search functionality

**Non-Goals:**
- No changes to command palette functionality
- No changes to note storage or search backend
- No changes to file tree behavior

## Decisions

1. **Remove components entirely** rather than hiding via feature flag
   - Rationale: Keeps codebase simple; can restore from git if needed

2. **Keep search action in store** for potential future use
   - Rationale: Backend search is still used by command palette; no need to remove

## Risks / Trade-offs

- **User discovery**: Users accustomed to sidebar search may need to discover command palette
  - Mitigation: Keyboard shortcut hints in app are already present
- **Title-only search loss**: Some users may prefer quick title filtering
  - Mitigation: Command palette can still search; type quickly to filter
