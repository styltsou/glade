## 1. Prerequisites & Infrastructure

- [x] 1.1 Mount `<Toaster />` component in `src/App.tsx` (fix existing bug where sonner toasts won't render)
- [x] 1.2 Verify existing delete flow still works correctly after toaster mount

## 2. Command Palette State & Types

- [x] 2.1 Add `InteractionMethod` type definition (`'click' | 'enter' | 'keybind'`)
- [x] 2.2 Add `PendingConfirmation` interface with `actionId`, `method`, and optional `keybind` fields
- [x] 2.3 Add `pendingDeleteConfirmation` state variable to CommandPalette component
- [x] 2.4 Add function to cancel pending confirmation state

## 3. Modify handleSelectAction for Interaction Tracking

- [x] 3.1 Update `handleSelectAction` signature to accept `source: 'click' | 'keyboard'` parameter
- [x] 3.2 Update click handler in ItemRow to pass `source: 'click'`
- [x] 3.3 Update keyboard handler to pass `source: 'keyboard'`
- [x] 3.4 Update keybind handler in useCommandShortcuts to route through palette when open

## 4. Inline Confirmation UI in ItemRow

- [x] 4.1 Add `confirmationText` prop to ItemRow component
- [x] 4.2 Add danger variant styling for confirmation state (red text, warning indicator)
- [x] 4.3 Display confirmation text when `confirmationText` prop is provided
- [x] 4.4 Add keyboard shortcut hint display in confirmation state

## 5. Confirmation Logic & Execution

- [x] 5.1 In `handleSelectAction`, when pending confirmation exists, check if source matches the pending method
- [x] 5.2 If source matches, execute the delete action (skip modal)
- [x] 5.3 If source doesn't match, update the pending confirmation to the new method
- [x] 5.4 After successful delete, close palette, execute delete, show toast with undo

## 6. Cancellation & Edge Cases

- [x] 6.1 Cancel pending confirmation on navigation (arrow keys)
- [x] 6.2 Cancel pending confirmation on Escape key
- [x] 6.3 Cancel pending confirmation on palette close/blur
- [x] 6.4 Handle case where pending action item is no longer visible (cancel state)

## 7. Keybind Routing Through Palette

- [x] 7.1 Modify `useCommandShortcuts` to accept palette open state or callback
- [x] 7.2 When palette is open and delete keybind is pressed, route through `handleSelectAction` instead of opening modal
- [x] 7.3 Test that `Cmd+D` outside palette still opens modal

## 8. Toast Integration

- [x] 8.1 Implement `toast.success()` call after successful delete with item name
- [ ] 8.2 Add Undo action to toast with click handler
- [ ] 8.3 Implement undo logic that restores deleted item to original position
- [x] 8.4 Set toast timeout to 5 seconds

## 9. Testing & Polish

- [ ] 9.1 Test click-triggered delete confirmation flow
- [ ] 9.2 Test Enter-triggered delete confirmation flow
- [ ] 9.3 Test keybind-triggered delete confirmation flow (palette open)
- [ ] 9.4 Test that keybind outside palette still opens modal
- [ ] 9.5 Test navigation/Escape cancellation of pending state
- [ ] 9.6 Test toast appears with undo option
- [ ] 9.7 Test undo restores item correctly
