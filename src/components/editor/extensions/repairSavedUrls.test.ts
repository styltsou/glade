import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []), convertFileSrc: (p: string) => p }));

import { extensions } from "../extensions";

const editors: Editor[] = [];
afterEach(() => {
	editors.splice(0).forEach((editor) => editor.destroy());
});

function open(content: string) {
	const editor = new Editor({ element: document.createElement("div"), extensions, content });
	editors.push(editor);
	const links: [string, string][] = [];
	editor.state.doc.descendants((node) => {
		const mark = node.marks.find((m) => m.type.name === "link");
		if (mark) links.push([node.text!, mark.attrs.href]);
	});
	return { links, saved: (editor.storage as any).markdown.getMarkdown() as string };
}

// Exactly what older versions wrote: on the first save, then on every later one.
const DAMAGED: [string, string, string, string?][] = [
	["https://x.com/__init__/a", String.raw`<https://x.com/\__init_\_/a>`, String.raw`[https://x.com/\\\__init\_\\\_/a](https://x.com/%5C__init_%5C_/a)`],
	["https://w.org/wiki/Foo_(bar)", String.raw`<https://w.org/wiki/Foo\_(bar)>`, String.raw`[https://w.org/wiki/Foo\\\_(bar)](https://w.org/wiki/Foo%5C_\(bar\))`],
	["https://a.com/?b=*2", String.raw`<https://a.com/?b=\*2>`, String.raw`[https://a.com/?b=\\\*2](https://a.com/?b=%5C*2)`],
	["https://a.com/~me", String.raw`<https://a.com/\~me>`, String.raw`[https://a.com/\\\~me](https://a.com/%5C~me)`],
	["https://a.com/x[1]", String.raw`<https://a.com/x\[1\]>`, String.raw`[https://a.com/x\\\[1\\\]](https://a.com/x%5C%5B1%5C%5D)`, "https://a.com/x%5B1%5D"],
	["https://a.com/_a&b=é", String.raw`<https://a.com/\_a&b=é>`, String.raw`[https://a.com/\\\_a&b=é](https://a.com/%5C_a&b=%C3%A9)`, "https://a.com/_a&b=%C3%A9"],
	["https://a.com/é_b", String.raw`<https://a.com/é\_b>`, String.raw`[https://a.com/é\\\_b](https://a.com/%C3%A9%5C_b)`, "https://a.com/%C3%A9_b"],
	["https://a.com/a%20b_/c", String.raw`<https://a.com/a%20b\_/c>`, String.raw`[https://a.com/a b\\\_/c](https://a.com/a%20b%5C_/c)`],
	["https://a.com/x%5B1%5D_", String.raw`<https://a.com/x%5B1%5D\_>`, String.raw`[https://a.com/x\[1\]\\\_](https://a.com/x%5B1%5D%5C_)`],
];

describe("URLs damaged by older versions", () => {
	for (const [original, firstSave, laterSave, encoded] of DAMAGED) {
		const href = encoded ?? original;
		for (const [when, source] of [["first", firstSave], ["later", laterSave]] as const) {
			it(`${original} (${when} save)`, () => {
				const { links, saved } = open(source);
				expect(links).toHaveLength(1);
				expect(links[0][1]).toBe(href);
				expect(links[0][0]).not.toContain("\\");
				// Once repaired it stays repaired.
				expect(open(saved).links[0][1]).toBe(href);
				expect(saved).not.toContain("%5C");
			});
		}
	}

	it("repairs several in one paragraph, list or table", () => {
		const a = String.raw`<https://a.com/\~me>`;
		const b = String.raw`<https://b.com/?q=\*>`;
		for (const source of [`see ${a} and **${b}**`, `- ${a}\n- ${b}`, `| x | y |\n| - | - |\n| ${a} | ${b} |`])
			expect(open(source).links.map((l) => l[1])).toEqual(["https://a.com/~me", "https://b.com/?q=*"]);
	});
});

describe("URLs that were never damaged", () => {
	it.each([
		// A real encoded backslash.
		["<https://r.com/?q=%5C*>", "https://r.com/?q=%5C*"],
		["<https://r.com/?q=%5C_>", "https://r.com/?q=%5C_"],
		// Text of its own, so not something the old save produced.
		["[regex](https://r.com/?q=%5C*)", "https://r.com/?q=%5C*"],
		// A backslash the old escaping would never have written there.
		[String.raw`<https://r.com/\d+>`, "https://r.com/%5Cd+"],
		[String.raw`<https://r.com/a\_b>`, "https://r.com/a%5C_b"],
		// Only some specials escaped: the old escaping did all or none.
		[String.raw`<https://r.com/\*x*>`, "https://r.com/%5C*x*"],
		["<https://x.com/__init__/a>", "https://x.com/__init__/a"],
	])("%s", (source, href) => {
		const first = open(source);
		expect(first.links[0][1]).toBe(href);
		// And still the same after saving and reopening, twice.
		const second = open(first.saved);
		expect(second.links[0][1]).toBe(href);
		expect(open(second.saved).links[0][1]).toBe(href);
	});

	it("leaves code alone", () => {
		const source = "`<https://a.com/\\~me>`";
		expect(open(source).links).toEqual([]);
	});
});
