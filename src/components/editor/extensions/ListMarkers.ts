import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/** Marker styles repeat every this many levels: disc, circle, square / 1, a, i. */
export const MARKER_CYCLE = 3;

/**
 * Tags each bullet and numbered list with `data-marker-level`: its nesting among
 * lists of its own kind, modulo the cycle. CSS can only match a fixed number of
 * levels, so without this the markers stopped changing past the deepest rule.
 * Task lists in between don't count as a level.
 */
export function listMarkerDecorations(doc: PMNode): DecorationSet {
	const decorations: Decoration[] = [];
	const walk = (parent: PMNode, start: number, bullets: number, numbers: number) => {
		parent.forEach((node, offset) => {
			if (node.isTextblock || node.childCount === 0) return;
			const pos = start + offset;
			let b = bullets;
			let n = numbers;
			if (node.type.name === "bulletList" || node.type.name === "orderedList") {
				const level = node.type.name === "bulletList" ? b++ : n++;
				decorations.push(
					Decoration.node(pos, pos + node.nodeSize, {
						"data-marker-level": String(level % MARKER_CYCLE),
					}),
				);
			}
			walk(node, pos + 1, b, n);
		});
	};
	walk(doc, 0, 0, 0);
	return DecorationSet.create(doc, decorations);
}

const key = new PluginKey<DecorationSet>("listMarkers");

export const ListMarkers = Extension.create({
	name: "listMarkers",

	addProseMirrorPlugins() {
		return [
			new Plugin({
				key,
				state: {
					init: (_, state) => listMarkerDecorations(state.doc),
					apply: (tr, set) => (tr.docChanged ? listMarkerDecorations(tr.doc) : set),
				},
				props: {
					decorations: (state) => key.getState(state),
				},
			}),
		];
	},
});
