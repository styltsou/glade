import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: async () => [],
	convertFileSrc: (path: string) => `glade-img://localhost/${path}`,
}));
import { extensions } from "@/components/editor/extensions";
import { blockText } from "./blockActions";

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

/** Copied text for the first block of `type` in a note of `markdown`, or the nth one. */
function copied(markdown: string, type: string, nth = 0) {
	const editor = new Editor({ extensions, content: markdown });
	editors.push(editor);
	const found: { pos: number; node: any }[] = [];
	editor.state.doc.descendants((node, pos) => {
		if (node.type.name === type) found.push({ pos, node });
	});
	const { pos, node } = found[nth];
	return blockText(editor.view, pos, node);
}

describe("blockText", () => {
	it("copies a block as its markdown", () => {
		expect(copied("Some *em* text\n\n## Head\n", "heading")).toBe("## Head");
		expect(copied("> quote\n", "blockquote")).toBe("> quote");
		expect(copied("```ts\nconst x = 1;\n```\n", "codeBlock")).toBe("```ts\nconst x = 1;\n```");
		expect(copied("```mermaid\ngraph TD; A-->B\n```\n", "mermaidBlock")).toBe("```mermaid\ngraph TD; A-->B\n```");
	});

	it("keeps a list item's marker, numbered as it shows", () => {
		expect(copied("- one\n- two\n    - nested\n", "listItem", 1)).toBe("- two\n  - nested");
		expect(copied("1. first\n2. second\n", "listItem", 1)).toBe("2. second");
		expect(copied("3. third\n4. fourth\n", "listItem", 1)).toBe("4. fourth");
		expect(copied("- [x] done\n", "taskItem")).toBe("- [x] done");
	});

	it("gives nothing once the block has moved", () => {
		const editor = new Editor({ extensions, content: "one\n\ntwo\n" });
		editors.push(editor);
		const node = editor.state.doc.child(1);
		expect(blockText(editor.view, 0, node)).toBeNull();
	});
});
