import type { Editor } from "@tiptap/core";
import { trailingBlankCount } from "@/lib/markdownFidelity";

/** A paragraph with no content (what an extra Enter leaves behind). */
export const isEmptyParagraph = (node: any): boolean =>
	node.type?.name === "paragraph" && node.content?.size === 0;

export function topLevelNodes(editor: Editor): object[] {
	const nodes: object[] = [];
	editor.state.doc.forEach((n) => nodes.push(n));
	return nodes;
}

/**
 * The editor keeps one empty paragraph after a final block that is not a
 * paragraph (list, table, code...) so there is somewhere to type. That one is
 * the editor's, not a blank line from the file.
 */
export function baselineOf(contentNodes: object[]): number {
	const last: any = contentNodes[contentNodes.length - 1];
	return last && last.type?.name !== "paragraph" ? 1 : 0;
}

export function countTrailingEmpties(editor: Editor): number {
	const nodes = topLevelNodes(editor);
	let n = 0;
	while (n < nodes.length && isEmptyParagraph(nodes[nodes.length - 1 - n])) n++;
	return n;
}

/**
 * Blank lines at the end of a file come back as empty paragraphs. They are
 * added without touching undo history and without counting as an edit.
 */
export function appendTrailingBlanks(editor: Editor, source: string): void {
	const nodes = topLevelNodes(editor);
	const empties = countTrailingEmpties(editor);
	const core = nodes.slice(0, nodes.length - empties);
	const missing = trailingBlankCount(source) + baselineOf(core) - empties;
	if (missing <= 0) return;
	const { schema } = editor.state;
	editor
		.chain()
		.command(({ tr }) => {
			tr.setMeta("addToHistory", false);
			tr.setMeta("preventUpdate", true);
			tr.insert(tr.doc.content.size, Array.from({ length: missing }, () => schema.nodes.paragraph.create()));
			return true;
		})
		.run();
}
