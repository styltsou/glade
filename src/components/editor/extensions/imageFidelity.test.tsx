import { act } from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "@tiptap/core";
import { DOMParser as NodeParser } from "@tiptap/pm/model";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => []), convertFileSrc: (path: string) => path }));

import { extensions } from "../extensions";
import { useMarkdownFidelity } from "@/hooks/useMarkdownFidelity";
import { splitNoteTitle } from "@/lib/noteTitle";

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).reverse().forEach((fn) => fn()));

function load(source: string) {
	(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
	let fidelity!: ReturnType<typeof useMarkdownFidelity>;
	const Harness = () => {
		fidelity = useMarkdownFidelity();
		return null;
	};
	const root = createRoot(document.createElement("div"));
	act(() => root.render(<Harness />));
	cleanup.push(() => act(() => root.unmount()));
	const editor = new Editor({ element: document.createElement("div"), extensions, content: splitNoteTitle(source).body });
	cleanup.push(() => editor.destroy());
	fidelity.snapshot(editor, source);

	/** Position just after `text`. */
	const after = (text: string) => {
		let at = -1;
		editor.state.doc.descendants((node, pos) => {
			if (node.isText && node.text!.includes(text)) at = pos + node.text!.indexOf(text) + text.length;
		});
		if (at < 0) throw new Error(`no "${text}" in the document`);
		return at;
	};
	const blockWith = (text: string) => {
		const $at = editor.state.doc.resolve(after(text));
		return { from: $at.before(1), to: $at.after(1) };
	};
	return {
		editor,
		after,
		blockWith,
		type: (after_: string, text: string) => editor.commands.insertContentAt(after(after_), text),
		save: () => fidelity.getMarkdown(editor),
	};
}

describe("editing another block leaves these byte for byte", () => {
	it.each([
		["an image in a sentence", "before ![a](x.png) after"],
		["images on consecutive lines", "![a](x.png)\n![b](y.png)"],
		["a linked badge", "[![badge](b.svg)](https://x.com)"],
		["an image in a list", "- ![a](x.png)\n- two"],
		["an image in a table", "| h | i |\n|---|---|\n| ![a](x.png) | t |"],
		["an image in a heading", "## ![logo](l.png) Name"],
		["a sized HTML image", '<p align="center"><img src="x.png" width="120"></p>'],
		["HTML that becomes several blocks", "<p>one</p>\n<p>two</p>"],
		["a data image", "![d](data:image/png;base64,iVBORw0KGgo=)"],
		["an image before a hard break", "![a](x.png)  \nnext"],
		["a comment", "<!-- keep me -->"],
		["a lone tag", "<br>"],
		["a list", "- item\n- two"],
		["a reference definition", "[ref]: https://x.com"],
	])("%s", (_name, block) => {
		for (const [source, edited] of [
			[`${block}\n\nlast\n`, `${block}\n\nlast edited\n`],
			[`first\n\n${block}\n\nlast\n`, `first\n\n${block}\n\nlast edited\n`],
			[`last\n\n${block}\n`, `last edited\n\n${block}\n`],
			[`# Title\n\n${block}\n\nlast\n`, `# Title\n\n${block}\n\nlast edited\n`],
			[`${block}\n\n# Title\n\nlast\n`, `${block}\n\n# Title\n\nlast edited\n`],
			[`last\r\n\r\n${block.replace(/\n/g, "\r\n")}\r\n`, `last edited\r\n\r\n${block.replace(/\n/g, "\r\n")}\r\n`],
		]) {
			const note = load(source);
			expect(note.save()).toBe(source);
			note.type("last", " edited");
			expect(note.save()).toBe(edited);
		}
	});
});

describe("editing the block that holds an image", () => {
	it.each([
		["a sentence", "before ![a](x.png) after", "before ![a](x.png) after!"],
		["two lines", "![a](x.png)\n![b](y.png) after", "![a](x.png) ![b](y.png) after!"],
		["a linked image", "[![a](x.svg)](https://x.com) after", "[![a](x.svg)](https://x.com) after!"],
		["a list", "- ![a](x.png) after\n- two", "- ![a](x.png) after!\n- two"],
		["a table", "| h | after |\n| --- | --- |\n| ![a](x.png) | t |", "| h | after! |\n| --- | --- |\n| ![a](x.png) | t |"],
		["a table with an empty cell", "| after | i |\n| --- | --- |\n|  | t |", "| after! | i |\n| --- | --- |\n|  | t |"],
		["a heading", "## ![logo](l.png) after", "## ![logo](l.png) after!"],
		["a sized image", '<span><img src="x.png" width="20"></span> after', '<img src="x.png" width="20"> after!'],
		["a data image", "![d](data:image/png;base64,iVBORw0KGgo=) after", "![d](data:image/png;base64,iVBORw0KGgo=) after!"],
		["bold", "**![a](x.png)** after", "**![a](x.png)** after!"],
		["an HTML src with a space", '<span><img src="my pic.png"></span> after', "![](my%20pic.png) after!"],
	])("%s", (_name, source, edited) => {
		const note = load(`${source}\n`);
		note.type("after", "!");
		const saved = note.save();
		expect(saved).toBe(`${edited}\n`);
		expect(load(saved).save()).toBe(saved);
	});

	it("keeps the space of a line break after a link, bold or an image", () => {
		const note = load("see [link](x.md)\nnext **bold**\nand ![a](x.png)\nend\n");
		note.type("end", "!");
		expect(note.save()).toBe("see [link](x.md) next **bold** and ![a](x.png) end!\n");
	});
});

describe("source the editor doesn't show", () => {
	const source = "# Title\n\none\n\n<!-- note -->\n\ntwo [r][r]\n\n[r]: https://x.com\n\nthree\n";
	const expectKept = (saved: string) => {
		expect(saved.split("<!-- note -->")).toHaveLength(2);
		expect(saved.split("[r]: https://x.com")).toHaveLength(2);
	};

	it("survives edits on both sides of it, in place", () => {
		const note = load(source);
		note.type("one", "!");
		note.type("three", "!");
		expect(note.save()).toBe(source.replace("one", "one!").replace("three", "three!"));
	});

	it("survives a new block beside it", () => {
		const note = load(source);
		note.editor.commands.insertContentAt(note.blockWith("one").to, { type: "paragraph", content: [{ type: "text", text: "new" }] });
		const saved = note.save();
		expect(saved).toContain("new");
		expectKept(saved);
	});

	it.each(["one", "two", "three"])("survives deleting the block %j", (text) => {
		const note = load(source);
		note.editor.commands.deleteRange(note.blockWith(text));
		expectKept(note.save());
	});

	it("survives splitting the last block", () => {
		const note = load("last\n\n[r]: https://x.com\n");
		note.editor.chain().setTextSelection(note.after("la")).splitBlock().run();
		expect(note.save()).toBe("la\n\nst\n\n[r]: https://x.com\n");
	});

	it("doesn't turn definitions at the end into empty paragraphs", () => {
		const text = "text [a][a]\n\n[a]: https://a.com\n[b]: https://b.com\n[c]: https://c.com\n";
		expect(load(text).editor.state.doc.childCount).toBe(1);
	});

	it("leaves a file holding only a comment alone", () => {
		expect(load("<!-- only -->\n").save()).toBe("<!-- only -->\n");
	});
});

describe("a block that changes type one line from its neighbour", () => {
	it.each([
		["## head\ntext\n", "head", "setParagraph", "head\n\ntext"],
		["intro\n## head\n", "head", "setParagraph", "intro\n\nhead"],
		["para\n- item\n", "item", "liftItem", "para\n\nitem"],
		["intro\n> quoted\n", "quoted", "unquote", "intro\n\nquoted"],
		["```\ncode\n```\ntext\n", "code", "setParagraph", "code\n\ntext"],
		["## head\n[r]: https://x.com\n\nuse [r][r]\n", "head", "setParagraph", "head\n\n[r]: https://x.com"],
	])("doesn't merge into it: %j", (source, text, action, expected) => {
		const note = load(source);
		const chain = note.editor.chain().setTextSelection(note.after(text));
		if (action === "setParagraph") chain.setParagraph().run();
		else if (action === "liftItem") chain.liftListItem("listItem").run();
		else chain.lift("blockquote").run();
		expect(note.save()).toContain(expected);
	});

	it("keeps the single line break when it still separates", () => {
		const note = load("## head\ntext\n");
		note.type("head", "!");
		expect(note.save()).toBe("## head!\ntext\n");
	});
});

describe("HTML that spans blocks", () => {
	it.each([
		["a div", '<div align="center">\n\nlast\n\n</div>\n'],
		["details", "<details>\n<summary>More</summary>\n\nlast\n\n</details>\n"],
		["a title in a div", '<div align="center">\n\n# Title\n\n</div>\n\nlast\n'],
		["a table around markdown", "<table><tr><td>\n\n**cell**\n\n</td></tr></table>\n\nlast\n"],
		["a quote around markdown", "<blockquote>\n\nquoted\n\n</blockquote>\n\nlast\n"],
		["inline HTML blocks that join", '<img src="a.png">\n\n<img src="b.png">\n\nlast\n'],
	])("%s changes only where it was edited", (_name, source) => {
		const note = load(source);
		expect(note.save()).toBe(source);
		note.type("last", " edited");
		expect(note.save()).toBe(source.replace("last", "last edited"));
	});

	it("keeps the opening tag of a block that is rewritten", () => {
		const note = load("<details>\n<summary>More</summary>\n\ninside\n\n</details>\n");
		note.type("More", "!");
		expect(note.save()).toBe("<details>\n\nMore!\n\ninside\n\n</details>\n");
	});
});

describe("a title below other blocks", () => {
	const source = "![logo](l.png)\n\nabove\n\n# Title\n\nbelow\n\nend\n";

	it.each([["above"], ["below"], ["above", "below"]])("stays put when its neighbours are edited (%s %s)", (...texts) => {
		const note = load(source);
		let expected = source;
		for (const text of texts) {
			note.type(text, "!");
			expected = expected.replace(text, `${text}!`);
		}
		expect(note.save()).toBe(expected);
	});
});

describe("images in the editor", () => {
	it("mark paragraphs of only images, not images in a sentence", () => {
		const { editor } = load("![a](x.png) ![b](y.png)\n\ntext ![c](z.png)\n");
		expect(editor.view.dom.querySelectorAll("p.image-paragraph")).toHaveLength(1);
	});

	it("leave a linked image's click to the link, so the webview can't navigate", () => {
		const { editor } = load("[![badge](b.svg)](https://x.com)\n");
		const event = new MouseEvent("click", { bubbles: true, cancelable: true });
		editor.view.dom.querySelector("a img")!.dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});

	it("don't let pasted HTML bring data images in", () => {
		// What ProseMirror's HTML paste runs; markdown parsing is not involved.
		const html = document.createElement("div");
		html.innerHTML = '<p>text<img src="data:image/png;base64,AAAA"></p>';
		const pasted = NodeParser.fromSchema(load("text\n").editor.schema).parse(html);
		expect(pasted.toString()).not.toContain("image");
	});
});
