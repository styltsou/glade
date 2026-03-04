# Glade — Product Requirements Document

**Version:** 1.0  
**Status:** Draft  
**Stack:** Tauri 2 · React · Vite · TypeScript · shadcn/ui · TipTap  

---

## 1. Overview

### 1.1 What is Glade?

Glade is a local-first, Git-synced markdown note-taking desktop application. It is built for developers and technical users who want to own their notes as plain files, version-control them automatically, and edit them in a distraction-free rich text environment — without giving up the power of raw markdown.

Glade lives on your machine. Notes are stored as `.md` files in a fixed local vault (`~/.glade`). Every change is auto-saved and periodically pushed to a private GitHub repository, giving you a full version history and an off-device backup with zero manual effort.

### 1.2 Design Philosophy

- **Local-first.** Your notes are plain `.md` files. No proprietary format, no lock-in.
- **Git as infrastructure.** Version control and sync happen transparently in the background.
- **Minimal friction.** The editor stays out of your way. Writing should feel fast and calm.
- **Markdown-native.** You can write raw markdown or use the toolbar — both produce the same output.

### 1.3 Target User

Developers, technical writers, and power users who:
- Are comfortable with markdown and Git
- Want full ownership of their notes
- Prefer a desktop app over a web-based tool
- Value version history and sync without a proprietary cloud

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Tauri 2 (Rust backend) |
| Frontend framework | React 18 + Vite + TypeScript |
| UI components | shadcn/ui + Tailwind CSS |
| Rich text editor | TipTap 2 |
| Git operations | Shell out to system `git` binary (v1) |
| Auth | GitHub OAuth Device Flow |
| Note storage | Local filesystem — `~/.glade/` |
| Note format | Markdown (`.md`) with YAML frontmatter |

---

## 3. Vault & File Structure

### 3.1 Vault Location

The notes vault is fixed at `~/.glade/` on the user's machine. This directory is also the root of the Git repository used for sync.

```
~/.glade/
├── .git/                    # managed by Glade, do not touch
├── work/
│   ├── meetings.md
│   └── project-alpha.md
├── personal/
│   └── reading-list.md
└── quick-notes.md
```

### 3.2 Note Format

Every note is a single `.md` file with a YAML frontmatter block at the top:

```markdown
---
title: "My Note Title"
tags: [work, planning]
created: 2024-03-01T10:00:00Z
updated: 2024-03-15T14:32:00Z
---

Note content begins here...
```

**Frontmatter fields:**

| Field | Type | Description |
|---|---|---|
| `title` | string | Display name of the note |
| `tags` | string[] | List of tags for filtering |
| `created` | ISO 8601 | Creation timestamp (set once) |
| `updated` | ISO 8601 | Updated on every save |

---

## 4. Features — V1 Scope

### 4.1 Editor

**4.1.1 Rich Text Editing**

- Powered by TipTap 2 with a ProseMirror backend.
- Users can type markdown syntax directly and it will render inline in real time (e.g. typing `**bold**` produces bold text, not raw characters).
- Supported markdown input shortcuts:
  - `**text**` or `__text__` → bold
  - `*text*` or `_text_` → italic
  - `# ` → Heading 1, `## ` → Heading 2, `### ` → Heading 3
  - `` ` `` → inline code, ` ``` ` → code block
  - `- ` or `* ` → unordered list
  - `1. ` → ordered list
  - `> ` → blockquote
  - `---` → horizontal rule
  - `[text](url)` → link

**4.1.2 Formatting Toolbar**

A minimal toolbar appears above the editor with buttons for:
- Bold, Italic, Strikethrough
- Heading 1, Heading 2, Heading 3
- Unordered list, Ordered list
- Inline code, Code block
- Blockquote
- Link (opens a small popover to enter URL)

The toolbar reflects the current cursor position (active state for the relevant button).

**4.1.3 Raw Markdown Toggle**

- A toggle button (e.g. `</>` icon) in the editor header switches between:
  - **Rich view** (default): rendered TipTap editor
  - **Raw view**: plain text editor showing the raw markdown source (using a monospace font, CodeMirror or a `<textarea>`)
- Switching between modes preserves content with no data loss.
- The toggle state is per-note and remembered for the session.

**4.1.4 Autosave**

- Notes are saved to disk automatically using debouncing: 1.5 seconds after the user stops typing.
- A subtle save indicator in the editor header shows: `Saving...` → `Saved` → (idle).
- No manual save required.

---

### 4.2 Notes & Organization

**4.2.1 Sidebar**

The left sidebar contains the full file tree of `~/.glade/`. It shows:
- Nested folders and notes in a collapsible tree
- Note title (from frontmatter, falling back to filename)
- Active note highlighted

The sidebar has two sections, stacked vertically:
1. **File tree** — folder/note hierarchy
2. **Tags panel** — list of all unique tags with note counts

**4.2.2 File Tree Actions**

Right-clicking a note or folder opens a context menu with:
- **Note:** Rename, Move to folder, Delete
- **Folder:** Rename, New note inside, New subfolder, Delete

A `+ New Note` button at the top of the sidebar creates a new note in the currently selected folder (or root if none selected).

**4.2.3 New Note Flow**

1. User clicks `+ New Note` or uses keyboard shortcut `Cmd/Ctrl + N`
2. A new `.md` file is created with a default title `Untitled`
3. The note opens immediately in the editor with the title field focused
4. The user types the title and presses `Enter` or `Tab` to move to the note body
5. The filename is derived from the title (slugified, e.g. `my-note-title.md`) on first save

**4.2.4 Folder Management**

- Users can create, rename, and delete folders from the sidebar
- Folders can be nested to any depth
- Deleting a non-empty folder asks for confirmation

---

### 4.3 Tagging

- Tags are stored in the YAML frontmatter of each note.
- In the editor, a **tag input** component below the title allows adding/removing tags inline (pill-style, with autocomplete from existing tags).
- The sidebar Tags panel lists all tags across all notes, sorted alphabetically, with a count badge.
- Clicking a tag in the panel filters the file tree to show only notes with that tag.
- Multiple tags can be active at once (AND filter).

---

### 4.4 Command Palette

- Triggered by `Cmd/Ctrl + P`, rendered using the shadcn `Command` component (built on `cmdk`).
- Appears as a centered modal overlay with a search input and a list of actions.
- Available commands include:
  - New note
  - New folder
  - Search notes (delegates to full-text search)
  - Rename current note
  - Delete current note
  - Toggle raw markdown view
  - Trigger Git sync now
  - Navigate to a specific note (fuzzy search by title)
- Commands are fuzzy-searchable by name.
- The palette is the primary keyboard-driven navigation surface for power users.

---

### 4.5 Search

**4.4.1 Full-Text Search**

- A search bar at the top of the sidebar (or accessible via `Cmd/Ctrl + K`) triggers full-text search across all notes.
- Search is performed on the Rust side by reading and indexing all `.md` files in `~/.glade/`.
- Results show:
  - Note title
  - Folder path
  - A short content snippet with the matched term highlighted
- Clicking a result opens the note and scrolls to the first match.

**4.4.2 Tag Filtering**

- Tag filtering (from the Tags panel) can be combined with full-text search.
- Active filters are shown as removable chips above the results.

---

### 4.6 Git Sync

**4.5.1 Initial Setup**

On first launch (or if no Git remote is configured), Glade shows an onboarding screen:
1. "Connect your GitHub account" — triggers the OAuth Device Flow
2. User authorizes Glade in the browser
3. Glade receives a token and stores it securely (using Tauri's secure storage)
4. User selects or creates a private GitHub repository for sync
5. Glade initializes `~/.glade/` as a Git repo and sets the remote

**4.5.2 GitHub OAuth — Device Flow**

- Glade uses the [GitHub OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) — no redirect URI needed, perfect for desktop apps.
- Flow:
  1. Glade requests a `device_code` and `user_code` from GitHub
  2. Shows the user the code and a button to open `github.com/login/device`
  3. User enters the code and authorizes
  4. Glade polls for the token and stores it on success
- Required OAuth scope: `repo` (to create and push to private repos)

**4.5.3 Auto-Commit & Push**

- Every 5 minutes, Glade runs a background Git sync cycle:
  1. `git add -A`
  2. `git commit -m "glade: autosave [timestamp]"` (only if there are changes)
  3. `git push origin main`
- An additional sync is triggered when the app is closed/quit.
- If the push fails (e.g. network error), Glade retries silently on the next cycle.

**4.5.4 Sync Status Indicator**

A small status indicator in the bottom-left of the window shows:
- 🟢 `Synced` — last push was successful
- 🔄 `Syncing...` — push in progress
- 🔴 `Sync failed` — last push failed (clicking shows error detail)
- ⚫ `Not connected` — no GitHub remote configured

---

## 5. Design System

### 5.1 Philosophy

Glade's visual style is flat, minimal, and calm. The chrome (sidebar, toolbar, status bar) should recede into the background so the note content is the only thing with visual weight. The aesthetic reference is tools like Linear and Raycast — high contrast where it matters, invisible structure everywhere else.

### 5.2 shadcn/ui Theme Overrides

All visual customizations are applied via CSS custom properties in the shadcn theme (`globals.css`). This keeps every override in one place and makes it trivial to revert or adjust in the future without touching component code.

**The following CSS variables must be set explicitly:**

```css
:root {
  /* Borders — thin and subtle, not invisible */
  --radius: 0.25rem;          /* sharp but not harsh corners */
  --border: 220 13% 88%;      /* light mode: soft gray border */

  /* Shadows — fully disabled */
  --shadow-sm: none;
  --shadow: none;
  --shadow-md: none;
  --shadow-lg: none;
  --shadow-xl: none;
  --shadow-2xl: none;
}

.dark {
  --border: 215 14% 22%;      /* dark mode: darker border */
}
```

**Additional global rules applied on top of the theme:**

```css
/* Strip all box shadows app-wide */
* {
  box-shadow: none !important;
}

/* Use borders for structural separation, not shadows */
.sidebar {
  border-right: 1px solid hsl(var(--border));
}

.toolbar {
  border-bottom: 1px solid hsl(var(--border));
}

.statusbar {
  border-top: 1px solid hsl(var(--border));
}
```

### 5.3 Typography

- **UI font:** System font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`)
- **Editor font:** `"Georgia", serif` for rich view (readable, calm); switchable to system sans if preferred
- **Raw view font:** Monospace (`"JetBrains Mono", "Fira Code", monospace`)
- **Editor line height:** `1.75` — generous for readability
- **Editor max content width:** `680px` centered — keeps line length comfortable

### 5.4 Color

- Stick to Tailwind's `zinc` scale for all UI chrome (sidebar, toolbar, borders, muted text)
- Accent color: a single muted tone used sparingly for active states and the sync status indicator
- No decorative color — color only carries meaning (active, error, success)

### 5.5 Component Overrides

Any shadcn component that ships with `shadow-sm` or `shadow` by default (e.g. `Card`, `Popover`, `DropdownMenu`, `Dialog`) should have those removed at the component level or suppressed via the global CSS rule above. Borders alone are used for visual separation.

---

## 6. Application Layout

```
┌─────────────────────────────────────────────────────────┐
│  Glade                                        [window controls] │
├──────────────┬──────────────────────────────────────────┤
│              │  [Note Title]                  [raw <>]  │
│  [Search]    │  [tag1] [tag2] [+ add tag]               │
│              ├──────────────────────────────────────────┤
│  ▼ work/     │  [B] [I] [H1] [H2] [H3] [ul] [ol] [<>]  │
│    meeting   ├──────────────────────────────────────────┤
│    project   │                                          │
│  ▶ personal/ │   Editor content area                    │
│  quick-notes │                                          │
│              │                                          │
│  ─────────── │                                          │
│  TAGS        │                                          │
│  work (12)   │                                          │
│  planning (4)│                                          │
│              │                                          │
├──────────────┴──────────────────────────────────────────┤
│  🟢 Synced · Last synced 2 min ago                      │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|---|---|---|
| New note | `Cmd + N` | `Ctrl + N` |
| Command palette | `Cmd + P` | `Ctrl + P` |
| Search | `Cmd + K` | `Ctrl + K` |
| Save (manual) | `Cmd + S` | `Ctrl + S` |
| Toggle raw view | `Cmd + Shift + M` | `Ctrl + Shift + M` |
| Bold | `Cmd + B` | `Ctrl + B` |
| Italic | `Cmd + I` | `Ctrl + I` |
| Focus sidebar | `Cmd + Shift + E` | `Ctrl + Shift + E` |

---

## 8. Data & Privacy

- All notes are stored locally at `~/.glade/` as plain `.md` files.
- The GitHub token is stored in the OS secure keychain via Tauri's secure storage API.
- No telemetry, no analytics, no third-party data collection in v1.
- The only external network calls are to the GitHub API for OAuth and Git push/pull.

---

## 9. Error Handling

| Scenario | Behavior |
|---|---|
| Git push fails | Silent retry next cycle; status indicator turns red |
| File write fails | Toast notification: "Failed to save note" |
| GitHub auth expires | Status indicator prompts re-authentication |
| Vault directory missing | Recreate `~/.glade/` on launch |
| Corrupt frontmatter | Treat file as having no frontmatter; log warning |

---

## 10. Out of Scope — V1

The following are explicitly excluded from v1 and deferred to future versions:

- **Conflict resolution UI** — if a Git conflict occurs, log it and surface a message; no merge UI
- **GitLab / Bitbucket support** — GitHub only in v1
- **AI-assisted writing** — deferred to v2
- **Themes / appearance customization** — system light/dark only in v1
- **Mobile sync / companion app**
- **Note encryption**
- **Export** (PDF, HTML, etc.)
- **Image embeds in notes**
- **Collaborative editing**
- **Custom vault location** — fixed at `~/.glade/` in v1

---

## 11. Open Questions (Post-V1)

- Should sync also support `git pull` to allow editing from multiple machines?
- Should tags support hierarchy (e.g. `work/planning`)?
- Should there be a "Quick capture" global hotkey that works even when the app is in background?
- How should conflicts be presented and resolved in v2?
