import type { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";
import { paneNotePath } from "@/components/editor/extensions/PaneNote";

interface BlockState {
	serializer: { serialize(content: Node): string };
	/** Local images inside HTML blocks resolve against the note, so output depends on it. */
	path: string | null;
	text: WeakMap<Node, string>;
}

const states = new WeakMap<Editor, BlockState>();

/**
 * Markdown for one top-level block, remembered per node. Every save check
 * re-renders all blocks edited since loading, so on each keystroke this has to
 * cost next to nothing for the ones that did not change.
 */
export function serializeBlock(editor: Editor, node: Node): string {
	const path = paneNotePath(editor);
	let state = states.get(editor);
	if (state?.path !== path) {
		const base = (editor.storage as any).markdown.serializer;
		// `nodes` and `marks` are getters that rebuild their tables from every
		// extension on each serialize() call, about 90% of the cost of a small block.
		const serializer = Object.create(base, { nodes: { value: base.nodes }, marks: { value: base.marks } });
		state = { serializer, path, text: new WeakMap() };
		states.set(editor, state);
	}
	let text = state.text.get(node);
	if (text === undefined) {
		text = state.serializer.serialize(editor.schema.topNodeType.create(null, node));
		state.text.set(node, text);
	}
	return text;
}
