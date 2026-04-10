## 1. Find Bar UI Component

- [x] 1.1 Create `FindBar.tsx` component in `src/components/editor/`
- [x] 1.2 Implement search input field with proper styling
- [x] 1.3 Add next/previous navigation buttons (using lucide-react icons)
- [x] 1.4 Add arrow up/down navigation buttons for mouse users
- [x] 1.5 Add match counter display (e.g., "1 of 5")
- [x] 1.6 Add close button (X icon) for manual dismissal
- [x] 1.7 Style find bar to appear at top of note editor with proper positioning

## 2. Text Highlighting Extension

- [x] 2.1 Create Tiptap extension or decoration for search highlighting
- [x] 2.2 Implement highlight mark/styling for matching text
- [x] 2.3 Add active match styling (distinct from inactive matches)
- [x] 2.4 Implement function to search and highlight text in editor
- [x] 2.5 Implement function to clear all highlighting

## 3. Find State Management

- [x] 3.1 Add local state for find bar visibility in NoteEditor
- [x] 3.2 Add state for search query string
- [x] 3.3 Add state for current match index
- [x] 3.4 Add state for total match count
- [x] 3.5 Implement state reset on find bar close

## 4. Keyboard Shortcut Integration

- [x] 4.1 Add keyboard event listener in NoteEditor for Ctrl+F / Cmd+F
- [x] 4.2 Implement isModPressed helper for cross-platform detection
- [x] 4.3 Add check for editor focus state before handling shortcut
- [x] 4.4 Handle Escape key to close find bar
- [x] 4.5 Prevent default browser find behavior when editor is focused

## 5. Match Navigation

- [x] 5.1 Implement next match navigation with scroll-to-view
- [x] 5.2 Implement previous match navigation with scroll-to-view
- [x] 5.3 Implement wrap-around behavior (last to first, first to last)
- [x] 5.4 Update match counter when navigating between matches
- [x] 5.5 Handle case when no matches found (show "0 matches")
- [x] 5.6 Handle Enter key to navigate to next match
- [x] 5.7 Handle Shift+Enter to navigate to previous match
- [x] 5.8 Handle Tab to navigate to next match (prevent default focus change)
- [x] 5.9 Handle Shift+Tab to navigate to previous match (prevent default focus change)
- [x] 5.10 Handle Arrow Down to navigate to next match (prevent default scroll)
- [x] 5.11 Handle Arrow Up to navigate to previous match (prevent default scroll)

## 6. Integration & Testing

- [x] 6.1 Integrate FindBar into NoteEditor component layout
- [x] 6.2 Connect search input to highlighting function
- [x] 6.3 Connect navigation buttons to state management
- [x] 6.4 Test keyboard shortcut works in various editor states
- [x] 6.5 Test find bar appears/disappears correctly
- [x] 6.6 Test highlighting persists across editor transactions
- [x] 6.7 Test find functionality with empty editor content
