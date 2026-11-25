import type { Editor } from "@tiptap/core";
import { Fragment, Slice, type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { dropPoint } from "@tiptap/pm/transform";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Dragging a block by its grip, done with pointer events instead of native
 * HTML drag and drop. In the app's webview (WebKitGTK) a native drag from the
 * grip never got going, so the block follows the pointer the same way tabs do.
 */

/** Pointer travel before a press on the grip becomes a drag. */
const DRAG_THRESHOLD = 4;
/** Distance from the scroll area's top or bottom edge where dragging scrolls it. */
const SCROLL_EDGE = 56;
const SCROLL_MAX_STEP = 16;

/**
 * Where the block at `from` lands for a drop aimed at `candidate`: the nearest
 * spot that can hold it (ProseMirror's own rule for drops). Null when nothing
 * fits, or when that spot is where the block already is.
 */
export function blockDropTarget(doc: ProseMirrorNode, from: number, candidate: number): number | null {
	const node = doc.nodeAt(from);
	if (!node) return null;
	const at = dropPoint(doc, candidate, new Slice(Fragment.from(node), 0, 0));
	if (at == null) return null;
	if (at >= from && at <= from + node.nodeSize) return null;
	return at;
}

/** Move the block at `from` to `insertPos` (a position in the current document), as a native drop would. */
export function moveBlock(state: EditorState, from: number, insertPos: number): Transaction | null {
	const node = state.doc.nodeAt(from);
	if (!node) return null;
	const tr = state.tr;
	// Deleting through the selection removes a now-empty list around it too.
	tr.setSelection(NodeSelection.create(state.doc, from)).deleteSelection();
	const pos = tr.mapping.map(insertPos);
	const before = tr.doc;
	tr.replaceRangeWith(pos, pos, node);
	if (tr.doc.eq(before)) return null;
	const $pos = tr.doc.resolve(pos);
	if (NodeSelection.isSelectable(node) && $pos.nodeAfter?.sameMarkup(node)) {
		tr.setSelection(new NodeSelection($pos));
	} else {
		tr.setSelection(TextSelection.near($pos));
	}
	return tr.setMeta("uiEvent", "drop");
}

/**
 * The drop spot for a pointer at (x, y): before or after the block under it,
 * picked by which half the pointer is in, at the same nesting level as the
 * dragged block where there is one.
 */
function dropCandidate(view: EditorView, from: number, x: number, y: number): number | null {
	const hit = view.posAtCoords({ left: x, top: y });
	if (!hit) return null;
	const doc = view.state.doc;
	const $hit = doc.resolve(hit.pos);
	const chain: { pos: number; node: ProseMirrorNode }[] = [];
	for (let depth = 1; depth <= $hit.depth; depth++) chain.push({ pos: $hit.before(depth), node: $hit.node(depth) });
	// An atom (image, rule, diagram) under the pointer isn't an ancestor of the hit position.
	if (hit.inside >= 0 && !chain.some((c) => c.pos === hit.inside)) {
		const node = doc.nodeAt(hit.inside);
		if (node && !node.isInline) chain.push({ pos: hit.inside, node });
	}
	if (chain.length === 0) return hit.pos;
	const level = chain[Math.min(doc.resolve(from).depth, chain.length - 1)];
	const dom = view.nodeDOM(level.pos);
	if (!(dom instanceof Element)) return hit.pos;
	const rect = dom.getBoundingClientRect();
	return y < rect.top + rect.height / 2 ? level.pos : level.pos + level.node.nodeSize;
}

/** Screen rect of the line drawn where the block would land. */
function dropLineRect(view: EditorView, at: number): { left: number; top: number; width: number } | null {
	const $at = view.state.doc.resolve(at);
	const before = $at.nodeBefore ? view.nodeDOM(at - $at.nodeBefore.nodeSize) : null;
	const after = $at.nodeAfter ? view.nodeDOM(at) : null;
	const rb = before instanceof Element ? before.getBoundingClientRect() : null;
	const ra = after instanceof Element ? after.getBoundingClientRect() : null;
	const box = ra ?? rb;
	if (!box) return null;
	const top = rb && ra ? (rb.bottom + ra.top) / 2 : ra ? ra.top - 2 : rb!.bottom + 2;
	return { left: box.left, top, width: box.width };
}

/** Start following the pointer from a press on the grip of the block at `from`. */
export function startBlockDrag(
	event: PointerEvent,
	editor: Editor,
	from: number,
	controls: HTMLElement,
	/** Called when the press was released without moving: a click on the grip. */
	onTap?: () => void,
) {
	if (event.button !== 0 || !editor.isEditable) return;
	// No text selection, no native drag, no focus change.
	event.preventDefault();
	const view = editor.view;
	const node = view.state.doc.nodeAt(from);
	if (!node) return;

	const start = { x: event.clientX, y: event.clientY };
	const pointer = { ...start };
	const scroller = view.dom.closest<HTMLElement>(".note-scroll");
	let dragging = false;
	let dropAt: number | null = null;
	let ghost: HTMLElement | null = null;
	let line: HTMLElement | null = null;
	let scrollFrame = 0;

	const begin = () => {
		const dom = view.nodeDOM(from);
		if (!(dom instanceof HTMLElement)) return false;
		dragging = true;
		const rect = dom.getBoundingClientRect();
		// A see-through copy of the block rides with the pointer, starting right
		// on top of it; the block itself stays as it is until the drop.
		ghost = document.createElement("div");
		ghost.className = "tiptap-editor note-block-drag-ghost";
		const copy = dom.cloneNode(true) as HTMLElement;
		copy.style.margin = "0";
		ghost.append(copy);
		Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
		line = document.createElement("div");
		line.className = "note-block-drop-line";
		document.body.append(ghost, line);
		controls.dataset.dragging = "true";
		document.documentElement.dataset.draggingBlock = "";
		editor.commands.setMeta("lockDragHandle", true);
		return true;
	};

	const update = () => {
		if (!ghost || !line) return;
		ghost.style.translate = `${pointer.x - start.x}px ${pointer.y - start.y}px`;
		// The pointer is usually in the gutter: aim from just inside the text column.
		const bounds = view.dom.getBoundingClientRect();
		const inset = parseFloat(getComputedStyle(view.dom).paddingLeft) || 0;
		const x = Math.min(Math.max(pointer.x, bounds.left + inset + 2), bounds.right - 2);
		const y = Math.min(Math.max(pointer.y, bounds.top + 1), bounds.bottom - 1);
		const candidate = dropCandidate(view, from, x, y);
		dropAt = candidate == null ? null : blockDropTarget(view.state.doc, from, candidate);
		const rect = dropAt == null ? null : dropLineRect(view, dropAt);
		line.style.display = rect ? "block" : "none";
		if (rect) Object.assign(line.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
	};

	// Near the scroll area's top or bottom edge, scroll toward it; faster the closer.
	const autoScroll = () => {
		scrollFrame = requestAnimationFrame(autoScroll);
		if (!dragging || !scroller) return;
		const r = scroller.getBoundingClientRect();
		const step =
			pointer.y < r.top + SCROLL_EDGE
				? -Math.ceil(((r.top + SCROLL_EDGE - pointer.y) / SCROLL_EDGE) * SCROLL_MAX_STEP)
				: pointer.y > r.bottom - SCROLL_EDGE
					? Math.ceil(((pointer.y - (r.bottom - SCROLL_EDGE)) / SCROLL_EDGE) * SCROLL_MAX_STEP)
					: 0;
		if (step === 0) return;
		const before = scroller.scrollTop;
		scroller.scrollTop += Math.max(-SCROLL_MAX_STEP, Math.min(SCROLL_MAX_STEP, step));
		// The ghost stays with the pointer; only the drop spot under it changed.
		if (scroller.scrollTop !== before) update();
	};

	const onMove = (e: PointerEvent) => {
		pointer.x = e.clientX;
		pointer.y = e.clientY;
		if (!dragging) {
			if (Math.hypot(pointer.x - start.x, pointer.y - start.y) < DRAG_THRESHOLD) return;
			if (!begin()) return finish(false);
			scrollFrame = requestAnimationFrame(autoScroll);
		}
		update();
	};

	const finish = (drop: boolean) => {
		window.removeEventListener("pointermove", onMove, true);
		window.removeEventListener("pointerup", onUp, true);
		window.removeEventListener("pointercancel", onCancel, true);
		window.removeEventListener("keydown", onKey, true);
		cancelAnimationFrame(scrollFrame);
		if (!dragging) return;
		ghost?.remove();
		line?.remove();
		delete controls.dataset.dragging;
		delete document.documentElement.dataset.draggingBlock;
		editor.commands.setMeta("lockDragHandle", false);
		// The block may have changed under the drag (a reload from disk): only move the same one.
		const tr = drop && dropAt != null && view.state.doc.nodeAt(from) === node ? moveBlock(view.state, from, dropAt) : null;
		if (tr) {
			view.dispatch(tr);
			view.focus();
		}
		editor.commands.setMeta("hideDragHandle", true);
	};

	const onUp = () => {
		const tapped = !dragging;
		finish(true);
		if (tapped) onTap?.();
	};
	const onCancel = () => finish(false);
	const onKey = (e: KeyboardEvent) => {
		if (e.key !== "Escape") return;
		e.preventDefault();
		e.stopPropagation();
		finish(false);
	};

	window.addEventListener("pointermove", onMove, true);
	window.addEventListener("pointerup", onUp, true);
	window.addEventListener("pointercancel", onCancel, true);
	window.addEventListener("keydown", onKey, true);
}
