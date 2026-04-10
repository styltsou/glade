## 1. State Management

- [x] 1.1 Add readEditMode state to Zustand store (Map<notePath, boolean>)
- [x] 1.2 Add persistence for readEditMode state (localStorage or electron store)
- [x] 1.3 Update note state to include readEditMode when loading notes

## 2. Editor Component Updates

- [x] 2.1 Add isEditMode prop to Editor component
- [x] 2.2 Pass isEditMode to NoteEditor component
- [x] 2.3 Conditionally set TipTap editable prop based on isEditMode
- [x] 2.4 Handle mode state when switching between notes (save/restore)

## 3. NoteEditor Component Updates

- [x] 3.1 Add double-click handler to enter edit mode
- [x] 3.2 Pass isEditMode and onEnterEditMode callback to NoteEditor
- [x] 3.3 Ensure single click in read mode still allows text selection

## 4. Keyboard Shortcut

- [x] 4.1 Add Cmd/Ctrl+E keyboard shortcut handler in Editor.tsx
- [x] 4.2 Toggle read/edit mode when shortcut is pressed

## 5. Exit Edit Mode

- [x] 5.1 Handle click outside note (sidebar, file tree) to exit edit mode
- [x] 5.2 Save edit mode state before exiting

## 6. Cursor and Scroll Position

- [x] 6.1 Ensure scroll position is restored on note load (read mode)
- [x] 6.2 Ensure both scroll and cursor position restored in edit mode
- [x] 6.3 Save cursor position when leaving edit mode

## 7. Visual Indicator

- [x] 7.1 Add mode indicator to NoteHeader component
- [x] 7.2 Display appropriate icon/text for read mode vs edit mode

## 8. Title Field Independence

- [x] 8.1 Ensure title field remains editable in read mode
- [x] 8.2 Test title editing works in both read and edit modes

## 9. Raw Mode Independence

- [x] 9.1 Ensure read/edit mode works independently of raw mode toggle
- [x] 9.2 Test all four combinations: read+raw, read+rendered, edit+raw, edit+rendered