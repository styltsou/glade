## Context

The app uses Tiptap (ProseMirror-based) as its rich text editor with React components. Notes are stored as CommonMark markdown. A global raw markdown toggle exists to switch between rendered rich text and raw source. The goal is to add live Mermaid diagram rendering without changing the storage format or affecting existing functionality.

## Goals / Non-Goals

**Goals:**
- Render ` ```mermaid ` code blocks as interactive SVG diagrams in rich text mode
- Provide per-block source toggle (edit Mermaid syntax without enabling global raw mode)
- Re-render diagrams on blur from source editor
- Show inline error feedback for invalid Mermaid syntax
- Ensure global raw mode takes precedence over per-block rendering

**Non-Goals:**
- Live re-rendering while typing (render on blur only)
- Export diagrams as image files
- Syntax highlighting in source editor
- Changes to document serialization/storage format

## Decisions

### 1. Tiptap Extension Structure
**Decision:** Extend `CodeBlock` rather than creating a standalone node.

**Rationale:** `CodeBlock` already handles fenced code block parsing/serialization, keyboard shortcuts, and indentation. Extending it adds mermaid-specific behavior while inheriting standard code block features. The `language` attribute can be used to distinguish mermaid blocks.

### 2. NodeView Architecture
**Decision:** Use a single `MermaidNodeView` component that manages both preview and source modes via local state.

**Rationale:** Simpler than creating separate components. The component lifecycle handles mode transitions naturally. State resets on remount (e.g., navigating away and back), which is acceptable per requirements.

### 3. Unique ID Generation
**Decision:** Use `crypto.randomUUID()` stored in a `useRef` per component instance.

**Rationale:** `useId()` (React 18) is designed for SSR consistency, not stable IDs across renders of the same component. A ref provides a stable identifier for the mermaid renderer's entire lifecycle. Node position is unsuitable because positions shift during document edits.

### 4. Render-on-Blur Implementation
**Decision:** Attempt `mermaid.render()` on blur; on success write to document and switch to preview; on failure show error and stay in source mode.

**Rationale:** This preserves document integrity—invalid syntax never reaches the stored document. The user stays in edit mode to fix errors, which provides immediate feedback without losing work.

### 5. Global Raw Mode Integration
**Decision:** Check a Tiptap extension storage flag `isRawMode` in the NodeView; when true, return `null` from the NodeView to let Tiptap render the raw code block.

**Rationale:** Tiptap's extension storage provides a clean mechanism for cross-component communication without React context. Returning `null` delegates rendering to the editor's default code block handling.

### 6. Mermaid Theme
**Decision:** Use `theme: 'neutral'` with the option to re-initialize on theme change.

**Rationale:** `neutral` works reasonably well in both light and dark modes. Supporting dynamic theme switching is listed as an open question—the implementation can defer this until needed.

## Risks / Trade-offs

- **[Risk]** Mermaid render is async and requires mounted DOM  
  → **Mitigation:** Use a ref to confirm container is mounted before calling `mermaid.render()`, handle the promise result in useEffect cleanup

- **[Risk]** Large diagrams may block the main thread  
  → **Mitigation:** Show loading spinner while render is in flight; consider moving to web worker for very large diagrams if needed

- **[Risk]** Two mermaid blocks with same ID if component remounts mid-render  
  → **Mitigation:** Generate unique ID once per component instance via useRef, don't regenerate on state changes

- **[Risk]** Mermaid securityLevel='loose' enables click events but introduces XSS surface  
  → **Mitigation:** Only use 'loose' if clickable diagrams are required; otherwise use 'strict' or 'sandbox'
