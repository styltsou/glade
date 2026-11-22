import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []), convertFileSrc: (p: string) => p }));

import { extensions } from "../extensions";

const editors: Editor[] = [];
afterEach(() => {
	editors.splice(0).forEach((editor) => editor.destroy());
});

function make(content = "") {
	const editor = new Editor({ element: document.createElement("div"), extensions, content });
	editors.push(editor);
	return editor;
}

function type(editor: Editor, text: string) {
	for (const ch of text) {
		const { from, to } = editor.state.selection;
		if (!editor.view.someProp("handleTextInput", (f) => f(editor.view, from, to, ch, () => editor.state.tr.insertText(ch, from, to))))
			editor.view.dispatch(editor.state.tr.insertText(ch));
	}
}

/** A real paste event, so the markdown clipboard parser runs. */
function paste(editor: Editor, text: string, html = "") {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	const data: Record<string, string> = { "text/plain": text, "text/html": html };
	Object.assign(event, {
		clipboardData: { getData: (t: string) => data[t] ?? "", files: [], items: [], types: Object.keys(data) },
	});
	editor.view.dom.dispatchEvent(event);
}

function links(editor: Editor) {
	const out: [string, string][] = [];
	let end = -1;
	editor.state.doc.descendants((node, pos) => {
		const mark = node.marks.find((m) => m.type.name === "link");
		if (!mark) return;
		if (end === pos && out[out.length - 1][1] === mark.attrs.href) out[out.length - 1][0] += node.text;
		else out.push([node.text!, mark.attrs.href]);
		end = pos + node.nodeSize;
	});
	return out;
}

const markdown = (editor: Editor) => (editor.storage as any).markdown.getMarkdown() as string;

describe("typing", () => {
	it("links an address when the word is finished", () => {
		const e = make();
		type(e, "go to example.com");
		expect(links(e)).toEqual([]);
		type(e, " now");
		expect(links(e)).toEqual([["example.com", "https://example.com"]]);
	});
	it("links on Enter", () => {
		const e = make();
		type(e, "https://a.com/x");
		e.commands.splitBlock();
		expect(links(e)).toEqual([["https://a.com/x", "https://a.com/x"]]);
	});
	it("links on Enter inside a list", () => {
		const e = make("<ul><li><p></p></li></ul>");
		e.commands.setTextSelection(3);
		type(e, "example.com");
		e.commands.splitListItem("listItem");
		expect(links(e)).toEqual([["example.com", "https://example.com"]]);
	});
	it("links on a line break", () => {
		const e = make();
		type(e, "example.com");
		e.commands.setHardBreak();
		expect(links(e)).toEqual([["example.com", "https://example.com"]]);
	});
	it("leaves sentence punctuation out", () => {
		const e = make();
		type(e, "(see https://a.com/x). ");
		expect(links(e)).toEqual([["https://a.com/x", "https://a.com/x"]]);
	});
	it("never links a note", () => {
		const e = make();
		type(e, "read notes.md and docs/plan.md and README.md. ");
		e.commands.splitBlock();
		expect(links(e)).toEqual([]);
	});
	it("links words that arrive in one edit", () => {
		const e = make();
		e.view.dispatch(e.state.tr.insertText("see https://a.com. and notes.md or b.com next"));
		expect(links(e)).toEqual([["https://a.com", "https://a.com"], ["b.com", "https://b.com"]]);
	});
	it("does not link in code", () => {
		const e = make("<pre><code>x</code></pre>");
		e.commands.setTextSelection(2);
		type(e, " https://a.com ");
		expect(links(e)).toEqual([]);
	});
	it("extends an automatic link that gets a path", () => {
		const e = make();
		type(e, "https://a.com ");
		e.commands.setTextSelection(e.state.selection.from - 1);
		type(e, "/path ");
		expect(links(e)).toEqual([["https://a.com/path", "https://a.com/path"]]);
	});
	it("keeps the destination in step with an edited URL", () => {
		const e = make();
		type(e, "https://example.com ");
		e.commands.setTextSelection(12);
		type(e, "ZZ");
		const [[text, href]] = links(e);
		expect(text).toContain("ZZ");
		expect(href).toBe(text);
	});
	it("leaves a link made on purpose alone", () => {
		const e = make('<p><a href="notes.md">example.com</a></p>');
		e.commands.setTextSelection(12);
		type(e, " next");
		expect(links(e)).toEqual([["example.com", "notes.md"]]);
	});
});

describe("pasting", () => {
	it.each([
		["https://a.com", [["https://a.com", "https://a.com"]]],
		["https://x.com/__init__/a", [["https://x.com/__init__/a", "https://x.com/__init__/a"]]],
		["see example.com.", [["example.com", "https://example.com"]]],
		["[example.com](notes.md)", [["example.com", "notes.md"]]],
		["[notes.md](https://github.com/u/README.md)", [["notes.md", "https://github.com/u/README.md"]]],
		["run `curl https://a.com` then https://b.com", [["https://b.com", "https://b.com"]]],
		["open notes.md and docs/plan.md", []],
		["notes.md", []],
		["one https://a.com\n\ntwo https://b.com", [["https://a.com", "https://a.com"], ["https://b.com", "https://b.com"]]],
		["a.com a.com a.com", [["a.com", "https://a.com"], ["a.com", "https://a.com"], ["a.com", "https://a.com"]]],
	])("%j", (text, expected) => {
		const e = make();
		paste(e, text as string);
		expect(links(e)).toEqual(expected);
	});

	it("drops another app's false website link on a note name", () => {
		const e = make();
		paste(e, "notes.md", '<p><a href="http://notes.md/">notes.md</a></p>');
		expect(links(e)).toEqual([]);
	});
	it("keeps a real link from another app", () => {
		const e = make();
		paste(e, "notes.md", '<p><a href="https://github.com/u/notes.md">notes.md</a></p>');
		expect(links(e)).toEqual([["notes.md", "https://github.com/u/notes.md"]]);
	});
	it("links the selected text", () => {
		const e = make("<p>select me</p>");
		e.commands.setTextSelection({ from: 1, to: 7 });
		paste(e, "https://a.com");
		expect(links(e)).toEqual([["select", "https://a.com"]]);
	});
	it("replaces a selected address", () => {
		const e = make();
		type(e, "https://old.com ");
		e.commands.setTextSelection({ from: 1, to: 16 });
		paste(e, "https://new.com");
		expect(links(e)).toEqual([["https://new.com", "https://new.com"]]);
	});
	it("keeps a heading a heading", () => {
		const e = make("<h2>Site</h2>");
		e.commands.setTextSelection(5);
		type(e, " ");
		paste(e, "https://a.com");
		expect(e.state.doc.child(0).type.name).toBe("heading");
		expect(e.state.doc.child(0).textContent).toBe("Site https://a.com");
	});
	it("types plain text after a pasted link", () => {
		const e = make();
		paste(e, "https://a.com");
		type(e, " next");
		expect(links(e)).toEqual([["https://a.com", "https://a.com"]]);
	});
});

describe("history and saving", () => {
	it("does not link again on undo and redo", () => {
		const e = make();
		type(e, "example.com ");
		e.commands.undo();
		expect(links(e)).toEqual([]);
		e.commands.redo();
		expect(links(e)).toEqual([["example.com", "https://example.com"]]);
	});
	it("does not touch a note when loading it", () => {
		const source = "see example.com and notes.md";
		expect(markdown(make(source))).toBe(source);
	});
	it.each(["https://x.com/__init__/a", "https://en.wikipedia.org/wiki/Foo_(bar)", "example.com", "me@gmail.com", "https://a.com/?a=1&b=*2"])(
		"%s survives saving and reopening",
		(address) => {
			const e = make();
			paste(e, address);
			const reopened = make(markdown(e));
			expect(links(reopened)).toEqual(links(e));
			expect(links(e)).toHaveLength(1);
		},
	);
});
