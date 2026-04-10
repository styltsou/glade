## Context

The command palette (`CommandPalette.tsx`) currently shows delete actions (`delete-note`, `delete-folder`) that trigger the `openDelete()` action, which opens the `DeleteConfirmDialog` modal. This modal interrupts the user's flow and requires context switching.

The goal is to replace this modal-based confirmation with an inline confirmation pattern that:
1. Tracks the interaction method used to trigger the delete action
2. Shows the action item in a "pending confirmation" state with adaptive text
3. Requires a second interaction using the same method to confirm

### Current Flow
```
User triggers delete action → handleSelectAction() → openDelete() → Modal opens
```

### Desired Flow (when palette is open)
```
User triggers delete action → handleSelectAction() 
  → Set pending confirmation state (track method: click/enter/keybind)
  → ItemRow shows confirm text based on method
User confirms (same method) → Execute delete → Close palette → Show toast
```

### Interaction Method Tracking
The command palette needs to distinguish between:
- **click**: User clicked the action item
- **enter**: User pressed Enter after navigating to the action
- **keybind**: User pressed a keybind (e.g., `⌘D`) that triggered the action while palette is open

Keybind handling happens in `useCommandShortcuts.ts`. When a keybind fires while the palette is open, the palette should be aware that a keybind was used to trigger an action.

## Goals / Non-Goals

**Goals:**
- Replace modal-based delete confirmation with inline confirmation in command palette
- Track and reflect the interaction method (click/enter/keybind) in confirmation text
- Maintain the same safety guarantees (no accidental deletions)
- Close palette after successful deletion, navigate to parent
- Show toast notification with undo option after deletion

**Non-Goals:**
- Change behavior when deleting outside the command palette (keybinds when palette is closed still use modal)
- Add undo/redo infrastructure beyond the immediate delete toast
- Modify other destructive actions (currently only delete needs this UX)

## Decisions

### 1. How to track the interaction method

**Decision:** Add a state variable `pendingDeleteConfirmation` in `CommandPalette` with shape:
```typescript
type InteractionMethod = 'click' | 'enter' | 'keybind';

interface PendingConfirmation {
  actionId: 'delete-note' | 'delete-folder';
  method: InteractionMethod;
  keybind?: string; // e.g., '⌘D' for keybind method
}
```

**Rationale:** Simple, localized state in the CommandPalette component. The `handleSelectAction` function already receives the action object, so we can determine the method from there.

**Alternative:** Could use a custom event or context, but that's overkill for a single component concern.

### 2. How to determine the interaction method in `handleSelectAction`

**Decision:** Add a parameter to `handleSelectAction` indicating the source:
```typescript
handleSelectAction(action: Action, source: 'click' | 'keyboard')
```

The `source` is `'click'` when called from `ItemRow.onClick`, and `'keyboard'` when called from the keyboard handler (including keybinds via `useCommandShortcuts`).

**Keybinds from outside:** When `Cmd+D` is pressed while palette is open, we need to route through `handleSelectAction` with `source: 'keyboard'`. The `useCommandShortcuts` hook will need to be aware of the palette state.

### 3. How to render the adaptive confirmation text

**Decision:** Modify `ItemRow` to accept an optional `confirmationText` prop. When set, the item shows danger styling and the confirmation text instead of the action title.

```typescript
interface ItemRowProps {
  // ... existing props
  confirmationText?: string; // e.g., "Click again to confirm"
}
```

The text displayed is:
- `method === 'click'` → "Click again to confirm"
- `method === 'enter'` → "Press Enter to confirm"
- `method === 'keybind'` → "Press ⌘D to confirm" (use the actual keybind)

### 4. How to handle the confirmation (second interaction)

**Decision:** In the pending confirmation state:
- Clicking the item again (if method was click) executes delete
- Pressing Enter again (if method was enter or keybind) executes delete
- Navigating away (arrow keys, blur) cancels the pending state
- Pressing Escape cancels the pending state

This matches VS Code's behavior and is intuitive: "do it again to confirm."

### 5. Toast notification after deletion

**Decision:** Use the existing Sonner toast system. Show:
```typescript
toast.success(`Deleted ${name}`, {
  action: {
    label: 'Undo',
    onClick: () => undoDelete(path)
  }
});
```

**Note:** The `<Toaster />` component is currently not mounted in `App.tsx`. This needs to be added.

## Risks / Trade-offs

**[Risk]** Keybind routing complexity — `useCommandShortcuts` is a separate hook that doesn't know about palette state.
→ **Mitigation:** Modify `useCommandShortcuts` to accept a callback when palette is open, so it can route delete keybinds through the palette instead of directly opening the modal.

**[Risk]** Edge case: User has two keybinds for delete (e.g., `Cmd+D` and `Ctrl+Backspace`).
→ **Mitigation:** Track the actual keybind used in the pending confirmation state. Show "Press ⌘D to confirm" if they used `Cmd+D`, regardless of whether other keybinds exist.

**[Risk]** Toast Undo functionality requires the deleted data to be kept in memory until the toast times out.
→ **Mitigation:** The current delete implementation already has optimistic UI updates. We need to preserve the deleted data temporarily for undo. The toast should have a 5-second timeout.

## Open Questions

1. **Undo scope:** Should undo restore the item to its exact position, or just re-add it somewhere? (Recommendation: exact position for best UX)

2. **Confirmation state persistence:** If user navigates to a different item while pending confirmation is active, should we keep the pending state or cancel it? (Recommendation: cancel it — simpler, less surprising)

3. **Multiple dangerous actions:** If we add more destructive actions (e.g., "Reset vault"), should they use the same inline confirmation pattern? (Recommendation: yes, make it a reusable pattern)
