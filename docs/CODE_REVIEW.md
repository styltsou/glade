# Code Review - Glade Notes App

**Date:** 2026-03-11  
**Reviewer:** opencode  
**Scope:** Full codebase (TypeScript/React frontend + Rust/Tauri backend)

---

## Executive Summary

The codebase is well-structured overall with good separation of concerns using Zustand slices. However, there are several areas that could benefit from refactoring to improve maintainability, reduce complexity, and enhance type safety.

---

## Quick Wins (Low Risk)

- [x] 1. Add proper types to `suggestion.ts` (6 type fixes)
- [x] 2. Create `NoteSearchResult` interface and fix `CommandPalette.tsx` type issues
- [x] 3. Extract `flattenNotes()` to utility file

---

## Medium Effort (Moderate Risk)

- [ ] 4. Split `vaultSlice.ts` into focused slices
- [ ] 5. Extract tree helpers from vaultSlice to `src/lib/tree.ts`
- [ ] 6. Extract VaultCard from VaultsSection.tsx to separate file

---

## Larger Refactoring (Higher Risk)

- [ ] 7. Split FileTreeNode.tsx with hooks (DnD logic, drop position)

---

## Positive Patterns (Keep These)

- [x] Zustand slice pattern - well implemented with clear interfaces
- [x] Optimistic updates with rollback - good UX, proper error handling
- [x] Debouncing - properly implemented for search and saves
- [x] Race condition handling - well thought out in selectNote
- [x] Cache management - solid implementation
- [x] Type definitions - good use of TypeScript interfaces
- [x] Component organization - logical folder structure

---

## Future Improvements - Optimistic Updates

> The codebase uses optimistic updates extensively for better UX. While this makes the code harder to understand and maintain, it provides a snappy user experience.
>
> **Future Consideration:** In the future, consider creating a library or custom Zustand middleware to handle optimistic updates with a cleaner API. This could include:
> - Decorators/annotations for "optimistic" actions
> - Automatic rollback on failure
> - Visual indicators for pending vs confirmed states
> - Testing utilities for race conditions

---

## Notes

- Recent changes to note view (saved label visibility) don't impact overall architecture
- Rust backend is well-structured with no major issues
- UI components follow shadcn/ui conventions properly
