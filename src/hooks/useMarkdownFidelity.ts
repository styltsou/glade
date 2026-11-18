import { useCallback, useRef } from "react";
import type { Editor } from "@tiptap/core";
import {
	createFidelity,
	serializeWithFidelity,
	type Fidelity,
} from "@/lib/markdownFidelity";

function topLevelNodes(editor: Editor): object[] {
	const nodes: object[] = [];
	editor.state.doc.forEach((n) => nodes.push(n));
	return nodes;
}

/**
 * Source-preserving markdown output for the rich editor. Call `snapshot` right
 * after loading content; `getMarkdown` then returns the original text for any
 * top-level block the user hasn't touched.
 */
export function useMarkdownFidelity() {
	const fidelityRef = useRef<Fidelity | null>(null);

	/** Remember the source the editor was just loaded with. */
	const snapshot = useCallback((editor: Editor, source: string) => {
		fidelityRef.current = createFidelity(source, topLevelNodes(editor));
	}, []);

	const getMarkdown = useCallback((editor: Editor): string => {
		const storage = (editor.storage as any).markdown;
		const fidelity = fidelityRef.current;
		if (!fidelity) return storage.getMarkdown();
		return serializeWithFidelity(fidelity, topLevelNodes(editor), (node) =>
			storage.serializer.serialize(editor.schema.topNodeType.create(null, node as any)),
		);
	}, []);

	return { snapshot, getMarkdown };
}
