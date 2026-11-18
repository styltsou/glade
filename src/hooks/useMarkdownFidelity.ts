import { useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";
import {
	createFidelity,
	serializeWithFidelity,
	type Fidelity,
} from "@/lib/markdownFidelity";
import { appendTrailingBlanks, countTrailingEmpties, isEmptyParagraph, topLevelNodes } from "@/lib/trailingBlanks";

export function useMarkdownFidelity() {
	const fidelityRef = useRef<Fidelity | null>(null);

	/** Remember the source the editor was just loaded with. */
	const snapshot = useCallback((editor: Editor, source: string) => {
		appendTrailingBlanks(editor, source);
		fidelityRef.current = createFidelity(source, topLevelNodes(editor), isEmptyParagraph);
	}, []);

	const getMarkdown = useCallback((editor: Editor): string => {
		const storage = (editor.storage as any).markdown;
		const fidelity = fidelityRef.current;
		if (!fidelity) {
			// Fallback: still keep blank lines the user added at the end.
			const text: string = storage.getMarkdown();
			const blanks = countTrailingEmpties(editor);
			return blanks > 0 ? text.replace(/\s+$/, "") + "\n".repeat(blanks + 1) : text;
		}
		return serializeWithFidelity(
			fidelity,
			topLevelNodes(editor),
			(node) => storage.serializer.serialize(editor.schema.topNodeType.create(null, node as any)),
			isEmptyParagraph,
		);
	}, []);

	return { snapshot, getMarkdown };
}
