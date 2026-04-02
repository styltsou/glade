## Why

Notes users want to include visual diagrams directly in their notes without switching tools or exporting/importing images. Mermaid provides a text-to-diagram solution that fits naturally with markdown-based notes. The Tiptap editor already supports code blocks—this change adds live rendering for mermaid blocks.

## What Changes

- **New Tiptap Node Extension**: `MermaidBlock` extending `CodeBlock` to handle ` ```mermaid ` fenced code blocks with live SVG rendering via `mermaid.js`
- **New NodeView Component**: `MermaidNodeView` React component with per-block source toggle (preview ↔ source edit modes)
- **Per-block Source Toggle**: Users can edit raw Mermaid syntax inline without enabling global raw mode
- **Blur-to-Render**: Diagrams re-render when user leaves source mode; errors shown inline if syntax invalid
- **Global Raw Mode Integration**: Mermaid blocks fall back to raw fenced code when global raw toggle is active
- **New Dependency**: `mermaid` npm package for diagram rendering

## Capabilities

### New Capabilities

- `mermaid-diagram-rendering`: Render Mermaid fenced code blocks as interactive SVG diagrams in rich text mode, with per-block source editing and error handling

### Modified Capabilities

- None. This is a net-new capability; existing editor behavior is preserved.

## Impact

- **Code**: New files in editor extensions directory (`MermaidBlock.ts`, `MermaidNodeView.tsx`)
- **Dependencies**: Add `mermaid` package to package.json
- **Storage**: No changes—Mermaid blocks serialize as standard fenced code blocks, compatible with existing markdown storage
