# Glade — Export Note Spec

## Overview

Notes in Glade are already stored as `.md` files, so markdown export is essentially a clean copy with optional frontmatter stripping. PDF export renders the note content to a styled PDF via the Tauri backend. Export is triggered from the context menu in the sidebar or from a command palette command.

---

## Trigger Points

- Right-click a note in the sidebar → context menu → **Export...**
- Command palette → **Export note**

Both open the same export dialog.

---

## Export Dialog

A small modal with two options:

```
┌──────────────────────────────┐
│  Export Note                 │
│                              │
│  ○ Markdown (.md)            │
│  ○ PDF                       │
│                              │
│  [ ] Strip frontmatter       │
│                              │
│  [Cancel]        [Export]    │
└──────────────────────────────┘
```

- Default selection: **Markdown**
- "Strip frontmatter" checkbox: removes the YAML block from the export output (off by default)
- On **Export**, opens the native OS file save dialog pre-filled with the note title as the filename

---

## Markdown Export

Since notes are already `.md` files, this is a direct copy with optional transformations.

**With frontmatter (default):** copy the file as-is to the chosen destination.

**With "Strip frontmatter" checked:** remove the YAML block before writing:

```
---
title: My Note
tags: [work, ideas]
created: 2026-01-10
---

# My Note

Content starts here...
```

Becomes:

```
# My Note

Content starts here...
```

### Tauri Command

```rust
#[tauri::command]
fn export_markdown(
    source_path: String,
    dest_path: String,
    strip_frontmatter: bool,
) -> Result<(), String>
```

---

## PDF Export

The note content is rendered to PDF via the Tauri backend using the `headless_chrome` crate or by generating a self-contained HTML string and passing it to a PDF renderer.

Recommended approach: **generate styled HTML from the markdown, load it in a hidden Tauri webview window, and use the browser's built-in print-to-PDF capability**. No extra binaries to ship, and the rendering engine (Chromium/WebKit depending on platform) is already bundled with Tauri.

### Rendering Pipeline

```
.md file
  → parse markdown to HTML (pulldown-cmark)
  → inject into styled HTML template
  → load in hidden Tauri WebviewWindow
  → trigger window.print() → PDF
  → save to destination
```

### PDF Styles

The HTML template controls exactly what the PDF looks like. Apply a minimal stylesheet:

- Font: system serif or a bundled font (e.g. Georgia or a bundled `.ttf`)
- Max content width: 680px, centered
- Heading hierarchy preserved with clear size scale
- Code blocks: monospace, light background, slight border radius
- Page breaks: avoid breaking inside code blocks and headings

Page layout is controlled via CSS `@page` rules, not platform defaults:

```css
@page {
  margin: 1in;
  size: A4;
}

@media print {
  pre, code { page-break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
}
```

### Tauri Implementation

Open a hidden webview window, load the HTML, and trigger print-to-PDF via JS injection:

```rust
let window = WebviewWindowBuilder::new(
    app,
    "pdf-export",
    WebviewUrl::Html(rendered_html)
)
.visible(false)
.build()?;

window.eval("window.print()")?;
```

The native print dialog is suppressed and output is directed to the destination path using Tauri's print API with the `destination` option set to the chosen file path.

### Tauri Command

```rust
#[tauri::command]
fn export_pdf(
    source_path: String,
    dest_path: String,
    strip_frontmatter: bool,
) -> Result<(), String>
```

---

## Rust Backend

### Dependencies

| Crate | Purpose |
|---|---|
| `pulldown-cmark` | Parse markdown to HTML |
| `gray_matter` | Parse and strip YAML frontmatter |

### File Save Dialog

Use Tauri's built-in dialog plugin:

```ts
import { save } from '@tauri-apps/plugin-dialog'

const dest = await save({
  defaultPath: `${noteTitle}.pdf`,
  filters: [{ name: 'PDF', extensions: ['pdf'] }]
})

if (dest) {
  await invoke('export_pdf', { sourcePath, destPath: dest, stripFrontmatter })
}
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| User cancels file dialog | Do nothing, close dialog |
| Source file not found | Show inline error in export dialog |
| PDF render fails | Show error toast with message |
| Destination not writable | Show error toast with message |

---

## Out of Scope for v1

- Batch export (multiple notes at once)
- Export to HTML
- Custom PDF themes or font selection
- Export entire folder / vault
