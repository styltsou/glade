import { TableView } from "@tiptap/extension-table";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * TipTap's table node view with an extra scroller around its `.tableWrapper`.
 * The wrapper holds the table plus the add/move controls, so they scroll with
 * the table when it is wider than the note, and their coordinates stay
 * relative to the wrapper's own box.
 */
export class NoteTableView extends TableView {
	constructor(node: ProseMirrorNode, cellMinWidth: number) {
		super(node, cellMinWidth);
		const wrapper = this.dom;
		const scroller = document.createElement("div");
		scroller.className = "note-table-scroller";
		scroller.appendChild(wrapper);
		this.dom = scroller;
	}
}
