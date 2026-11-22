import { afterEach, describe, expect, it, vi } from "vitest";
import { Editor } from "@tiptap/core";
import type { Node } from "@tiptap/pm/model";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: async () => [],
	convertFileSrc: (path: string) => `glade-img://localhost/${path}`,
}));
import { extensions } from "@/components/editor/extensions";
import { serializeBlock } from "./blockSerializer";
import { createFidelity, serializeWithFidelity } from "./markdownFidelity";
import { topLevelNodes } from "./trailingBlanks";

const BLOCKS = `Plain *em* **strong** ~~gone~~ \`code\` [link](a_b.md) and 2 * 3

## Heading

- one
- two
    - nested

1. first
2. second

- [ ] open
- [x] done

> quote

| a | b |
| --- | --- |
| 1 | 2 |

| image |
| --- |
| ![shot](img.png) |

\`\`\`ts
const x = 1;
\`\`\`

\`\`\`mermaid
graph TD; A-->B
\`\`\`

---

![alone](img.png)
`;

const editors: Editor[] = [];
afterEach(() => {
	editors.splice(0).forEach((editor) => editor.destroy());
});

function makeEditor(content: string) {
	const editor = new Editor({ extensions, content });
	editors.push(editor);
	return editor;
}

const uncached = (editor: Editor, node: Node): string =>
	(editor.storage as any).markdown.serializer.serialize(editor.schema.topNodeType.create(null, node));

describe("serializeBlock", () => {
	it("writes the same markdown as a plain serialize call, first and repeated", () => {
		const editor = makeEditor(BLOCKS);
		for (const node of topLevelNodes(editor) as Node[]) {
			const expected = uncached(editor, node);
			expect(serializeBlock(editor, node)).toBe(expected);
			expect(serializeBlock(editor, node)).toBe(expected);
		}
	});

	it("follows the note's path", () => {
		const editor = makeEditor(BLOCKS);
		for (const path of ["/notes/a.md", "/other/b.md"]) {
			(editor.storage as any).paneNote.path = path;
			for (const node of topLevelNodes(editor) as Node[]) {
				expect(serializeBlock(editor, node)).toBe(uncached(editor, node));
			}
		}
	});

	it("renders only the block being typed in, however many were edited before", () => {
		const source = Array.from({ length: 60 }, (_, i) => `paragraph ${i}`).join("\n\n") + "\n";
		const editor = makeEditor(source);
		const fidelity = createFidelity(source, topLevelNodes(editor))!;
		const save = () =>
			serializeWithFidelity(fidelity, topLevelNodes(editor), (node) => serializeBlock(editor, node as Node));

		const ends: number[] = [];
		editor.state.doc.forEach((node, pos) => ends.push(pos + node.nodeSize - 1));
		const edit = editor.state.tr;
		ends.reverse().forEach((pos) => edit.insertText("!", pos));
		editor.view.dispatch(edit);
		save();

		const serializer = (editor.storage as any).markdown.serializer;
		const render = vi.spyOn(serializer, "serialize");
		const search = vi.spyOn(fidelity.originalList, "entries");
		editor.view.dispatch(editor.state.tr.insertText("x", 2));
		const out = save();

		expect(render).toHaveBeenCalledTimes(1);
		expect(search).toHaveBeenCalledTimes(1);
		expect(out).toContain("pxaragraph 0!");
		expect(out).toContain("paragraph 59!");
	});
});
