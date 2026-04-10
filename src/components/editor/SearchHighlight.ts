import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SearchHighlightOptions {
  query: string;
  activeIndex: number;
  caseSensitive: boolean;
  matchWholeWord: boolean;
  useRegex: boolean;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  matchWholeWord?: boolean;
  useRegex?: boolean;
}

/**
 * Shared regex builder for all search modes.
 * Returns null if the query is invalid/empty.
 */
export function buildRegex(
  query: string,
  { caseSensitive = false, matchWholeWord = false, useRegex = false }: SearchOptions = {}
): RegExp | null {
  if (!query || query.trim() === "") return null;

  try {
    const flags = caseSensitive ? "g" : "gi";
    let pattern: string;

    if (useRegex) {
      // Use the raw query as a regex pattern — may throw if invalid
      pattern = query;
    } else {
      // Escape special regex characters for literal matching
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    if (matchWholeWord && !useRegex) {
      pattern = `\\b${pattern}\\b`;
    }

    return new RegExp(pattern, flags);
  } catch {
    // Invalid regex — return null so callers can handle gracefully
    return null;
  }
}

export const SearchHighlight = Extension.create<SearchHighlightOptions>({
  name: "searchHighlight",

  addOptions() {
    return {
      query: "",
      activeIndex: 0,
      caseSensitive: false,
      matchWholeWord: false,
      useRegex: false,
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("searchHighlight"),
        state: {
          init: () => ({
            decos: DecorationSet.empty,
            query: "",
            activeIndex: 0,
            caseSensitive: false,
            matchWholeWord: false,
            useRegex: false,
          }),
          apply: (tr, oldState) => {
            const meta = tr.getMeta("searchHighlight");
            const query = meta ? meta.query : oldState.query;
            const activeIndex = meta ? meta.activeIndex : oldState.activeIndex;
            const caseSensitive = meta ? meta.caseSensitive : oldState.caseSensitive;
            const matchWholeWord = meta ? meta.matchWholeWord : oldState.matchWholeWord;
            const useRegex = meta ? meta.useRegex : oldState.useRegex;

            if (!tr.docChanged && !meta) {
              return { ...oldState, decos: oldState.decos.map(tr.mapping, tr.doc) };
            }

            const regex = buildRegex(query, { caseSensitive, matchWholeWord, useRegex });
            if (!regex) {
              return { query, activeIndex, caseSensitive, matchWholeWord, useRegex, decos: DecorationSet.empty };
            }

            const decorations: Decoration[] = [];
            let matchIndex = 0;

            tr.doc.descendants((node, pos) => {
              if (node.isText && node.text) {
                regex.lastIndex = 0;
                let match;
                while ((match = regex.exec(node.text)) !== null) {
                  if (match[0].length === 0) break;
                  const from = pos + match.index;
                  const to = from + match[0].length;
                  const isActive = matchIndex === activeIndex;
                  decorations.push(
                    Decoration.inline(from, to, {
                      class: isActive ? "search-highlight-active" : "search-highlight",
                    })
                  );
                  matchIndex++;
                }
              }
            });

            return {
              query,
              activeIndex,
              caseSensitive,
              matchWholeWord,
              useRegex,
              decos: DecorationSet.create(tr.doc, decorations),
            };
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)?.decos ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export function findMatches(
  doc: any,
  query: string,
  options: SearchOptions = {}
): { from: number; to: number }[] {
  const matches: { from: number; to: number }[] = [];
  const regex = buildRegex(query, options);
  if (!regex) return matches;

  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(node.text)) !== null) {
        if (match[0].length === 0) break;
        matches.push({ from: pos + match.index, to: pos + match.index + match[0].length });
      }
    }
  });

  return matches;
}

export function findMatchesRaw(
  text: string,
  query: string,
  options: SearchOptions = {}
): { from: number; to: number }[] {
  const matches: { from: number; to: number }[] = [];
  const regex = buildRegex(query, options);
  if (!regex) return matches;

  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[0].length === 0) break;
    matches.push({ from: match.index, to: match.index + match[0].length });
  }
  return matches;
}
