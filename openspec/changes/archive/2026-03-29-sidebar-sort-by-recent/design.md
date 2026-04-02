## Context

The sidebar displays a tree of vault entries (files and directories). The `sortEntries()` function in `file-tree-helpers.ts` currently sorts directories first (alphabetically), then files (alphabetically). The `VaultEntry` type already includes a `modified` timestamp field.

## Goals / Non-Goals

**Goals:**
- Sort files by `modified` timestamp (most recent first)
- Keep directories sorted alphabetically and always at the top
- Handle the edge case of `null` modified timestamps (unsaved new notes)

**Non-Goals:**
- Allow manual drag-and-drop reordering of entries
- Change how entries are moved into/out of folders
- Add caching or performance optimizations (not needed for this scope)

## Decisions

### Sort order for files

**Decision**: Sort files by `modified` descending (newest first).

**Rationale**: Users typically want quick access to notes they recently worked on. Descending order places the most recently modified files at the top of the file section.

**Implementation**: Compare `modified` timestamps as Date objects or ISO strings. Use `new Date(b.modified) - new Date(a.modified)` for descending order.

### Handling `null` modified timestamps

**Decision**: Files with `null` modified sort at the top with the newest notes.

**Rationale**: Unsaved new notes are actively being created and should be easily accessible. Treating them as "newest" places them prominently without requiring special UI treatment.

**Implementation**: Treat `null` as "infinity" - if either `modified` is `null`, treat it as newer than any date.

```
if (a.modified === null && b.modified === null) return 0;
if (a.modified === null) return -1;  // a is "newer"
if (b.modified === null) return 1;   // b is "newer"
```

## Risks / Trade-offs

**[Low risk]** Performance impact is minimal - sort is O(n log n) which is acceptable for sidebar file lists.

**[Trade-off]** Users who rely on alphabetical ordering for finding files may need adjustment. However, most users access recently worked notes more frequently than searching alphabetically.

## Open Questions

None - implementation is straightforward.
