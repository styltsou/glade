## ADDED Requirements

### Requirement: Command palette tracks delete action trigger method

When a user triggers a delete action (delete-note or delete-folder) from the command palette, the system SHALL track the interaction method used:
- **click**: User clicked on the action item
- **enter**: User pressed Enter after navigating to the action
- **keybind**: User pressed a keybind (e.g., `⌘D`) that triggered the action while palette is open

#### Scenario: User clicks delete action
- **WHEN** user clicks on "Delete Note" or "Delete Folder" action in the command palette
- **THEN** system records the trigger method as "click"

#### Scenario: User presses Enter on delete action
- **WHEN** user navigates to "Delete Note" or "Delete Folder" action and presses Enter
- **THEN** system records the trigger method as "enter"

#### Scenario: User presses keybind while palette is open
- **WHEN** user presses `⌘D` (or configured delete keybind) while command palette is open
- **THEN** system records the trigger method as "keybind" along with the keybind used

### Requirement: Delete action shows pending confirmation state

When a delete action is triggered from the command palette, the action item SHALL enter a "pending confirmation" state that:
- Displays danger-variant styling (red text, warning icon)
- Shows confirmation text specific to the trigger method
- Remains in the pending state until user confirms or cancels

#### Scenario: Confirmation text for click trigger
- **WHEN** delete action was triggered by click and is in pending confirmation state
- **THEN** action item SHALL display "Click again to confirm"

#### Scenario: Confirmation text for enter trigger
- **WHEN** delete action was triggered by Enter key and is in pending confirmation state
- **THEN** action item SHALL display "Press Enter to confirm"

#### Scenario: Confirmation text for keybind trigger
- **WHEN** delete action was triggered by keybind and is in pending confirmation state
- **THEN** action item SHALL display "Press ⌘D to confirm" (using the actual keybind pressed)

### Requirement: Pending confirmation is confirmed by repeating the same interaction

The system SHALL require the user to repeat the same interaction method to confirm the pending delete action:
- **click** pending: User must click again
- **enter** pending: User must press Enter again
- **keybind** pending: User must press the same keybind again

#### Scenario: User confirms by clicking again
- **WHEN** pending confirmation was triggered by click
- **AND** user clicks the action item again
- **THEN** system SHALL execute the delete action

#### Scenario: User confirms by pressing Enter again
- **WHEN** pending confirmation was triggered by Enter
- **AND** user presses Enter again
- **THEN** system SHALL execute the delete action

#### Scenario: User confirms by pressing keybind again
- **WHEN** pending confirmation was triggered by keybind (e.g., `⌘D`)
- **AND** user presses the same keybind again
- **THEN** system SHALL execute the delete action

### Requirement: Pending confirmation is cancelled by navigation or Escape

The system SHALL cancel the pending confirmation state when:
- User navigates to a different action item (arrow keys)
- User presses Escape
- User closes the command palette

#### Scenario: Navigation cancels pending confirmation
- **WHEN** pending confirmation is active
- **AND** user navigates to a different action item
- **THEN** pending confirmation state SHALL be cancelled

#### Scenario: Escape cancels pending confirmation
- **WHEN** pending confirmation is active
- **AND** user presses Escape
- **THEN** pending confirmation state SHALL be cancelled

#### Scenario: Closing palette cancels pending confirmation
- **WHEN** pending confirmation is active
- **AND** user closes the command palette
- **THEN** pending confirmation state SHALL be cancelled

### Requirement: Delete execution closes palette and shows toast

After successful delete confirmation, the system SHALL:
1. Close the command palette
2. Execute the delete operation
3. Navigate to the parent item (since deleted item is no longer available)
4. Display a toast notification with undo option

#### Scenario: Toast notification after deletion
- **WHEN** delete action is confirmed and executed
- **THEN** system SHALL display toast: "Deleted {item-name}"
- **AND** toast SHALL include "Undo" action button
- **AND** toast SHALL auto-dismiss after 5 seconds

#### Scenario: Undo restores deleted item
- **WHEN** user clicks "Undo" on the delete toast within the timeout period
- **THEN** system SHALL restore the deleted item to its original position

### Requirement: Delete outside command palette uses existing modal

When a delete keybind is pressed while the command palette is closed, the system SHALL use the existing modal confirmation dialog (not the inline pattern).

#### Scenario: Delete keybind outside palette opens modal
- **WHEN** command palette is closed
- **AND** user presses `⌘D` (or configured delete keybind)
- **THEN** system SHALL open the DeleteConfirmDialog modal

### Requirement: Command palette is aware of keybind actions

When a keybind triggers a delete action while the palette is open, the palette SHALL intercept and handle the action through its own flow.

#### Scenario: Keybind triggers inline confirmation while palette open
- **WHEN** command palette is open
- **AND** user presses `⌘D`
- **THEN** palette SHALL show pending confirmation state
- **AND** SHALL NOT open the modal dialog

### Requirement: Toaster component is mounted

The system SHALL mount the Sonner Toaster component in the application root to enable toast notifications.

#### Scenario: Toaster is rendered in App
- **WHEN** App component renders
- **THEN** system SHALL render `<Toaster />` component from sonner
- **AND** Toaster SHALL be visible in the UI when toasts are triggered
