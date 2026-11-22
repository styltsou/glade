import { afterEach, describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { blockDropTarget, moveBlock } from "./blockPointerDrag";

const editors: Editor[] = [];
afterEach(() => {
	editors.splice(0).forEach((editor) => editor.destroy());
});

function makeEditor(html: string) {
	const editor = new Editor({ extensions: [StarterKit], content: html });
	editors.push(editor);
	return editor;
}

/** Position before the n-th top-level block. */
function before(editor: Editor, index: number) {
	let pos = 0;
	for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize;
	return pos;
}

const texts = (editor: Editor) => {
	const out: string[] = [];
	editor.state.doc.forEach((node) => out.push(node.textContent));
	return out;
};

describe("moving a block", () => {
	it("moves a block down past others", () => {
		const editor = makeEditor("<h1>One</h1><p>Two</p><p>Three</p><p>Four</p>");
		const at = blockDropTarget(editor.state.doc, before(editor, 1), before(editor, 4));
		expect(at).not.toBeNull();
		editor.view.dispatch(moveBlock(editor.state, before(editor, 1), at!)!);
		expect(texts(editor)).toEqual(["One", "Three", "Four", "Two"]);
	});

	it("moves a block up to the top", () => {
		const editor = makeEditor("<h1>One</h1><p>Two</p><p>Three</p>");
		const at = blockDropTarget(editor.state.doc, before(editor, 2), 0);
		editor.view.dispatch(moveBlock(editor.state, before(editor, 2), at!)!);
		expect(texts(editor)).toEqual(["Three", "One", "Two"]);
	});

	it("does nothing when dropped right where it is", () => {
		const editor = makeEditor("<p>One</p><p>Two</p><p>Three</p>");
		const from = before(editor, 1);
		expect(blockDropTarget(editor.state.doc, from, from)).toBeNull();
		expect(blockDropTarget(editor.state.doc, from, before(editor, 2))).toBeNull();
	});

	it("moves a list item within its list", () => {
		const editor = makeEditor("<ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul>");
		const list = editor.state.doc.child(0);
		const first = 1; // inside the list, before item "a"
		const end = 1 + list.content.size; // after item "c"
		const at = blockDropTarget(editor.state.doc, first, end);
		editor.view.dispatch(moveBlock(editor.state, first, at!)!);
		const items: string[] = [];
		editor.state.doc.child(0).forEach((item) => items.push(item.textContent));
		expect(items).toEqual(["b", "c", "a"]);
	});

	it("drops the empty list when its only item moves out", () => {
		const editor = makeEditor("<ul><li><p>a</p></li></ul><p>after</p>");
		const at = blockDropTarget(editor.state.doc, 1, editor.state.doc.content.size);
		editor.view.dispatch(moveBlock(editor.state, 1, at!)!);
		// The old list is gone, not left empty; the item lands in a new list below.
		// (The editor then adds its usual empty line after a trailing list.)
		expect(editor.state.doc.child(0).textContent).toBe("after");
		expect(editor.state.doc.child(1).type.name).toBe("bulletList");
		expect(editor.state.doc.child(1).textContent).toBe("a");
	});
});
