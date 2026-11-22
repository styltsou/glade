import { useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { serializeBlock } from "@/lib/blockSerializer";
import { createFidelity, serializeWithFidelity, splitTrailingEmpties, type Fidelity } from "@/lib/markdownFidelity";
import { blockLayout } from "@/lib/blockLayout";
import { splitNoteTitle, restoreNoteTitle, withNoteTitle, type NoteTitle } from "@/lib/noteTitle";
import { appendTrailingBlanks, baselineOf, countTrailingEmpties, isEmptyParagraph, topLevelNodes } from "@/lib/trailingBlanks";

export function useMarkdownFidelity() {
  const fidelityRef = useRef<Fidelity | null>(null);
  const loadedRef = useRef<{ source: string; nodes: Node[] }>({ source: "", nodes: [] });
  const titleRef = useRef<{ title: NoteTitle; heading: Node; original: Node[]; index: number } | null>(null);

  /** The editor contains only the body; the source retains the protected H1. */
  const snapshot = useCallback((editor: Editor, source: string) => {
    const title = splitNoteTitle(source);
    appendTrailingBlanks(editor, title.body);
    const nodes = topLevelNodes(editor) as Node[];
    loadedRef.current = { source, nodes };
    const hidden = title.heading ? editor.schema.nodes.heading.create({ level: 1 }) : null;

    const layout = blockLayout(editor, title, splitTrailingEmpties(nodes, isEmptyParagraph).core as Node[]);
    const index = layout?.titleIndex ?? title.index;
    titleRef.current = hidden ? { title, heading: hidden, original: nodes, index } : null;
    const all = hidden ? withNoteTitle(nodes, nodes, hidden, index) : nodes;
    fidelityRef.current = layout && createFidelity(source, all, isEmptyParagraph,
      (content) => baselineOf(content.filter((node) => node !== hidden)),
      layout.regions);
  }, []);

  const getMarkdown = useCallback((editor: Editor): string => {
    const storage = (editor.storage as any).markdown;
    const fidelity = fidelityRef.current;
    const hidden = titleRef.current;
    const nodes = topLevelNodes(editor) as Node[];
    if (!fidelity) {
      const { source, nodes: loaded } = loadedRef.current;
      // Blocks that can't be matched to the source are still only rewritten by an edit.
      if (loaded.length > 0 && loaded.length === nodes.length && nodes.every((node, i) => node === loaded[i] || node.eq(loaded[i]))) {
        return source;
      }
      const text: string = storage.getMarkdown();
      const empties = countTrailingEmpties(editor);
      const blanks = Math.max(0, empties - baselineOf(nodes.slice(0, nodes.length - empties)));
      const body = blanks > 0 ? text.replace(/\s+$/, "") + "\n".repeat(blanks + 1) : text;
      const whole = hidden ? restoreNoteTitle(hidden.title, body) : body;
      return whole && source.endsWith("\n") && !whole.endsWith("\n") ? whole + (source.endsWith("\r\n") ? "\r\n" : "\n") : whole;
    }
    return serializeWithFidelity(
      fidelity,
      hidden ? withNoteTitle(nodes, hidden.original, hidden.heading, hidden.index) : nodes,
      // A table ends in a line break of its own; the gap after a block supplies that.
      // The hidden title is a stand-in: when rewritten along with the HTML around it, it is its own source.
      (node) => node === hidden?.heading
        ? hidden!.title.heading
        : serializeBlock(editor, node as Node).replace(/\n+$/, ""),
      isEmptyParagraph,
    );
  }, []);

  return { snapshot, getMarkdown };
}
