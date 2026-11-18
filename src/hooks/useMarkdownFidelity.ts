import { useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { createFidelity, serializeWithFidelity, type Fidelity } from "@/lib/markdownFidelity";
import { splitNoteTitle, restoreNoteTitle, withNoteTitle, type NoteTitle } from "@/lib/noteTitle";
import { appendTrailingBlanks, baselineOf, countTrailingEmpties, isEmptyParagraph, topLevelNodes } from "@/lib/trailingBlanks";

export function useMarkdownFidelity() {
  const fidelityRef = useRef<Fidelity | null>(null);
  const titleRef = useRef<{ title: NoteTitle; heading: Node; original: Node[] } | null>(null);

  /** The editor contains only the body; the source retains the protected H1. */
  const snapshot = useCallback((editor: Editor, source: string) => {
    const title = splitNoteTitle(source);
    appendTrailingBlanks(editor, title.body);
    const nodes = topLevelNodes(editor) as Node[];
    const hidden = title.heading ? editor.schema.nodes.heading.create({ level: 1 }) : null;
    titleRef.current = hidden ? { title, heading: hidden, original: nodes } : null;
    const all = hidden ? withNoteTitle(nodes, nodes, hidden, title.index) : nodes;
    fidelityRef.current = createFidelity(source, all, isEmptyParagraph,
      (content) => baselineOf(content.filter((node) => node !== hidden)));
  }, []);

  const getMarkdown = useCallback((editor: Editor): string => {
    const storage = (editor.storage as any).markdown;
    const fidelity = fidelityRef.current;
    const hidden = titleRef.current;
    const nodes = topLevelNodes(editor) as Node[];
    if (!fidelity) {
      const text: string = storage.getMarkdown();
      const empties = countTrailingEmpties(editor);
      const blanks = Math.max(0, empties - baselineOf(nodes.slice(0, nodes.length - empties)));
      const body = blanks > 0 ? text.replace(/\s+$/, "") + "\n".repeat(blanks + 1) : text;
      return hidden ? restoreNoteTitle(hidden.title, body) : body;
    }
    return serializeWithFidelity(
      fidelity,
      hidden ? withNoteTitle(nodes, hidden.original, hidden.heading, hidden.title.index) : nodes,
      (node) => storage.serializer.serialize(editor.schema.topNodeType.create(null, node as any)),
      isEmptyParagraph,
    );
  }, []);

  return { snapshot, getMarkdown };
}
