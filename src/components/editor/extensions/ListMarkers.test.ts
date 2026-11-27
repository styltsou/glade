import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: async () => [],
	convertFileSrc: (path: string) => `glade-img://localhost/${path}`,
}));
import { extensions } from "@/components/editor/extensions";

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

/** The marker level of every list of `tag` in the rendered note, outermost first. */
function levels(markdown: string, tag: "ul" | "ol") {
	const editor = new Editor({ extensions, content: markdown });
	editors.push(editor);
	return [...editor.view.dom.querySelectorAll(`${tag}:not([data-type="taskList"])`)].map((list) =>
		list.getAttribute("data-marker-level"),
	);
}

/** A list nested `depth` levels deep, one item per level. */
function nested(depth: number, marker: (level: number) => string) {
	return Array.from({ length: depth }, (_, i) => `${"    ".repeat(i)}${marker(i)} level ${i + 1}`).join("\n");
}

describe("list marker levels", () => {
	it("cycles bullets past the third level instead of stopping", () => {
		expect(levels(nested(9, () => "-"), "ul")).toEqual(["0", "1", "2", "0", "1", "2", "0", "1", "2"]);
	});

	it("cycles numbered lists the same way", () => {
		expect(levels(nested(7, () => "1."), "ol")).toEqual(["0", "1", "2", "0", "1", "2", "0"]);
	});

	it("counts bullets and numbers apart, and skips task lists", () => {
		expect(levels("- a\n    1. b\n        - c\n", "ul")).toEqual(["0", "1"]);
		expect(levels("- a\n    1. b\n        - c\n", "ol")).toEqual(["0"]);
		expect(levels("- [ ] task\n    - under the task\n", "ul")).toEqual(["0"]);
	});

	it("updates as the list is edited", () => {
		const editor = new Editor({ extensions, content: "- a\n- b\n" });
		editors.push(editor);
		editor.commands.setTextSelection(editor.state.doc.content.size - 3);
		editor.commands.sinkListItem("listItem");
		const lists = [...editor.view.dom.querySelectorAll("ul")];
		expect(lists.map((list) => list.getAttribute("data-marker-level"))).toEqual(["0", "1"]);
	});
});
