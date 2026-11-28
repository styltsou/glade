# Testing Notion-style Editor

This document contains a comprehensive mix of Markdown syntax to test block parsers, inline formatters, and structural rendering in your editor app.

---

## 1. Typography &amp; Inline Styles

This paragraph tests standard text rendering. It includes **bold text** for heavy emphasis, *italic text* for light emphasis, and ~~strikethrough text~~ to show deleted states. 

For technical text, we have `inline code snippets` and keyboard shortcuts like Ctrl + P.

You can also test mixed styles like ***bold and italic***, or add a [hyperlink to GitHub](https://github.com) to verify anchor tags.

Youc can also mention random stuff like [Tablericons - Free SVG Icons](link:113931b0-c145-4cc6-973b-b0d2436a4e72) and [macOS 27 Golden Gate - 50+ New Features & Changes!](link:717039a4-dac1-411a-9625-9435c0022994) 

also here is a video mention [grafeiaki.mp4](video:1c6a82c5-20aa-406e-aba4-6ac7708a8131) 

---

## 2. Block Variations

### Lists &amp; Tasks

#### Todo List (Checkbox Blocks)

- [x] Implement Markdown parser
- [x] Connect drag-and-drop handles
- [x] Add the slash `/` command menu
- [x] Fix inline style overlapping bugs

#### Ordered List

1. First major structural block
2. Second sequential step
  1. Indented nested step A
  2. Indented nested step B
3. Final root-level item

#### Unordered List

- Premium features

- Core infrastructure

  - Database adapters
    - 

  ## Rendering engines

## Analytics pipelines

### Blockquotes &amp; Callouts

> "Simplicity is the ultimate sophistication."  
> — *Leonardo da Vinci*

> \[!NOTE\]  
> **Callout Box Simulation**  
> This structure simulates an alert or information callout box common in modern editors. Ensure the icon and background container render correctly.

---

## 3. Data Tables


| Feature | Supported | Status | Performance |
| --- | --- | --- | --- |
| **Slash Menu** | Yes | `Beta` | 12ms |
| **Block Dragging** | Yes | `Stable` | 60 FPS |


## 4. Code Blocks &amp; Syntax Highlighting

```javascript
// Test syntax highlighting and block actions (like one-click copy)
const editorConfig = {
  theme: 'dark',
  features: {
    slashCommands: true,
    dragAndDrop: true,
    realtimeCollaboration: false
  },
  initializeBlock(type = 'paragraph') {
    return {
      id: crypto.randomUUID(),
      type,
      content: ''
    };
  }
};

console.log('Editor initialized with config:', editorConfig);
```

---

## 5. Media &amp; Embed Placeholders

Here is an image placeholder block to test layout alignment and responsive scaling:

!\[Editor UI Mockup\]([https://unsplash.com](https://unsplash.com) "Abstract Mockup Workspace")

---

## 6. HTML Fallbacks &amp; Edge Cases

- Paragraphs containing standard HTML tags like underlined text or ==highlighted background text==.
- Empty lines below to test layout padding and vertical spacing.
- 
- An empty bullet point above.



and here is a mention of a color like [Festival](color:aa0f401a-35b0-489a-8931-456439c719be) here and a gradient like [Lilac Mist](color:9f2f01c9-0b9b-4216-821f-8c0abe6110bf) and another gradient like [Linear Gradient](color:c04f12a0-ea90-4564-b869-2181268a8024) 

Now lets mention something new to test the new caching mechanism, like [Sunlit home office setup with computer, keyboard, and microphone, embodying minimalism and modern design.](image:b9e63f3d-34f4-4c2b-9aaf-6ae560c59b0a) and another one like [White](color:a3e4626a-724f-4d3f-bb1e-7b8d02925b41) 

