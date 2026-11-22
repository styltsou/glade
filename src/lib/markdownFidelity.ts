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
 * Not all source is shown: link reference definitions, comments and lone HTML
 * tags have no node. That text lives in the gaps between blocks, and is never
 * dropped because a block next to it was edited, and keeps its order when
 * blocks move, so an opening tag stays ahead of its closing one.
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
	// Only what follows the last text, which may be a reference definition.
	const blankTail = /\s*$/.exec(map.trailing)![0];
	return Math.max(0, (blankTail.match(/\n/g)?.length ?? 0) - 1);
}

export interface Fidelity {
	source: SourceMap;
	/** Blank lines at the end of the file as loaded. */
	extraTrailing: number;
	/**
	 * Empty paragraphs the editor itself keeps at the end for a given set of
	 * content nodes (e.g. after a final list or table). They are not blank lines
	 * in the file.
	 */
	baselineOf: (contentNodes: object[]) => number;
	/** Top-level nodes as they were right after the source was loaded. */
	originals: Map<object, number>;
	/** The same nodes in document order (for structural comparison). */
	originalList: object[];
	/** For each original node, the block it came from. */
	blockOf: number[];
	/** For each block, its first node and how many it became. */
	spans: Array<{ first: number; count: number }>;
	/** For each block, the tags in it whose partner is in another block. */
	wrappers: Array<{ open: string; close: string }>;
}

/** A run of consecutive source blocks and how many nodes they became between them. */
export interface Region {
	blocks: number;
	count: number;
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
			const [first, next] = token.map;
			let end = Math.min(next, lines.length);
			// A list's range runs on over the blank lines after it. They are the
			// gap to the next block, or editing that block adds another one.
			if (token.type.endsWith("_list_open")) {
				while (end > first + 1 && !lines[end - 1].trim()) end--;
			}
			ranges.push([first, end]);
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
	baselineOf: (contentNodes: object[]) => number = () => 0,
	layout?: Region[],
): Fidelity | null {
	const all = splitSource(source);
	const { core, empties } = splitTrailingEmpties(topLevelNodes, isEmpty);
	const regions = layout ?? all.blocks.map(() => ({ blocks: 1, count: 1 }));
	if (regions.reduce((sum, region) => sum + region.count, 0) !== core.length) return null;
	if (regions.reduce((sum, region) => sum + region.blocks, 0) !== all.blocks.length) return null;

	// What has no node joins the gap it sits in. Blocks that can't be told
	// apart are one block.
	const map: SourceMap = { leading: "", blocks: [], gaps: [], trailing: "" };
	const spans: Fidelity["spans"] = [];
	const wrappers: Fidelity["wrappers"] = [];
	const blockOf: number[] = [];
	let between = all.leading;
	let at = 0;
	for (const { blocks, count } of regions) {
		if (at > 0) between += all.gaps[at - 1];
		const parts = all.blocks.slice(at, at + blocks);
		let text = parts[0];
		for (let i = 1; i < blocks; i++) text += all.gaps[at + i - 1] + parts[i];
		at += blocks;
		if (count === 0) {
			between += text;
			continue;
		}
		if (map.blocks.length === 0) map.leading = between;
		else map.gaps.push(between);
		between = "";
		spans.push({ first: blockOf.length, count });
		for (let n = 0; n < count; n++) blockOf.push(map.blocks.length);
		map.blocks.push(text);
		wrappers.push(unpairedTags(parts));
	}
	if (map.blocks.length === 0) map.leading = between + all.trailing;
	else map.trailing = between + all.trailing;

	const originals = new Map<object, number>();
	core.forEach((n, i) => originals.set(n, i));
	// Distinct nodes required; shared instances would make the mapping ambiguous.
	if (originals.size !== core.length) return null;
	return {
		source: map,
		originals,
		originalList: core,
		blockOf,
		spans,
		wrappers,
		extraTrailing: Math.max(0, empties - baselineOf(core)),
		baselineOf,
	};
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
	const eol = [source.leading, ...source.blocks, ...source.gaps, source.trailing]
		.some((text) => text.includes("\r\n")) ? "\r\n" : "\n";
	const { core: nodes, empties: rawEmpties } = splitTrailingEmpties(allNodes, isEmpty);
	const empties = Math.max(0, rawEmpties - fidelity.baselineOf(nodes));

	// A node counts as untouched if it is the same object, or structurally equal
	// to an original (undoing an edit rebuilds the node as an equal copy).
	const same = (a: any, b: any) => typeof a?.eq === "function" && a.eq(b);
	const idx: Array<number | undefined> = new Array(nodes.length).fill(undefined);
	// Each original stands for one node, or a new empty paragraph would copy the
	// source, anchors and all, of one that is already there.
	const used = new Set<number>();
	nodes.forEach((node, k) => {
		const direct = originals.get(node);
		if (direct === undefined || used.has(direct)) return;
		idx[k] = direct;
		used.add(direct);
	});
	nodes.forEach((node, k) => {
		if (idx[k] !== undefined) return;
		const prev = k === 0 ? -1 : idx[k - 1];
		const expected = prev !== undefined ? prev + 1 : undefined;
		let match: number | undefined;
		if (expected !== undefined && !used.has(expected) && same(originalList[expected], node)) match = expected;
		else {
			const found = originalList.findIndex((o, i) => !used.has(i) && same(o, node));
			if (found !== -1) match = found;
		}
		if (match === undefined) return;
		idx[k] = match;
		used.add(match);
	});
	const units = toUnits(fidelity, nodes, idx);
	const lastBlock = source.blocks.length - 1;

	if (units.length === 0) {
		// Nothing to show, like a file with only a comment; or the note was cleared.
		if (originalList.length === 0 && empties === fidelity.extraTrailing) return source.leading;
		return "";
	}

	// Text that isn't shown keeps its order: it is placed among the blocks that
	// didn't move, and not carried along by those that did.
	const steady = steadyUnits(units);
	const movable = (gap: string, ...around: number[]) => !gap.trim() || around.every((u) => steady.has(u));

	// separators[u] comes before units[u]; the last one ends the file.
	const separators: Array<string | undefined> = new Array(units.length + 1);
	const kept = new Map<number, number>(); // gaps written exactly, and where; -1 is the leading one
	if (units[0].place === 0 && movable(source.leading, 0)) {
		separators[0] = source.leading;
		kept.set(-1, 0);
	}
	for (let u = 1; u < units.length; u++) {
		const prev = units[u - 1].place;
		if (prev === undefined || units[u].place !== prev + 1 || kept.has(prev)) continue;
		if (!movable(source.gaps[prev], u - 1, u)) continue;
		separators[u] = source.gaps[prev];
		kept.set(prev, u);
	}
	const last = units.length - 1;
	if (lastBlock >= 0 && units[last].place === lastBlock && movable(source.trailing, last)) {
		if (empties === fidelity.extraTrailing) {
			separators[units.length] = source.trailing; // nothing changed at the end: keep it byte for byte
			kept.set(lastBlock, units.length);
		} else if (source.trailing.trim()) {
			separators[units.length] = source.trailing.replace(/\s+$/, "") + eol.repeat(empties + 1);
			kept.set(lastBlock, units.length);
		}
	}

	// What has to be written again at a place: text from gaps that no longer
	// exist, and tags of rewritten blocks whose partner is in another block.
	const above = Array.from({ length: units.length + 1 }, (): string[] => []);
	const below = Array.from({ length: units.length + 1 }, (): string[] => []);
	const copied = new Set(units.map((unit) => unit.block));
	const gaps = [source.leading, ...source.gaps, source.trailing];
	// With no blocks there is only the leading text.
	for (let gap = -1; gap <= lastBlock; gap++) {
		const exact = kept.get(gap);
		let slot = exact;
		if (slot === undefined) {
			const next = units.findIndex((unit, u) => steady.has(u) && unit.place! > gap);
			slot = next === -1 ? units.length : next;
		}
		if (gap >= 0 && !copied.has(gap) && fidelity.wrappers[gap].close) above[slot].push(fidelity.wrappers[gap].close);
		const text = gaps[gap + 1];
		if (exact === undefined && text.trim()) above[slot].push(trimBlankLines(text));
		const opens = gap < lastBlock && !copied.has(gap + 1) ? fidelity.wrappers[gap + 1].open : "";
		// After a gap written exactly, so the order in the source holds.
		if (opens) (exact === undefined ? above : below)[slot].push(opens);
	}

	const blank = eol + eol;
	const separator = (at: number): string => {
		const isStart = at === 0;
		const isEnd = at === units.length;
		const exact = separators[at];
		if (above[at].length === 0 && below[at].length === 0) {
			return exact ?? (isStart ? "" : isEnd ? eol.repeat(empties + 1) : blank);
		}
		const parts = [...above[at]];
		if (exact?.trim()) parts.push(trimBlankLines(exact));
		parts.push(...below[at]);
		const end = !isEnd ? blank : exact !== undefined ? /\s*$/.exec(exact)![0] || eol : eol.repeat(empties + 1);
		return (isStart ? "" : blank) + parts.join(blank) + end;
	};

	const texts = units.map((unit) => (unit.block !== undefined ? source.blocks[unit.block] : serializeNode(unit.node)));
	/** The separator, with blank lines added where the text each side would run into it. */
	const safeSeparator = (at: number): string => {
		const between = separator(at);
		const before = at > 0 ? units[at - 1] : undefined;
		const after = at < units.length ? units[at] : undefined;
		const untouched =
			separators[at] !== undefined &&
			above[at].length === 0 &&
			below[at].length === 0 &&
			(!before || before.block !== undefined) &&
			(!after || after.block !== undefined);
		return untouched ? between : keepApart(before ? texts[at - 1] : "", between, after ? texts[at] : "", eol);
	};

	let out = "";
	texts.forEach((text, u) => {
		out += safeSeparator(u) + text;
	});
	out += safeSeparator(units.length);
	return out;
}

/**
 * `between`, unless the text before or after it would then read differently.
 * One line break isn't always a boundary: a heading turned into a paragraph
 * takes in the line below it, and text under a lone tag becomes raw HTML.
 */
function keepApart(before: string, between: string, after: string, eol: string): string {
	const hidden = between.trim();
	if (!hidden && (!before || !after)) return between;
	const openAbove = !before || /^[ \t]*\r?\n[ \t]*\r?\n/.test(between);
	const openBelow = !after || /\n[ \t]*\r?\n$/.test(between);
	if (openAbove && openBelow) return between;

	const first = splitSource(before).blocks;
	const last = splitSource(after).blocks;
	const joined = splitSource(before + between + after).blocks;
	const offset = joined.length - last.length;
	const separate =
		offset >= first.length &&
		first.every((block, i) => joined[i] === block) &&
		last.every((block, i) => joined[offset + i] === block);
	if (separate) return between;

	const blank = eol + eol;
	const body = trimBlankLines(between);
	if (!body) return blank;
	const end = after ? blank : /\s*$/.exec(between)![0];
	return (before ? blank : "") + body + end;
}

const trimBlankLines = (text: string) => text.replace(/^(?:[ \t]*\r?\n)+|\s+$/g, "");

/**
 * Elements the editor looks through: it shows what is in them and has no node
 * for the element, so their tags exist only in the source.
 */
const SEEN_THROUGH = new Set(
	"address article aside center dd details div dl dt figcaption figure footer header main nav picture section summary".split(" "),
);

/** The tags in a block that open or close elements reaching into other blocks. */
function unpairedTags(parts: string[]): { open: string; close: string } {
	const open: Array<{ name: string; tag: string }> = [];
	const close: string[] = [];
	for (const part of parts) {
		// Only HTML blocks: elsewhere a tag may be code, or text.
		if (!/^ {0,3}</.test(part)) continue;
		const html = part.replace(/<!--[\s\S]*?(?:-->|$)/g, "");
		for (const [tag, slash, rawName] of html.matchAll(/<(\/?)([a-z][a-z\d-]*)(?:\s(?:"[^"]*"|'[^']*'|[^'">])*)?\/?>/gi)) {
			const name = rawName.toLowerCase();
			if (!SEEN_THROUGH.has(name) || tag.endsWith("/>")) continue;
			if (!slash) open.push({ name, tag });
			else {
				const partner = open.map((o) => o.name).lastIndexOf(name);
				if (partner === -1) close.push(tag);
				else open.splice(partner);
			}
		}
	}
	return { open: open.map((o) => o.tag).join("\n"), close: close.join("\n") };
}

/** The units still in their original order: the longest rising run of places. */
function steadyUnits(units: Unit[]): Set<number> {
	const ends: number[] = []; // ends[n]: the unit ending the best run of n + 1
	const before = new Map<number, number>();
	units.forEach(({ place }, u) => {
		if (place === undefined) return;
		let lo = 0;
		let hi = ends.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (units[ends[mid]].place! < place) lo = mid + 1;
			else hi = mid;
		}
		if (lo > 0) before.set(u, ends[lo - 1]);
		ends[lo] = u;
	});
	const steady = new Set<number>();
	for (let u: number | undefined = ends[ends.length - 1]; u !== undefined; u = before.get(u)) steady.add(u);
	return steady;
}

interface Unit {
	node: object;
	/** The block to copy, when all of it is untouched. */
	block?: number;
	/** The block this stands where, untouched or edited in place. */
	place?: number;
}

/** The document as untouched blocks and nodes to serialize, in order. */
function toUnits(fidelity: Fidelity, nodes: object[], idx: Array<number | undefined>): Unit[] {
	const { blockOf, spans } = fidelity;
	const units: Unit[] = [];
	for (let k = 0; k < nodes.length; ) {
		const original = idx[k];
		const block = original === undefined ? undefined : blockOf[original];
		if (block !== undefined) {
			const { first, count } = spans[block];
			let n = 0;
			while (n < count && idx[k + n] === first + n) n++;
			if (n === count) {
				units.push({ node: nodes[k], block, place: block });
				k += count;
				continue;
			}
		}
		units.push({ node: nodes[k] });
		k++;
	}

	// As many changed nodes as blocks missing between two untouched neighbours:
	// those blocks were edited in place, and the gaps around them still apply.
	for (let from = 0; from < units.length; from++) {
		if (units[from].block !== undefined) continue;
		let to = from;
		while (to < units.length && units[to].block === undefined) to++;
		const before = from > 0 ? units[from - 1].place! : -1;
		const after = to < units.length ? units[to].place! : spans.length;
		if (after - before - 1 === to - from) {
			for (let u = from; u < to; u++) units[u].place = before + 1 + u - from;
		}
		from = to;
	}
	return units;
}
