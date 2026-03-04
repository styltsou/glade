# Glade — Command Palette Implementation Spec

## Overview

The command palette is a unified, keyboard-driven interface for navigating notes and executing commands. Triggered via `Cmd+P` (macOS) / `Ctrl+P` (Windows/Linux), it replaces the need for separate search and command UIs. One input, mixed results, smart ranking.

---

## Trigger & Dismissal

| Action | Behavior |
|---|---|
| `Cmd+P` / `Ctrl+P` | Open palette |
| `Escape` | Close palette |
| Click outside | Close palette |
| `Enter` | Execute selected result |
| `↑` / `↓` | Navigate results |

---

## UI Structure

```
┌─────────────────────────────────────────┐
│  🔍  Search notes and commands...        │
├─────────────────────────────────────────┤
│  NOTES                                  │
│  🗒  Kubernetes setup              note  │
│  🗒  Meeting notes — Q1            note  │
│                                         │
│  COMMANDS                               │
│  ⌘  Create new note             Cmd+N  │
│  ⌘  Pin note                           │
│  ⌘  Duplicate note                     │
└─────────────────────────────────────────┘
```

- Fixed width (~560px), centered, top-third of screen
- Keyboard focus trapped inside while open
- Input is auto-focused on open

---

## Result Types

### Note Results

Displayed when the query matches a note title or note content.

| Field | Description |
|---|---|
| Icon | Document icon |
| Title | Note filename / frontmatter title |
| Tag | `note` label, right-aligned |
| Excerpt | Matching content snippet (shown for full-text matches only, de-emphasized) |

### Command Results

Displayed when the query matches a command name or when the input is empty.

| Field | Description |
|---|---|
| Icon | Command icon (⌘) |
| Label | Command name |
| Shortcut | Keyboard shortcut if one exists, right-aligned |

---

## Result Ranking

When the input is **empty**, show:

1. Recently opened notes (up to 5)
2. Pinned notes
3. All available commands

When the user **types a query**:

1. Exact note title matches
2. Commands matching the query
3. Full-text content matches (with excerpt)

Notes with title matches are always ranked above content matches. Commands are interleaved based on string match relevance.

---

## Commands (v1)

| Command | Description | Shortcut |
|---|---|---|
| Create new note | Opens new untitled note in editor | `Cmd+N` |
| Duplicate note | Duplicates the currently active note | — |
| Pin note | Pins / unpins the currently active note | — |
| Delete note | Deletes the currently active note (with confirm) | — |
| Toggle raw markdown | Switches editor between rich and raw view | — |
| Toggle focus mode | Hides sidebar, centers editor | — |
| Open settings | Opens app settings | — |

The command list is static and defined in a central `commands.ts` registry. Each command has an `id`, `label`, `keywords` (for matching), optional `shortcut`, and an `action` callback.

---

## Full-Text Search

Full-text search is handled on the **Rust side** via Tauri commands. On app load (and on file changes), Glade indexes all note content into an in-memory store. The React frontend calls a Tauri command:

```ts
invoke('search_notes', { query: 'kubernetes' })
// returns: [{ title, path, excerpt, score }]
```

The Rust backend performs a simple case-insensitive substring search across all indexed note content and returns ranked results with a matched excerpt (±60 chars around the match).

For v1, simple substring matching is sufficient. Full fuzzy search (e.g. with a crate like `tantivy`) can be a v2 upgrade.

---

## Frontend Implementation

### State

```ts
const [open, setOpen] = useState(false)
const [query, setQuery] = useState('')
const [results, setResults] = useState<PaletteResult[]>([])
const [selectedIndex, setSelectedIndex] = useState(0)
```

### Component Structure

```
<CommandPalette>
  <Overlay />               // full-screen dimmed backdrop
  <PaletteModal>
    <SearchInput />         // controlled input, auto-focus
    <ResultsList>
      <ResultGroup label="Notes">
        <NoteResult />
      </ResultGroup>
      <ResultGroup label="Commands">
        <CommandResult />
      </ResultGroup>
    </ResultsList>
  </PaletteModal>
</CommandPalette>
```

### Keyboard Handling

Register a global `keydown` listener on mount:

```ts
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
      e.preventDefault()
      setOpen(true)
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

Arrow key navigation and `Enter` to execute are handled inside the palette component.

### Debouncing Search

Debounce the Tauri `search_notes` call by ~150ms to avoid hammering the backend on every keystroke.

---

## Rust Backend

### Indexed Note Structure

```rust
struct IndexedNote {
    title: String,
    path: String,
    content: String,
    tags: Vec<String>,
    modified: u64,
}
```

### Tauri Command

```rust
#[tauri::command]
fn search_notes(query: String, state: State<NotesIndex>) -> Vec<SearchResult> {
    state.search(&query)
}
```

The index is rebuilt on app startup and updated incrementally using a file watcher (e.g. `notify` crate) whenever notes are created, modified, or deleted.

---

## Accessibility

- `role="dialog"` and `aria-modal="true"` on the modal
- `role="listbox"` on the results list
- `aria-selected` on the highlighted result
- Focus returns to the previously focused element on close

---

## Out of Scope for v1

- Fuzzy / typo-tolerant search
- Search result highlighting (bolding matched characters)
- Command history / recently used commands
- Custom user-defined commands
