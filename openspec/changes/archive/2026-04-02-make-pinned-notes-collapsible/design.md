## Context

The sidebar component currently contains two main sections: pinned notes and tags. The tags section already has a collapsible behavior, but pinned notes are always visible. Additionally, there's a visual inconsistency between how pinned notes are styled compared to notes in the file tree.

## Goals / Non-Goals

**Goals:**
- Make pinned notes section collapsible in the sidebar with consistent toggle behavior as tags section
- Apply identical styling (spacing, typography, hover states) to pinned notes items as file tree notes

**Non-Goals:**
- No changes to the notes data model or API
- No modifications to other sidebar sections beyond pinned notes

## Decisions

1. **Use existing collapsible pattern from tags section**: The tags section already implements collapsible behavior. We will replicate this pattern for pinned notes for consistency.

2. **Apply file tree note styling to pinned notes**: Extract the styling classes/values used for file tree note items and apply them to pinned notes items in the sidebar.

3. **Persist collapse state in local storage**: Store the collapsed/expanded state in local storage so it persists across sessions.

4. **Animate the collapse/expand**: Add a smooth transition for the collapse/expand action similar to the tags section.

## Risks / Trade-offs

- **Risk**: Styling changes might affect existing pinned notes functionality
  - **Mitigation**: Verify all existing interactions work after styling changes
- **Risk**: Local storage might not be available in some environments
  - **Mitigation**: Default to expanded state if local storage fails
- **Trade-off**: Additional state management for collapse state
  - **Mitigation**: Use existing state management pattern from tags section