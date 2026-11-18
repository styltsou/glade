import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Nested drag handles (list items, nested blocks) rely on a patch to
 * @tiptap/extension-drag-handle: unpatched, the handle jumps to the outermost
 * block after every document change. `bun install` applies the patch from
 * patches/; this fails loudly if it is ever missing.
 */
describe("@tiptap/extension-drag-handle patch", () => {
	for (const file of ["dist/index.js", "dist/index.cjs", "src/drag-handle-plugin.ts"]) {
		it(`keeps the nested target in ${file}`, () => {
			const source = readFileSync(`node_modules/@tiptap/extension-drag-handle/${file}`, "utf8");
			expect(source).toMatch(/nestedOptions\??\.enabled|nestedOptions == null \? void 0 : nestedOptions\.enabled/);
			expect(source).toContain("editor.state.doc.nodeAt(currentNodePos)");
		});
	}
});
