import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { NodeSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it } from "vitest";
import { deleteBlock, duplicateBlock, selectBlock } from "./blockActions";

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

function open(content: string) {
	const editor = new Editor({ element: document.createElement("div"), extensions: [StarterKit], content });
	editors.push(editor);
	return editor;
}

function block(editor: Editor, index: number) {
	let pos = 0;
	for (let i = 0; i < index; i++) pos += editor.state.doc.child(i).nodeSize;
	return { pos, node: editor.state.doc.child(index) };
}

describe("block actions", () => {
	it("selects the block as a whole", () => {
		const editor = open("<p>one</p><p>two</p>");
		const { pos, node } = block(editor, 1);
		editor.view.dispatch(selectBlock(editor.state, pos, node)!);
		expect(editor.state.selection).toBeInstanceOf(NodeSelection);
		expect(editor.state.selection.from).toBe(pos);
	});

	it("deletes only that block", () => {
		const editor = open("<p>one</p><hr><p>three</p>");
		const { pos, node } = block(editor, 1);
		editor.view.dispatch(deleteBlock(editor.state, pos, node)!);
		expect(editor.state.doc.childCount).toBe(2);
		expect(editor.state.doc.textContent).toBe("onethree");
	});

	it("deletes a code block", () => {
		const editor = open("<p>one</p><pre><code>let x</code></pre><p>three</p>");
		const { pos, node } = block(editor, 1);
		expect(node.type.name).toBe("codeBlock");
		editor.view.dispatch(deleteBlock(editor.state, pos, node)!);
		expect(editor.state.doc.textContent).toBe("onethree");
	});

	it("deletes the only block and leaves an empty paragraph", () => {
		const editor = open("<hr>");
		const { pos, node } = block(editor, 0);
		editor.view.dispatch(deleteBlock(editor.state, pos, node)!);
		expect(editor.state.doc.childCount).toBeGreaterThan(0);
		expect(editor.state.doc.textContent).toBe("");
	});

	it("removes a list that its last item leaves empty", () => {
		const editor = open("<p>a</p><ul><li><p>only</p></li></ul>");
		let item = { pos: 0, node: editor.state.doc };
		editor.state.doc.descendants((node, pos) => {
			if (node.type.name === "listItem") item = { pos, node };
		});
		editor.view.dispatch(deleteBlock(editor.state, item.pos, item.node)!);
		expect(editor.state.doc.textContent).toBe("a");
		expect(editor.getHTML()).not.toContain("<ul");
	});

	it("duplicates a block below itself and picks the copy", () => {
		const editor = open("<p>one</p><p>two</p>");
		const { pos, node } = block(editor, 0);
		editor.view.dispatch(duplicateBlock(editor.state, pos, node)!);
		expect(editor.state.doc.childCount).toBe(3);
		expect(editor.state.doc.child(1).textContent).toBe("one");
		expect(editor.state.selection.from).toBe(pos + node.nodeSize);
	});

	it("does nothing when the block is no longer there", () => {
		const editor = open("<p>one</p><p>two</p>");
		const { pos, node } = block(editor, 1);
		editor.commands.setContent("<p>changed</p>");
		expect(deleteBlock(editor.state, pos, node)).toBeNull();
		expect(duplicateBlock(editor.state, pos, node)).toBeNull();
		expect(selectBlock(editor.state, pos, node)).toBeNull();
	});
});
