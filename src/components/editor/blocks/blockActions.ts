import { Fragment, Slice, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * What the block menu (opened from the grip) does to the block at `pos`. Each
 * returns null when the block is no longer where it was: the note may have
 * reloaded or changed while the menu was open.
 */

/** Pick the block as a whole, as clicking its grip does. Null if it can't be picked. */
export function selectBlock(state: EditorState, pos: number, node: ProseMirrorNode): Transaction | null {
	if (state.doc.nodeAt(pos) !== node || !NodeSelection.isSelectable(node)) return null;
	return state.tr.setSelection(NodeSelection.create(state.doc, pos));
}

/**
 * The block as markdown, through the editor's clipboard serializer (what Cmd+C
 * puts on the clipboard). A list item keeps its marker, numbered as shown, by
 * going out inside a list of its own. Null if the block has moved.
 */
export function blockText(view: EditorView, pos: number, node: ProseMirrorNode): string | null {
	const { doc } = view.state;
	if (doc.nodeAt(pos) !== node) return null;
	const $pos = doc.resolve(pos);
	const list = $pos.parent;
	let block = node;
	if ($pos.depth > 0 && /List$/.test(list.type.name)) {
		const start = typeof list.attrs.start === "number" ? { start: list.attrs.start + $pos.index() } : {};
		block = list.type.create({ ...list.attrs, ...start }, node);
	}
	return view.serializeForClipboard(new Slice(Fragment.from(block), 0, 0)).text.replace(/\s+$/, "");
}

/** Remove the block. Deleting through the selection also removes a list left empty by it. */
export function deleteBlock(state: EditorState, pos: number, node: ProseMirrorNode): Transaction | null {
	if (state.doc.nodeAt(pos) !== node) return null;
	const tr = state.tr;
	if (NodeSelection.isSelectable(node)) {
		tr.setSelection(NodeSelection.create(state.doc, pos)).deleteSelection();
	} else {
		tr.delete(pos, pos + node.nodeSize);
		tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(tr.mapping.map(pos), tr.doc.content.size))));
	}
	return tr.scrollIntoView();
}

/** Put a copy right below the block and pick it. */
export function duplicateBlock(state: EditorState, pos: number, node: ProseMirrorNode): Transaction | null {
	if (state.doc.nodeAt(pos) !== node) return null;
	const at = pos + node.nodeSize;
	const tr = state.tr.insert(at, node.copy(node.content));
	tr.setSelection(
		NodeSelection.isSelectable(node)
			? NodeSelection.create(tr.doc, at)
			: TextSelection.near(tr.doc.resolve(at + 1)),
	);
	return tr.scrollIntoView();
}
