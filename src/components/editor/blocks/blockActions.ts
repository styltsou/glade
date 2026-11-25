import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";

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
