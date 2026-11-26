import { EditorView } from "@codemirror/view";
import { countColumn } from "@codemirror/state";
import { HighlightStyle, StreamLanguage, foldGutter, foldService, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

const DIAGRAM =
  /^(?:graph|flowchart|sequenceDiagram|classDiagram(?:-v2)?|stateDiagram(?:-v2)?|erDiagram|gantt|pie|journey|gitGraph|mindmap|timeline|quadrantChart|requirementDiagram|C4\w+|sankey-beta|xychart-beta|block-beta|packet-beta|architecture-beta|kanban)\b/;
const KEYWORD =
  /^(?:subgraph|end|participant|actor|loop|alt|else|opt|par|and|critical|break|rect|note|over|left of|right of|activate|deactivate|autonumber|class|classDef|style|linkStyle|click|direction|title|section|dateFormat|axisFormat|excludes|state|as|commit|branch|checkout|merge)\b/;
const DIRECTION = /^(?:TB|TD|BT|LR|RL)\b/;
const ARROW = /^(?:[<xo]?(?:-{2,}|={2,}|-\.+-|~{3})[>xo)]?>?|-+>>?|-[x)])/;

type State = { label: string | null };
const CLOSE: Record<string, string> = { "[": "]", "(": ")", "{": "}" };

/** A small tokenizer for Mermaid: enough to tell structure from labels. */
const mermaidLanguage = StreamLanguage.define<State>({
  name: "mermaid",
  startState: () => ({ label: null }),
  token(stream, state) {
    if (state.label) {
      if (stream.match(/^[\])}]+/)) {
        state.label = null;
        return "bracket";
      }
      if (stream.match(/^"[^"]*"?/)) return "string";
      stream.match(/^[^\])}"]+/) || stream.next();
      return "string";
    }
    if (stream.eatSpace()) return null;
    if (stream.match("%%")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match(/^"[^"]*"?/)) return "string";
    if (stream.match(/^\|[^|]*\|/)) return "string";
    if (stream.match(ARROW)) return "operator";
    const open = stream.match(/^[[({]+/) as RegExpMatchArray | null;
    if (open) {
      state.label = CLOSE[open[0][0]];
      return "bracket";
    }
    if (stream.match(/^[\])}]+/)) return "bracket";
    if (stream.match(/^:::\w+/)) return "atom";
    if (stream.sol() && stream.match(DIAGRAM)) return "keyword";
    if (stream.match(KEYWORD)) return "keyword";
    if (stream.match(DIRECTION)) return "atom";
    if (stream.match(/^\d+(?:\.\d+)?%?/)) return "number";
    if (stream.match(/^[A-Za-z_][\w-]*/)) return "variableName";
    if (stream.match(/^[:;,&]/)) return "punctuation";
    stream.next();
    return null;
  },
  languageData: { commentTokens: { line: "%%" } },
});

/**
 * The same mapping as the note's code blocks (editor.css, `.code-block .hljs-*`):
 * keywords and operators share the keyword colour, names are parameters,
 * built-ins are functions, and punctuation stays the plain code text colour.
 * The `--syntax-*` tokens are set per app theme, so this follows the theme.
 */
const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.operator], color: "hsl(var(--syntax-keyword))" },
  { tag: t.string, color: "hsl(var(--syntax-string))" },
  { tag: t.comment, color: "hsl(var(--syntax-comment))", fontStyle: "italic" },
  { tag: t.number, color: "hsl(var(--syntax-number))" },
  { tag: t.atom, color: "hsl(var(--syntax-function))" },
  { tag: t.variableName, color: "hsl(var(--syntax-parameter))" },
]);

const theme = EditorView.theme({
  "&": {
    height: "100%",
    backgroundColor: "transparent",
    color: "hsl(var(--editor-text))",
    fontSize: "13px",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.9",
    overscrollBehavior: "contain",
  },
  ".cm-content": { padding: "8px 0 24px", caretColor: "hsl(var(--foreground))" },
  ".cm-line": { padding: "0 14px 0 6px" },
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    color: "hsl(var(--muted-foreground) / 0.55)",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    minWidth: "28px",
    padding: "0 2px 0 12px",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-foldGutter .cm-gutterElement": { display: "flex", alignItems: "center", justifyContent: "center", width: "16px" },
  ".cm-fold-marker": {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "16px",
    height: "16px",
    borderRadius: "4px",
    cursor: "pointer",
    color: "hsl(var(--muted-foreground))",
    opacity: "0",
    transition: "opacity 100ms var(--ease-ui), background-color 100ms var(--ease-ui), color 100ms var(--ease-ui)",
  },
  ".cm-fold-marker svg": { width: "12px", height: "12px", transition: "transform 150ms var(--ease-ui)" },
  ".cm-fold-marker[data-folded] svg": { transform: "rotate(-90deg)" },
  // Open markers show while the pointer is over the gutter; folded ones always show.
  ".cm-gutters:hover .cm-fold-marker, .cm-fold-marker[data-folded]": { opacity: "1" },
  "@media (hover: hover) and (pointer: fine)": {
    ".cm-fold-marker:hover": { backgroundColor: "hsl(var(--foreground) / 0.08)", color: "hsl(var(--foreground))" },
  },
  ".cm-foldPlaceholder": {
    margin: "0 4px",
    padding: "0 6px",
    border: "none",
    borderRadius: "4px",
    backgroundColor: "hsl(var(--foreground) / 0.07)",
    color: "hsl(var(--muted-foreground))",
    fontSize: "11px",
    verticalAlign: "1px",
    cursor: "pointer",
  },
  ".cm-activeLineGutter": { backgroundColor: "transparent", color: "hsl(var(--foreground) / 0.8)" },
  ".cm-activeLine": { backgroundColor: "hsl(var(--foreground) / 0.04)" },
  ".cm-cursor, .cm-dropCursor": { borderLeft: "1.5px solid hsl(var(--foreground))" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection":
    { backgroundColor: "hsl(var(--primary) / 0.22) !important" },
  ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
    backgroundColor: "hsl(var(--foreground) / 0.1)",
    outline: "none",
    color: "inherit",
  },
  ".cm-selectionMatch": { backgroundColor: "hsl(var(--foreground) / 0.08)" },
  ".cm-placeholder": { color: "hsl(var(--muted-foreground) / 0.6)" },
});

/** Leading-whitespace width of a line in columns, or null when it is blank. */
function indentOf(text: string, tabSize: number): number | null {
  const lead = /^[ \t]*/.exec(text)![0];
  return lead.length === text.length ? null : countColumn(lead, tabSize);
}

/**
 * A line folds when the lines under it are indented deeper: the block runs to
 * the last deeper line, so trailing blank lines stay visible.
 */
const indentFold = foldService.of((state, lineStart) => {
  const doc = state.doc;
  const line = doc.lineAt(lineStart);
  const own = indentOf(line.text, state.tabSize);
  if (own === null) return null;
  let end = line.number;
  for (let i = line.number + 1; i <= doc.lines; i++) {
    const n = indentOf(doc.line(i).text, state.tabSize);
    if (n === null) continue;
    if (n <= own) break;
    end = i;
  }
  return end > line.number ? { from: line.to, to: doc.line(end).to } : null;
});

const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

const foldMarkers = foldGutter({
  markerDOM(open) {
    const el = document.createElement("span");
    el.className = "cm-fold-marker";
    if (!open) el.dataset.folded = "";
    el.title = open ? "Fold" : "Unfold";
    el.innerHTML = CHEVRON;
    return el;
  },
});

export const mermaidEditorExtensions = [mermaidLanguage, indentFold, foldMarkers, syntaxHighlighting(highlight), theme, EditorView.lineWrapping];

/**
 * The block's own code view, in the note: the same highlighting, sized like a
 * code block's text, with room at the top for the block's buttons.
 */
const inlineTheme = EditorView.theme({
  "&.cm-editor .cm-scroller": { lineHeight: "1.6" },
  "&.cm-editor .cm-content": { padding: "2.5rem 0 1rem" },
  "&.cm-editor .cm-line": { padding: "0 1rem" },
});

export const mermaidInlineExtensions = [mermaidLanguage, syntaxHighlighting(highlight), theme, inlineTheme, EditorView.lineWrapping];
