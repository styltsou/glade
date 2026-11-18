# Known Issues

Deferred items and rough edges.

## 1. Tab and pane polish
- Tab and `+` animations are still being tuned.

## 2. No in-app conflict merge
- If a file changes on disk while you have unsaved edits, you choose "Keep mine" or "Load theirs". There is no side-by-side merge.

## 3. No on-disk index cache
- Task 4.4 of the file-first change (a per-folder index cache) is deferred: scanning 5,000 notes takes about 92 ms uncached. Revisit for very large folders.

## 4. Raw mode scrollbars
- The raw markdown editor can show a second scrollbar next to the main container in some layouts.
