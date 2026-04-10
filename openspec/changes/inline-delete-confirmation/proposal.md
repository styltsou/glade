## Why

The command palette currently delegates destructive actions (delete folder, delete note) to a separate confirmation modal dialog. This creates unnecessary friction and context switching. Instead, we can use an inline "confirmation state" pattern — common in VS Code and OpenCode — where the action item itself enters a pending confirmation state, adapting its text to show the user exactly what action they should take based on how they initiated it.

## What Changes

- Delete actions in the command palette now show an inline confirmation state instead of opening a modal dialog
- The confirmation state displays text specific to the interaction method used:
  - Click → "Click again to confirm"
  - Enter → "Press Enter to confirm"
  - Keybind (e.g., `⌘D`) → "Press ⌘D to confirm"
- The command palette remains open during the confirmation flow, preserving context
- After successful deletion, the palette closes and a toast notification appears with an Undo option
- Deleting outside the command palette (e.g., via `⌘D` keybind when palette is closed) continues to use the existing modal confirmation

## Capabilities

### New Capabilities

- `command-palette-inline-confirmation`: Pattern for inline confirmation states in the command palette for destructive actions
  - Trigger method tracking (click, enter, keybind)
  - Adaptive confirmation text display
  - Danger variant styling for pending confirmations
  - Re-confirmation via same interaction method
  - Toast notification on successful deletion with undo support

### Modified Capabilities

- (none)

## Impact

- **Affected Files**:
  - `src/components/CommandPalette.tsx` — main changes for inline confirmation logic
  - `src/components/ui/sonner.tsx` — `<Toaster />` component needs to be mounted in App
  - `src/App.tsx` — add `<Toaster />` component
- **Behavior Changes**:
  - Delete via command palette: no modal, inline confirm state
  - Delete via keybind outside palette: unchanged (modal)
- **New Dependencies**: None
