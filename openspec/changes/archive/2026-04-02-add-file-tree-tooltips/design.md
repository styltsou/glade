## Context

Currently, file tree items show no metadata. Users cannot see when a note was created. The file tree already displays the modified date in the sidebar, but there's no creation date visible.

Note metadata (frontmatter) stores `created_at` but it's not exposed in the `VaultEntry` type - only in the `Vault` type. The Rust backend parses frontmatter but doesn't currently return `created_at` for individual entries.

## Goals / Non-Goals

**Goals:**
- Add tooltip to file tree items showing "Created {relative time}"
- Use existing shadcn Tooltip component
- Use existing `formatRelativeDate` function for consistency

**Non-Goals:**
- Show title in tooltip (too much complexity for marginal benefit)
- Show modified date in tooltip (already visible in editor header)
- Add any new styling - use default shadcn tooltip styles

## Decisions

1. **Add `created_at` to VaultEntry** - The Rust backend needs to extract and return `created_at` from frontmatter. Currently only `modified` is returned.

2. **Use shadcn Tooltip** - Already installed UI component, consistent with existing patterns.

3. **Reuse formatRelativeDate** - Already handles time-ago formatting, no new date utilities needed.

## Risks / Trade-offs

- **Risk**: Adding `created_at` requires backend changes
  - **Mitigation**: Simple extraction from frontmatter, similar to how `modified` is handled

- **Risk**: Tooltip might flicker on rapid mouse movement
  - **Mitigation**: Default shadcn behavior handles this well

- **Trade-off**: Not showing title in tooltip keeps implementation simple
