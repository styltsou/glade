import { elementFromString, type Editor } from "@tiptap/core";
import { DOMParser as NodeParser, type Node as PMNode } from "@tiptap/pm/model";
import type MarkdownIt from "markdown-it";
import type { NoteTitle } from "@/lib/noteTitle";
import { splitSource, type Region } from "@/lib/markdownFidelity";
import { isEmptyParagraph } from "@/lib/trailingBlanks";
import { blockNodeCounts } from "@/lib/blockNodeCounts";

/*
 * Which editor nodes each block of markdown became.
 *
 * Nearly always one each. HTML breaks that: a block can be none (a comment, a
 * lone tag), several, or part of an element that runs on through the blocks
 * after it. Parsing blocks one by one can't tell, so the note is parsed whole
 * with a comment before each block, and the parser reports where each landed.
 * Where that falls between two top-level nodes, the source can be cut there;
 * blocks with no cut between them are kept or rewritten together.
 */

/** Tags that end a paragraph, so can split one block into several nodes. */
const BLOCK_TAG =
	/<\/?(?:address|article|aside|blockquote|center|dd|details|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|summary|table|td|th|tr|ul)(?=[\s/>]|$)/i;

/** Whether a block may become other than one node. Parsing for those is slow in a big note. */
function mayNotBeOne(block: string): boolean {
	if (/^ {0,3}(```|~~~)/.test(block)) return false;
	return /^ {0,3}</.test(block) || BLOCK_TAG.test(block);
}

const MARKER = /^glade-block:(\d+)$/;
const installed = new WeakSet<MarkdownIt>();
let marking = false;

/** While `marking`, put a comment before each top-level block. */
function installMarkers(md: MarkdownIt) {
	if (installed.has(md)) return;
	installed.add(md);
	md.core.ruler.push("glade_block_markers", (state) => {
		if (!marking) return;
		let block = 0;
		// The same blocks as splitSource.
		state.tokens = state.tokens.flatMap((token) => {
			if (token.level !== 0 || !token.map || token.nesting === -1) return [token];
			const marker = new state.Token("html_block", "", 0);
			marker.content = `<!--glade-block:${block++}-->`;
			return [marker, token];
		});
	});
}

/**
 * `cuts[i]` is the node index where block i starts, or null when it starts
 * inside a node. Null when the marked parse isn't the document in the editor.
 */
function findCuts(editor: Editor, body: string, blocks: number, nodes: PMNode[]): (number | null)[] | null {
	const { parser } = (editor.storage as any).markdown;
	installMarkers(parser.md);
	let html: string;
	marking = true;
	try {
		html = parser.parse(body);
	} finally {
		marking = false;
	}
	// As setContent does it. An inert document: nothing in it loads or runs.
	const root = elementFromString(html);

	const found: { block: number; node: Node; offset: number; pos?: number }[] = [];
	const walk = (parent: Node) => {
		parent.childNodes.forEach((child, offset) => {
			const marker = child.nodeType === Node.COMMENT_NODE ? MARKER.exec(child.nodeValue ?? "") : null;
			if (marker) found.push({ block: Number(marker[1]), node: parent, offset });
			else walk(child);
		});
	};
	walk(root);

	const { schema } = editor;
	const doc = NodeParser.fromSchema(schema).parse(root, { findPositions: found });
	// The editor may tidy what it loads (tables, say), so compare what matters here.
	if (doc.childCount < nodes.length) return null;
	for (let i = 0; i < nodes.length; i++) {
		const parsed = doc.child(i);
		if (parsed.type !== nodes[i].type) return null;
		if (parsed.textContent.replace(/\s+/g, "") !== nodes[i].textContent.replace(/\s+/g, "")) return null;
	}
	for (let i = nodes.length; i < doc.childCount; i++) if (!isEmptyParagraph(doc.child(i))) return null;

	// Inside an element that becomes a node or a mark, the source can't be cut.
	const meaningful = [...Object.values(schema.nodes), ...Object.values(schema.marks)]
		.flatMap((type) => type.spec.parseDOM ?? [])
		.flatMap((rule) => ("tag" in rule && rule.tag ? [rule.tag] : []))
		.join(",");
	const inElement = (node: Node) => {
		for (let el = node as HTMLElement | null; el && el !== root; el = el.parentElement) {
			if (el.matches(meaningful)) return true;
		}
		return false;
	};

	const cuts: (number | null)[] = new Array(blocks).fill(null);
	let last = 0;
	for (const { block, node, pos } of found) {
		if (block >= blocks || pos === undefined || pos > doc.content.size || inElement(node)) continue;
		const $pos = doc.resolve(pos);
		// At the very end of a node the parser just hadn't closed yet counts as after it.
		let atEnd = true;
		for (let depth = $pos.depth; depth > 0; depth--) {
			if ($pos.after(depth) !== pos + ($pos.depth - depth + 1)) atEnd = false;
		}
		if (!atEnd) continue;
		const cut = Math.min($pos.index(0) + ($pos.depth > 0 ? 1 : 0), nodes.length);
		if (cut < last) continue;
		cuts[block] = cut;
		last = cut;
	}
	return cuts;
}

export interface Layout {
	regions: Region[];
	/** Where the hidden title goes among the body's nodes. */
	titleIndex: number;
}

/**
 * How the note's source lines up with the body's top-level nodes (`nodes`,
 * without the empty paragraphs at the end). Null when it can't be told.
 */
export function blockLayout(editor: Editor, title: NoteTitle, nodes: PMNode[]): Layout | null {
	const all = splitSource(title.source).blocks;
	const body = title.heading ? all.filter((_, i) => i !== title.index) : all;

	let cuts: (number | null)[] | null;
	if (body.length === nodes.length && !body.some(mayNotBeOne)) {
		cuts = body.map((_, i) => i);
	} else {
		if (title.heading) {
			// Markers number the blocks of the body, which is parsed without the title.
			const parsed = splitSource(title.body).blocks;
			if (parsed.length !== body.length) return null;
		}
		cuts = findCuts(editor, title.body, body.length, nodes);
		if (!cuts) {
			// HTML too broken to follow (an unclosed <table>): count block by block.
			const counts = blockNodeCounts(editor, body);
			let total = 0;
			cuts = counts.map((count) => {
				const start = total;
				total += count;
				return start;
			});
			if (total !== nodes.length) return null;
		}
	}

	// The note's two ends are always cuts.
	const ends = [...cuts, nodes.length];
	ends[0] = 0;
	const regions: Region[] = [];
	let titleIndex = 0;
	let placed = !title.heading;
	const placeTitle = (index: number) => {
		regions.push({ blocks: 1, count: 1 });
		titleIndex = index;
		placed = true;
	};
	for (let from = 0; from < body.length; ) {
		let to = from + 1;
		while (ends[to] === null) to++;
		const first = ends[from]!;
		if (!placed && title.index === from) placeTitle(first);
		const region = { blocks: to - from, count: ends[to]! - first };
		if (!placed && title.index > from && title.index < to) {
			// The title is inside HTML that runs on past it, so it goes with it.
			region.blocks++;
			region.count++;
			titleIndex = first;
			placed = true;
		}
		regions.push(region);
		from = to;
	}
	if (!placed) placeTitle(nodes.length);
	return { regions, titleIndex };
}
