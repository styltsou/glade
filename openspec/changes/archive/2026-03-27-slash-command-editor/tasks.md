## 1. Setup Slash Command Extension

- [x] 1.1 Create slash command extension file in `src/components/editor/extensions/slash-commands.ts`
- [x] 1.2 Implement suggestion configuration with "/" trigger
- [x] 1.3 Register slash commands list (h1-h4, bullet, ordered, task, quote, code, hr, link)

## 2. Create Slash Command Menu UI

- [x] 2.1 Create `SlashCommandMenu.tsx` component with command list
- [x] 2.2 Add keyboard navigation (arrow keys, enter, escape)
- [x] 2.3 Add mouse click handler for command selection
- [x] 2.4 Style menu to match editor aesthetics

## 3. Add Empty Line Hint

- [x] 3.1 Configure placeholder extension in editor config
- [x] 3.2 Set placeholder text to "Type '/' for commands" on empty lines only

## 4. Enhance BubbleMenu for Block Conversion

- [x] 4.1 Add dropdown arrow button to existing BubbleMenu in `NoteEditor.tsx`
- [x] 4.2 Create block type dropdown component
- [x] 4.3 Implement parent block detection logic
- [x] 4.4 Implement block conversion function (convert parent block to selected type)
- [x] 4.5 Wire up dropdown items to conversion logic

## 5. Remove Top Toolbar

- [x] 5.1 Remove EditorToolbar from NoteEditor (remove from JSX)
- [x] 5.2 Remove EditorToolbar.tsx file
- [x] 5.3 Remove ToolbarGroups.tsx file
- [x] 5.4 Clean up any imports/references

## 6. Test and Fix

- [x] 6.1 Test slash command triggers at line start
- [x] 6.2 Test slash does NOT trigger mid-line
- [x] 6.3 Test all slash commands apply correct formatting
- [x] 6.4 Test BubbleMenu appears on selection
- [x] 6.5 Test block type conversion from dropdown
- [x] 6.6 Test inline formatting still works (bold, italic, strike, link)
- [x] 6.7 Test empty line hint shows and disappears correctly
- [x] 6.8 Verify keyboard shortcuts still work (Ctrl+B, Ctrl+I, etc.)
