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
} from "./markdownFidelity";

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
	});
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
