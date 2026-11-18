import MarkdownIt from "markdown-it";

/**
 * Source-preserving markdown saves.
 *
 * The rich editor re-serializes the whole document, which rewrites formatting
 * the user never touched (list markers, table alignment, escaping...). This
 * module remembers the original text of each top-level block so unchanged
 * blocks are written back byte-for-byte, and only edited blocks are
 * re-serialized.
 *
 * Identity of "unchanged" relies on ProseMirror structural sharing: top-level
 * nodes the user did not touch are the same object in later document versions.
 */

export interface SourceMap {
	/** Text before the first block (usually blank lines). */
	leading: string;
	/** Source text of each top-level block, without its trailing line break. */
	blocks: string[];
	/** gaps[i] is the text between blocks[i] and blocks[i + 1]. */
	gaps: string[];
	/** Text after the last block. */
	trailing: string;
}

/**
 * Blank lines after the last block, beyond the single line break that ends the
 * file. The editor shows each as an empty paragraph, so pressing Enter several
 * times at the end of a note survives a save and reload.
 */
export function trailingBlankCount(source: string): number {
	const map = splitSource(source);
	if (map.blocks.length === 0) return 0;
	return Math.max(0, (map.trailing.match(/\n/g)?.length ?? 0) - 1);
}

export interface Fidelity {
	source: SourceMap;
	/** Empty paragraphs at the end of the document as loaded. */
	extraTrailing: number;
	/** Top-level nodes as they were right after the source was loaded. */
	originals: Map<object, number>;
	/** The same nodes in document order (for structural comparison). */
	originalList: object[];
}

const md = new MarkdownIt({ html: true });

/** Split markdown into top-level block source slices. Lossless by construction. */
export function splitSource(source: string): SourceMap {
	// Split into lines, keeping each line's own line ending.
	const lines = source.match(/[^\n]*\n|[^\n]+$/g) ?? [];
	const offsets: number[] = [0];
	for (const line of lines) offsets.push(offsets[offsets.length - 1] + line.length);

	const ranges: Array<[number, number]> = [];
	for (const token of md.parse(source, {})) {
		if (token.level === 0 && token.map && token.nesting !== -1) {
			ranges.push([token.map[0], token.map[1]]);
		}
	}

	if (ranges.length === 0) {
		return { leading: source, blocks: [], gaps: [], trailing: "" };
	}

	const startOf = (r: [number, number]) => offsets[r[0]];
	// End of block content: end of its last line, minus the line break.
	const endOf = (r: [number, number]) => {
		let end = offsets[Math.min(r[1], lines.length)];
		if (source[end - 1] === "\n") end -= 1;
		if (source[end - 1] === "\r") end -= 1;
		return end;
	};

	const blocks: string[] = [];
	const gaps: string[] = [];
	ranges.forEach((r, i) => {
		blocks.push(source.slice(startOf(r), endOf(r)));
		if (i > 0) gaps.push(source.slice(endOf(ranges[i - 1]), startOf(r)));
	});

	return {
		leading: source.slice(0, startOf(ranges[0])),
		blocks,
		gaps,
		trailing: source.slice(endOf(ranges[ranges.length - 1])),
	};
}

/** Reassemble a SourceMap into text. `join(splitSource(s)) === s` always. */
export function joinSource(map: SourceMap): string {
	let out = map.leading;
	map.blocks.forEach((b, i) => {
		out += b;
		if (i < map.gaps.length) out += map.gaps[i];
	});
	return out + map.trailing;
}

/**
 * Build fidelity state for freshly loaded content. Returns null when the
 * source's top-level blocks do not line up with the editor's top-level nodes,
 * in which case callers fall back to plain serialization.
 */
export function createFidelity(
	source: string,
	topLevelNodes: object[],
	isEmpty: (node: object) => boolean = () => false,
): Fidelity | null {
	const map = splitSource(source);
	const { core, empties } = splitTrailingEmpties(topLevelNodes, isEmpty);
	if (map.blocks.length !== core.length) return null;
	const originals = new Map<object, number>();
	core.forEach((n, i) => originals.set(n, i));
	// Distinct nodes required; shared instances would make the mapping ambiguous.
	if (originals.size !== core.length) return null;
	return { source: map, originals, originalList: core, extraTrailing: empties };
}

/** Separate the nodes that carry content from empty paragraphs at the end. */
export function splitTrailingEmpties(nodes: object[], isEmpty: (node: object) => boolean) {
	let end = nodes.length;
	while (end > 0 && isEmpty(nodes[end - 1])) end--;
	return { core: nodes.slice(0, end), empties: nodes.length - end };
}

/**
 * Serialize the current document, reusing original text for untouched blocks.
 * `serializeNode` renders a single top-level node the normal way.
 */
export function serializeWithFidelity(
	fidelity: Fidelity,
	allNodes: object[],
	serializeNode: (node: object) => string,
	isEmpty: (node: object) => boolean = () => false,
): string {
	const { source, originals, originalList } = fidelity;
	const { core: nodes, empties } = splitTrailingEmpties(allNodes, isEmpty);

	// A node counts as untouched if it is the same object, or structurally equal
	// to an original (undoing an edit rebuilds the node as an equal copy).
	const same = (a: any, b: any) => typeof a?.eq === "function" && a.eq(b);
	const idx: Array<number | undefined> = [];
	nodes.forEach((node, k) => {
		const direct = originals.get(node);
		if (direct !== undefined) return idx.push(direct);
		const expected = k === 0 ? 0 : idx[k - 1] !== undefined ? idx[k - 1]! + 1 : undefined;
		if (expected !== undefined && same(originalList[expected], node)) return idx.push(expected);
		const found = originalList.findIndex((o) => same(o, node));
		idx.push(found === -1 ? undefined : found);
	});
	let out = "";

	nodes.forEach((node, k) => {
		const j = idx[k];
		if (k === 0) {
			out += j === 0 ? source.leading : "";
		} else {
			const prev = idx[k - 1];
			out += prev !== undefined && j !== undefined && j === prev + 1 ? source.gaps[prev] : "\n\n";
		}
		out += j !== undefined ? source.blocks[j] : serializeNode(node);
	});

	const last = idx[idx.length - 1];
	if (nodes.length > 0) {
		const endsAtOriginalEnd = last !== undefined && last === source.blocks.length - 1;
		if (endsAtOriginalEnd && empties === fidelity.extraTrailing) {
			out += source.trailing; // nothing changed at the end: keep it byte for byte
		} else {
			const eol = source.trailing.includes("\r\n") ? "\r\n" : "\n";
			out += eol.repeat(empties + 1);
		}
	}
	return out;
}
