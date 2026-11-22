import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []), convertFileSrc: (path: string) => path }));

import { extensions } from "../extensions";

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

function open(content: string) {
	const editor = new Editor({ element: document.createElement("div"), extensions, content });
	editors.push(editor);
	const targets: string[] = [];
	editor.state.doc.descendants((node) => {
		if (node.type.name === "image") targets.push(node.attrs.src);
		const mark = node.marks.find((m) => m.type.name === "link");
		if (mark) targets.push(mark.attrs.href);
	});
	return { targets, saved: ((editor.storage as any).markdown.getMarkdown() as string).trim() };
}

describe("saving links to files with non-Latin names", () => {
	it.each([
		["a readable link", "[Σημειώσεις](σημειώσεις-έργου.md)", "[Σημειώσεις](σημειώσεις-έργου.md)"],
		["an encoded link", "[a](%CE%B1.md)", "[a](α.md)"],
		["spaces", "[m](会議%20メモ.md)", "[m](会議%20メモ.md)"],
		["spaces in angle brackets", "[m](<σχέδιο δύο.md>)", "[m](σχέδιο%20δύο.md)"],
		["a heading anchor", "[t](α.md#τέλος)", "[t](α.md#τέλος)"],
		["an anchor alone", "[t](#τέλος)", "[t](#τέλος)"],
		["a title", '[t](α.md "τίτλος")', '[t](α.md "τίτλος")'],
		["parentheses", "[t](α%20%282%29.md)", "[t](α%20%282%29.md)"],
		["an invisible character", "[t](a%C2%A0b.md)", "[t](a%C2%A0b.md)"],
		["bold", "[**t**](α.md)", "[**t**](α.md)"],
		["a web address", "[w](https://x.gr/%CE%B1)", "[w](https://x.gr/%CE%B1)"],
		["an image", "![εικόνα](εικόνες/γάτα.png)", "![εικόνα](εικόνες/γάτα.png)"],
	])("%s", (_name, source, written) => {
		const first = open(source);
		expect(first.saved).toBe(written);
		// Saved again it stays the same, and points at the same thing.
		const again = open(first.saved);
		expect(again.saved).toBe(written);
		expect(again.targets.map(decodeURIComponent)).toEqual(first.targets.map(decodeURIComponent));
	});

	it.each([
		"![γ](γάτα.png)\n\nafter",
		"![γ](γάτα.png)\n\n## Heading",
		"![a](a.png)\n\n![b](b.png)\n\n- list",
		"- item\n\n  ![a](a.png)\n\n  more in the item",
		"> ![a](a.png)\n>\n> quoted",
	])("an image doesn't swallow the block after it: %j", (source) => {
		expect(open(source).saved).toBe(source);
	});
});
