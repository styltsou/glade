import { describe, expect, it } from "vitest";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import {
	createFidelity,
	joinSource,
	serializeWithFidelity,
	splitSource,
	trailingBlankCount,
} from "./markdownFidelity";
import { appendTrailingBlanks, baselineOf, countTrailingEmpties, isEmptyParagraph } from "./trailingBlanks";



const FIXTURE = `
# Title

Intro paragraph with *emphasis* and a [ref link][r].

* star item one
* star item two

| a   | b      |
|-----|--------|
| 1   | 22     |

\`\`\`ts
const x   =   1;
\`\`\`

<div align="center">raw html</div>

[r]: https://example.com
`;

function makeEditor(content: string) {
	return new Editor({
		extensions: [
			StarterKit,
			Table,
			TableRow,
			TableHeader,
			TableCell,
			Markdown.configure({ html: true }),
		],
		content,
	});
}

function topLevel(editor: Editor): object[] {
	const nodes: object[] = [];
	editor.state.doc.forEach((n) => nodes.push(n));
	return nodes;
}

function save(editor: Editor, fidelity: NonNullable<ReturnType<typeof createFidelity>>) {
	const serializer = (editor.storage as any).markdown.serializer;
	return serializeWithFidelity(fidelity, topLevel(editor), (node) => {
		const doc = editor.schema.topNodeType.create(null, node as any);
		return serializer.serialize(doc);
	}, isEmptyParagraph);
}

describe("splitSource", () => {
	it.each([
		["empty", ""],
		["only blank lines", "\n\n"],
		["single paragraph without newline", "hello"],
		["crlf", "a\r\n\r\nb\r\n"],
		["fixture", FIXTURE],
		["trailing blanks", "a\n\n\n"],
	])("is lossless for %s", (_name, src) => {
		expect(joinSource(splitSource(src))).toBe(src);
	});

	it("keeps reference definitions in gaps", () => {
		const map = splitSource("para\n\n[r]: https://x.dev\n\nlast\n");
		expect(map.blocks).toEqual(["para", "last"]);
		expect(map.gaps[0]).toContain("[r]: https://x.dev");
	});
});

describe("serializeWithFidelity", () => {
	it("returns identical bytes when nothing changed", () => {
		const editor = makeEditor(FIXTURE);
		const fidelity = createFidelity(FIXTURE, topLevel(editor));
		expect(fidelity).not.toBeNull();
		expect(save(editor, fidelity!)).toBe(FIXTURE);
	});

	it("changes only the edited paragraph", () => {
		const editor = makeEditor(FIXTURE);
		const fidelity = createFidelity(FIXTURE, topLevel(editor))!;

		// Edit the intro paragraph (second top-level node).
		let pos = 0;
		let found = -1;
		editor.state.doc.forEach((node, offset, index) => {
			if (index === 1) {
				found = offset;
				pos = offset + node.nodeSize - 1;
			}
		});
		expect(found).toBeGreaterThan(-1);
		editor.commands.insertContentAt(pos, " More.");

		const out = save(editor, fidelity);
		const before = FIXTURE.split("\n");
		const after = out.split("\n");
		const changed = after.filter((line, i) => line !== before[i]);
		expect(changed).toHaveLength(1);
		expect(changed[0]).toContain("More.");
		// Untouched formatting survives.
		expect(out).toContain("* star item one");
		expect(out).toContain("|-----|--------|");
		expect(out).toContain("[r]: https://example.com");
	});

	it("falls back (null) when block counts do not match", () => {
		const editor = makeEditor("one\n\ntwo");
		expect(createFidelity("one", topLevel(editor))).toBeNull();
	});

	it("handles a deleted first block", () => {
		const src = "first\n\nsecond\n";
		const editor = makeEditor(src);
		const fidelity = createFidelity(src, topLevel(editor))!;
		editor.commands.deleteRange({ from: 0, to: editor.state.doc.child(0).nodeSize });
		expect(save(editor, fidelity)).toBe("second\n");
	});
});

describe("blank lines at the end of a note", () => {
	/** Load like the app does: parse, restore trailing blanks, snapshot. */
	function load(source: string) {
		const editor = makeEditor(source);
		appendTrailingBlanks(editor, source);
		const fidelity = createFidelity(source, topLevel(editor), isEmptyParagraph, baselineOf)!;
		return { editor, fidelity };
	}
	const addEmpty = (editor: Editor, n: number) => {
		for (let i = 0; i < n; i++) editor.commands.insertContentAt(editor.state.doc.content.size, { type: "paragraph" });
	};

	it("counts blank lines after the last block", () => {
		expect(trailingBlankCount("text\n")).toBe(0);
		expect(trailingBlankCount("text")).toBe(0);
		expect(trailingBlankCount("text\n\n\n\n")).toBe(3);
	});

	it("shows them as empty paragraphs and writes the same bytes back", () => {
		const source = "text\n\n\n\n";
		const { editor, fidelity } = load(source);
		expect(countTrailingEmpties(editor)).toBe(3);
		expect(save(editor, fidelity)).toBe(source);
	});

	it("saves extra Enter presses at the end", () => {
		const source = "# Title\n\ntext\n";
		const { editor, fidelity } = load(source);
		addEmpty(editor, 4);
		const saved = save(editor, fidelity);
		expect(saved).toBe("# Title\n\ntext\n\n\n\n\n");
		// ...and reloading that file shows the same four empty paragraphs.
		const reloaded = load(saved);
		expect(countTrailingEmpties(reloaded.editor)).toBe(4);
		expect(save(reloaded.editor, reloaded.fidelity)).toBe(saved);
	});

	it("removing them again restores a normal ending", () => {
		const { editor, fidelity } = load("text\n\n\n");
		expect(countTrailingEmpties(editor)).toBe(2);
		editor.commands.deleteRange({ from: editor.state.doc.child(0).nodeSize, to: editor.state.doc.content.size });
		expect(save(editor, fidelity)).toBe("text\n");
	});

	it("keeps a file without a final newline unchanged until blanks are added", () => {
		const { editor, fidelity } = load("text");
		expect(save(editor, fidelity)).toBe("text");
		addEmpty(editor, 2);
		expect(save(editor, fidelity)).toBe("text\n\n\n");
	});

	it("does not add a blank line when the last block is edited", () => {
		// The editor keeps its own empty paragraph after a final list or table;
		// that must never turn into an extra blank line in the file.
		const source = "intro\n\n* a\n* b\n";
		const { editor, fidelity } = load(source);
		expect(save(editor, fidelity)).toBe(source);
		let endOfB = -1;
		editor.state.doc.descendants((node, pos) => {
			if (node.isText && node.text === "b") endOfB = pos + 1;
		});
		editor.commands.insertContentAt(endOfB, "!");
		const saved = save(editor, fidelity);
		expect(saved.endsWith("b!\n")).toBe(true);
		expect(saved.endsWith("\n\n")).toBe(false);
	});

	it("returns the original bytes again after typing and undoing", () => {
		const { editor, fidelity } = load(FIXTURE);
		const end = editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize - 1;
		editor.commands.insertContentAt(end, "x");
		expect(save(editor, fidelity)).not.toBe(FIXTURE);
		editor.commands.undo();
		// Same text as was loaded, so the editor sees no change and nothing is saved.
		expect(save(editor, fidelity)).toBe(FIXTURE);
	});
});
