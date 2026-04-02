## 1. Setup

- [ ] 1.1 Install mermaid package: `npm install mermaid`
- [ ] 1.2 Create editor extensions directory structure

## 2. MermaidBlock Extension

- [ ] 2.1 Create `MermaidBlock` Tiptap extension extending CodeBlock
- [ ] 2.2 Define `parseHTML` rule for `<pre><code class="language-mermaid">`
- [ ] 2.3 Define `renderHTML` to serialize back to standard fenced code block
- [ ] 2.4 Register input rule for ` ```mermaid ` + Enter
- [ ] 2.5 Register `ReactNodeViewRenderer(MermaidNodeView)` as the node view

## 3. MermaidNodeView Component

- [ ] 3.1 Scaffold `MermaidNodeView` React component with NodeViewWrapper
- [ ] 3.2 Implement local state: mode, source, svgOutput, renderError, isHovered
- [ ] 3.3 Implement stable unique ID generation using useRef with crypto.randomUUID()
- [ ] 3.4 Implement sync from node.textContent to local source state in preview mode

## 4. Rendering Logic

- [ ] 4.1 Implement `renderMermaid()` async function with try/catch
- [ ] 4.2 Wire useEffect to call renderMermaid when source or mode changes
- [ ] 4.3 Implement loading state with spinner while render is in flight
- [ ] 4.4 Handle empty block with placeholder text

## 5. Source Editing & Document Write-Back

- [ ] 5.1 Implement onBlur handler on textarea
- [ ] 5.2 On valid syntax: write back to document via transaction, switch to preview
- [ ] 5.3 On invalid syntax: show error, stay in source mode, don't update document
- [ ] 5.4 Implement "Edit source" button visible on hover

## 6. Visual States

- [ ] 6.1 Preview mode: SVG container with responsive styling
- [ ] 6.2 Source mode: textarea with monospace font, label, minimum height
- [ ] 6.3 Error state: error banner below textarea with red/warning styling
- [ ] 6.4 Hover overlay with edit button in top-right corner

## 7. Global Raw Mode Integration

- [ ] 7.1 Add isRawMode storage flag to Tiptap extension
- [ ] 7.2 Check isRawMode in NodeView; return null when true to delegate to default code block

## 8. Mermaid Initialization

- [ ] 8.1 Initialize mermaid at app startup with startOnLoad: false
- [ ] 8.2 Configure theme: 'neutral', securityLevel appropriate for needs

## 9. Testing

- [ ] 9.1 Test: Diagram renders correctly on initial load
- [ ] 9.2 Test: Edit source → blur → valid syntax → diagram updates
- [ ] 9.3 Test: Edit source → blur → invalid syntax → error shown, stays in source mode
- [ ] 9.4 Test: Undo after editing source reverts diagram correctly
- [ ] 9.5 Test: Two mermaid blocks on same page render independently
- [ ] 9.6 Test: Global raw toggle hides diagram NodeView
- [ ] 9.7 Test: Empty block shows placeholder, no errors thrown
