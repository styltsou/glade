import { useMemo, useEffect, useRef } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { useTheme } from "next-themes";
import { findMatchesRaw, SearchOptions } from "./SearchHighlight";

interface RawEditorProps {
  content: string;
  onChange: (value: string) => void;
  findQuery?: string;
  currentMatchIndex?: number;
  searchOpts?: SearchOptions;
  readOnly?: boolean;
}

export const setRawSearchState = StateEffect.define<{query: string, activeIndex: number, opts: SearchOptions}>();

interface SearchState {
  query: string;
  activeIndex: number;
  opts: SearchOptions;
  decos: DecorationSet;
}

const rawSearchHighlightField = StateField.define<SearchState>({
  create() { return { query: "", activeIndex: 0, opts: {}, decos: Decoration.none } },
  update(value, tr) {
    let { query, activeIndex, opts, decos } = value;
    let changed = false;
    
    for (const e of tr.effects) {
      if (e.is(setRawSearchState)) {
        query = e.value.query;
        activeIndex = e.value.activeIndex;
        opts = e.value.opts;
        changed = true;
      }
    }
    
    if (tr.docChanged) changed = true;
    
    if (changed) {
      if (!query) return { query, activeIndex, opts, decos: Decoration.none };
      
      const text = tr.state.doc.toString();
      const matches = findMatchesRaw(text, query, opts);
      const builder = new RangeSetBuilder<Decoration>();
      matches.forEach((m, i) => {
        builder.add(m.from, m.to, Decoration.mark({
          class: i === activeIndex ? "search-highlight-active" : "search-highlight"
        }));
      });
      return { query, activeIndex, opts, decos: builder.finish() };
    }
    
    if (tr.docChanged) return { query, activeIndex, opts, decos: decos.map(tr.changes) };
    return value;
  },
  provide: f => EditorView.decorations.from(f, state => state.decos)
});

// Define custom highlighting style based on app CSS variables
const customHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "var(--syntax-keyword)" },
  { tag: tags.string, color: "var(--syntax-string)" },
  { tag: tags.comment, color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: tags.number, color: "var(--syntax-number)" },
  { tag: tags.function(tags.variableName), color: "var(--syntax-function)" },
  { tag: tags.variableName, color: "var(--syntax-parameter)" },
  { tag: tags.propertyName, color: "var(--syntax-keyword)" },
  { tag: tags.labelName, color: "var(--syntax-keyword)" },
  { tag: tags.heading, fontWeight: "bold", color: "var(--foreground)" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.link, color: "var(--primary)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--primary)", opacity: 0.7 },
  { tag: tags.list, color: "var(--muted-foreground)" },
  { tag: tags.quote, color: "var(--muted-foreground)" },
  { tag: tags.processingInstruction, color: "var(--syntax-comment)" }, // Frontmatter
]);

// Base theme to handle editor appearance
const baseTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent !important",
    width: "100% !important",
  },
  ".cm-content": {
    padding: "0 !important",
    whiteSpace: "pre-wrap !important",
    wordBreak: "break-word !important",
  },
  ".cm-line": {
    padding: "0 !important",
    color: "var(--foreground)",
  },
  ".cm-scroller": {
    overflow: "visible !important",
    fontFamily: "var(--font-mono)",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--foreground)",
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
    marginLeft: "-1px",
  },
  ".cm-dropCursor": {
    borderLeftColor: "var(--foreground)",
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--primary) !important",
    opacity: "0.3",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export function RawEditor({ content, onChange, findQuery = "", currentMatchIndex = 0, searchOpts = {}, readOnly = false }: RawEditorProps) {
  const { resolvedTheme } = useTheme();
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  const extensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
    syntaxHighlighting(customHighlightStyle),
    baseTheme,
    rawSearchHighlightField,
    EditorView.editable.of(!readOnly),
  ], [readOnly]);

  useEffect(() => {
    if (cmRef.current?.view) {
      const view = cmRef.current.view;
      view.dispatch({
        effects: setRawSearchState.of({ query: findQuery, activeIndex: currentMatchIndex, opts: searchOpts })
      });
      
      if (findQuery) {
        const matches = findMatchesRaw(view.state.doc.toString(), findQuery, searchOpts);
        if (matches[currentMatchIndex]) {
           const { from, to } = matches[currentMatchIndex];
           view.dispatch({
             selection: { anchor: from, head: to },
             effects: EditorView.scrollIntoView(from, { y: "center" })
           });
        }
      }
    }
  }, [findQuery, currentMatchIndex, searchOpts]);

  return (
    <div className="codemirror-container relative">
      <CodeMirror
        ref={cmRef}
        value={content}
        height="100%"
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        extensions={extensions}
        onChange={readOnly ? undefined : (value) => onChange(value)}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: false,
          highlightSelectionMatches: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          defaultKeymap: true,
          historyKeymap: true,
          drawSelection: true,
          dropCursor: true,
        }}
        className="text-[14px] leading-[1.7] min-h-[300px] [&_.cm-editor]:outline-none [&_.cm-editor.cm-focused]:outline-none"
      />
    </div>
  );
}
