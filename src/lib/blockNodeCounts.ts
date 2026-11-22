import type { Editor } from "@tiptap/core";
import { DOMParser as NodeParser } from "@tiptap/pm/model";

/** Tags that end a paragraph, so can split one block into several nodes. */
const BLOCK_TAG =
	/<\/?(?:address|article|aside|blockquote|center|dd|details|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|td|th|tr|ul)(?=[\s/>]|$)/i;

/** Whether a block may become other than one node. Parsing each would be slow in a big note. */
function mayNotBeOne(block: string): boolean {
	if (/^ {0,3}(```|~~~)/.test(block)) return false;
	return /^ {0,3}</.test(block) || BLOCK_TAG.test(block);
}

/**
 * How many top-level editor nodes each block of markdown becomes. Nearly always
 * one; HTML can be none (a comment, a lone tag) or several, and counting it as
 * one would line every block after it up with the wrong source.
 */
export function blockNodeCounts(editor: Editor, blocks: string[]): number[] {
	const { parser } = (editor.storage as any).markdown;
	const toNodes = NodeParser.fromSchema(editor.schema);
	return blocks.map((block) => {
		if (!mayNotBeOne(block)) return 1;
		const template = document.createElement("template");
		// A template is inert: nothing in it loads or runs while being counted.
		template.innerHTML = parser.parse(block);
		const doc = toNodes.parse(template.content);
		let count = doc.childCount;
		while (count > 0) {
			const node = doc.child(count - 1);
			if (node.type.name !== "paragraph" || node.content.size > 0) break;
			count--;
		}
		return count;
	});
}
