import type { Node as PMNode } from "@tiptap/pm/model";

const children = (node: PMNode) => Array.from({ length: node.childCount }, (_, i) => node.child(i));

/** What a pipe table can hold: a header row, no spans, one block in each cell. */
function isPipeTable(table: PMNode): boolean {
	return children(table).every((row, i) =>
		children(row).every(
			(cell) =>
				(cell.type.name === "tableHeader") === (i === 0) &&
				cell.childCount === 1 &&
				!(cell.attrs.colspan > 1 || cell.attrs.rowspan > 1),
		),
	);
}

/** A cell with content but no text, such as one holding only an image. */
function hasTextlessCell(table: PMNode): boolean {
	return children(table).some((row) =>
		children(row).some((cell) => !cell.textContent.trim() && !!cell.firstChild?.childCount),
	);
}

/**
 * tiptap-markdown writes a cell without text as empty, deleting an image in it.
 * Those tables are written here; every other one is left to tiptap-markdown.
 */
export const tableMarkdown = {
	serialize(this: { editor: any; options: unknown }, state: any, node: PMNode, parent: PMNode, index: number) {
		if (!isPipeTable(node) || !hasTextlessCell(node)) {
			// Asked for without our storage, the serializer hands back its own.
			const original = this.editor.storage.markdown.serializer.serializeNode({ name: "table", options: this.options });
			return original(state, node, parent, index);
		}
		state.inTable = true;
		children(node).forEach((row, i) => {
			state.write("| ");
			children(row).forEach((cell, j) => {
				if (j) state.write(" | ");
				if (cell.firstChild?.childCount) state.renderInline(cell.firstChild);
			});
			state.write(" |");
			state.ensureNewLine();
			if (i === 0) {
				state.write(`| ${children(row).map(() => "---").join(" | ")} |`);
				state.ensureNewLine();
			}
		});
		state.closeBlock(node);
		state.inTable = false;
	},
};
