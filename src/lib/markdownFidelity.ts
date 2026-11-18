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

export interface Fidelity {
	source: SourceMap;
	/** Top-level nodes as they were right after the source was loaded. */
	originals: Map<object, number>;
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
export function createFidelity(source: string, topLevelNodes: object[]): Fidelity | null {
	const map = splitSource(source);
	if (map.blocks.length !== topLevelNodes.length) return null;
	const originals = new Map<object, number>();
	topLevelNodes.forEach((n, i) => originals.set(n, i));
	// Distinct nodes required; shared instances would make the mapping ambiguous.
	if (originals.size !== topLevelNodes.length) return null;
	return { source: map, originals };
}

/**
 * Serialize the current document, reusing original text for untouched blocks.
 * `serializeNode` renders a single top-level node the normal way.
 */
export function serializeWithFidelity(
	fidelity: Fidelity,
	nodes: object[],
	serializeNode: (node: object) => string,
): string {
	const { source, originals } = fidelity;
	const idx = nodes.map((n) => originals.get(n));
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
		out += last !== undefined && last === source.blocks.length - 1 ? source.trailing : "\n";
	}
	return out;
}
