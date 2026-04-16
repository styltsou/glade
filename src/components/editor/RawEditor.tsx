import { useMemo, useEffect, useRef } from "react";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, Decoration, DecorationSet } from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { findMatchesRaw, SearchOptions } from "./SearchHighlight";

interface RawEditorProps {
  content: string;
  onChange: (value: string) => void;
  findQuery?: string;
  currentMatchIndex?: number;
  searchOpts?: SearchOptions;
  readOnly?: boolean;
}

const rawHighlightStyle = HighlightStyle.define([
  { tag: t.heading1, fontSize: "30px", fontWeight: "700", fontFamily: '"Inter", -apple-system, sans-serif', letterSpacing: "-0.02em", lineHeight: "1.2", color: "hsl(var(--primary))" },
  { tag: t.heading2, fontSize: "23px", fontWeight: "600", fontFamily: '"Inter", -apple-system, sans-serif', letterSpacing: "-0.01em", lineHeight: "1.3", color: "hsl(var(--primary))" },
  { tag: t.heading3, fontSize: "19px", fontWeight: "600", fontFamily: '"Inter", -apple-system, sans-serif', letterSpacing: "-0.01em", lineHeight: "1.4", color: "hsl(var(--primary))" },
  { tag: t.heading4, fontSize: "17px", fontWeight: "600", fontFamily: '"Inter", -apple-system, sans-serif', lineHeight: "1.4", color: "hsl(var(--primary))" },
  { tag: t.heading5, fontWeight: "600", fontFamily: '"Inter", -apple-system, sans-serif', color: "hsl(var(--primary))" },
  { tag: t.heading6, fontWeight: "600", fontFamily: '"Inter", -apple-system, sans-serif', color: "hsl(var(--primary))" },
  { tag: t.heading, fontWeight: "600", color: "hsl(var(--primary))" },
  { tag: t.emphasis, fontStyle: "italic", color: "hsl(var(--foreground))" },
  { tag: t.strong, fontWeight: "700", color: "hsl(var(--foreground))" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "hsl(var(--foreground))" },
  { tag: t.link, color: "hsl(var(--primary))" },
  { tag: t.url, color: "hsl(var(--foreground))" },
  { tag: t.quote, fontStyle: "italic", color: "hsl(var(--foreground))" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", color: "hsl(var(--foreground))" },
  { tag: t.list, color: "hsl(var(--foreground))" },
  { tag: t.contentSeparator, color: "hsl(var(--foreground))" },
  { tag: t.processingInstruction, color: "hsl(var(--primary))" },
  { tag: t.meta, color: "hsl(var(--foreground))" },
  { tag: t.punctuation, color: "hsl(var(--foreground))" },
]);

export const setRawSearchState = StateEffect.define<{ query: string, activeIndex: number, opts: SearchOptions }>();

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

// Base theme — transparent background, no outlines
const baseTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent !important",
    width: "100%",
  },
  ".cm-content": {
    padding: "0",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  ".cm-line": {
    padding: "0",
  },
  ".cm-scroller": {
    overflow: "visible",
    fontFamily: "var(--font-mono)",
  },
  ".cm-cursor": {
    borderLeftColor: "hsl(var(--foreground))",
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
  },
  ".cm-dropCursor": {
    borderLeftColor: "hsl(var(--foreground))",
    borderLeftWidth: "1px",
    borderLeftStyle: "solid",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "hsl(var(--primary) / 25%)",
  },
  "&.cm-focused": {
    outline: "none",
  },
});

export function RawEditor({ content, onChange, findQuery = "", currentMatchIndex = 0, searchOpts = {}, readOnly = false }: RawEditorProps) {
  const cmRef = useRef<ReactCodeMirrorRef>(null);

  useEffect(() => {
    if (cmRef.current?.view) {
      const tree = syntaxTree(cmRef.current.view.state);
      const nodes: string[] = [];
      tree.cursor().iterate(node => {
        nodes.push(`${node.name}(${node.from}-${node.to})`);
      });
      console.log('Parse tree:', nodes.join(', '));
    }
  }, [content]);

  const extensions = useMemo(() => [
    markdown(),
    EditorView.lineWrapping,
    syntaxHighlighting(rawHighlightStyle),
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
        theme="none"
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
          //syntaxHighlighting: false,
        }}
        className="text-[14px] leading-[1.7] min-h-[300px] [&_.cm-editor]:outline-none [&_.cm-editor.cm-focused]:outline-none"
      />
    </div>
  );
}
