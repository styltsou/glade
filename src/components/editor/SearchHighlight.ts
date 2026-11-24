import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createMatcher, type FindOptions, type FindRange } from "@/lib/find";

export interface SearchParams extends FindOptions {
  /** What to highlight; empty highlights nothing. */
  query: string;
  /** Which match is the current one. */
  activeIndex: number;
}

const searchKey = new PluginKey<SearchParams & { decos: DecorationSet }>("searchHighlight");

/** Stands for an inline node with no text (a mention, a hard break), one position wide like the node. */
const LEAF = "￼";

/**
 * Every match in the document. Each block of text is searched as a whole, so a
 * match runs on across bold, italic and links ("a **bold** word"), and never
 * across two blocks.
 */
export function findInDoc(doc: PMNode, query: string, options: FindOptions = {}): FindRange[] {
  const match = createMatcher(query, options);
  if (!match) return [];
  const found: FindRange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    // A position inside the block is the block's start + 1 (past its opening token) + the offset.
    const text = node.textBetween(0, node.content.size, undefined, LEAF);
    for (const m of match(text)) found.push({ from: pos + 1 + m.from, to: pos + 1 + m.to });
    return false;
  });
  return found;
}

function decorate(doc: PMNode, { query, caseSensitive, wholeWord, activeIndex }: SearchParams): DecorationSet {
  const matches = findInDoc(doc, query, { caseSensitive, wholeWord });
  if (matches.length === 0) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    matches.map((m, i) =>
      Decoration.inline(m.from, m.to, { class: i === activeIndex ? "search-highlight-active" : "search-highlight" }),
    ),
  );
}

/** Highlights what the find bar is looking for. Driven with `setSearch`. */
export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchKey,
        state: {
          init: () => ({ query: "", activeIndex: 0, decos: DecorationSet.empty }),
          apply(tr, value) {
            const next = tr.getMeta(searchKey) as SearchParams | undefined;
            if (!next && !tr.docChanged) return value;
            const params = next ?? value;
            // Edits re-run the search: a replaced or typed-over match must not stay lit.
            return { ...params, decos: params.query ? decorate(tr.doc, params) : DecorationSet.empty };
          },
        },
        props: {
          decorations: (state) => searchKey.getState(state)?.decos,
        },
      }),
    ];
  },
});

/** Point the highlight at a query. It does not touch the selection or the content. */
export function setSearch(editor: Editor, params: SearchParams): void {
  const current = searchKey.getState(editor.state);
  if (
    current &&
    current.query === params.query &&
    current.activeIndex === params.activeIndex &&
    !!current.caseSensitive === !!params.caseSensitive &&
    !!current.wholeWord === !!params.wholeWord
  ) {
    return;
  }
  editor.view.dispatch(editor.state.tr.setMeta(searchKey, params).setMeta("addToHistory", false));
}
