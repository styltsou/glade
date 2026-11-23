import { isTextSelection, type Editor } from "@tiptap/core";
import type { BubbleMenuPluginProps } from "@tiptap/extension-bubble-menu";
import { CellSelection } from "@tiptap/pm/tables";
import { AllSelection, NodeSelection, PluginKey, TextSelection } from "@tiptap/pm/state";

/** The bubble menu's plugin key: how this file and the editor address it. */
export const BUBBLE_MENU_KEY = new PluginKey("noteBubbleMenu");

/** Editors whose selection the mouse is still making (the button is down). */
const selectingWithPointer = new WeakSet<Editor>();

/** What the floating menu positions itself against. */
interface Box {
	getBoundingClientRect(): DOMRect;
	getClientRects(): DOMRect[];
}

/**
 * When the formatting bubble shows: for selected text, or a block of table
 * cells, once the selection is made. While the mouse button is still down the
 * selection is still changing, and a bubble would trail it and sit under the
 * pointer, so it waits for the release. A node picked as a whole (the block
 * just dropped after a drag, an image that was clicked) is not text to format,
 * so it gets no bubble.
 */
export const shouldShowBubble: NonNullable<BubbleMenuPluginProps["shouldShow"]> = ({
	editor,
	element,
	view,
	state,
	from,
	to,
}) => {
	const { selection, doc } = state;
	if (!editor.isEditable || selection.empty || selection instanceof NodeSelection) return false;
	if (selectingWithPointer.has(editor)) return false;
	if (isTextSelection(selection) && !doc.textBetween(from, to).length) return false;
	// A click inside the bubble moves focus to it: it is still part of the editor.
	return view.hasFocus() || element.contains(document.activeElement);
};

/** Nodes of a selection measured for the bubble's place; a bigger one is placed from its two ends. */
const MAX_MEASURED = 300;

/** Gap between the bubble and the text it sits over (floating-ui's offset). */
export const BUBBLE_OFFSET = 8;

/** The room kept between the bubble and the edge of the pane. */
export const BUBBLE_EDGE = 12;

interface Rect {
	left: number;
	right: number;
	top: number;
	bottom: number;
}

function asBox(rect: Rect): Box {
	const box = {
		x: rect.left,
		y: rect.top,
		...rect,
		width: rect.right - rect.left,
		height: rect.bottom - rect.top,
		toJSON() {
			return this;
		},
	} as DOMRect;
	return { getBoundingClientRect: () => box, getClientRects: () => [box] };
}

/** The lines of selected text, one rect each. Null when there are too many to be worth measuring. */
function measureLines(editor: Editor): Rect | null {
	const { view, state } = editor;
	const { selection, doc } = state;
	const rects: DOMRect[] = [];
	let visited = 0;
	doc.nodesBetween(selection.from, selection.to, (node, pos) => {
		// The bubble follows every change to the selection, and measuring each line of
		// a selection of thousands is slow.
		if (++visited > MAX_MEASURED) return false;
		if (node.isText) {
			const from = Math.max(selection.from, pos);
			const to = Math.min(selection.to, pos + node.nodeSize);
			const start = view.domAtPos(from);
			const end = view.domAtPos(to);
			const range = document.createRange();
			range.setStart(start.node, start.offset);
			range.setEnd(end.node, end.offset);
			if (typeof range.getClientRects === "function") rects.push(...range.getClientRects());
		} else if (node.isInline && node.isAtom) {
			// An image or mention in the middle of the text.
			const dom = view.nodeDOM(pos);
			if (dom instanceof HTMLElement) rects.push(dom.getBoundingClientRect());
		}
	});
	if (visited > MAX_MEASURED) return null;
	const lines = rects.filter((rect) => rect.width > 0 && rect.height > 0);
	if (lines.length === 0) return null;
	return {
		left: Math.min(...lines.map((rect) => rect.left)),
		right: Math.max(...lines.map((rect) => rect.right)),
		top: Math.min(...lines.map((rect) => rect.top)),
		bottom: Math.max(...lines.map((rect) => rect.bottom)),
	};
}

/**
 * For a selection too big to measure line by line: from where it starts to
 * where it ends, across the width of the text column.
 */
function measureEnds(editor: Editor): Rect | null {
	const { view, state } = editor;
	const { from, to } = state.selection;
	const last = state.doc.content.size;
	try {
		const start = view.coordsAtPos(Math.max(from, 1));
		const end = view.coordsAtPos(Math.min(to, Math.max(last - 1, 1)));
		const column = view.dom.getBoundingClientRect();
		return {
			left: column.left,
			right: column.right,
			top: Math.min(start.top, end.top),
			bottom: Math.max(start.bottom, end.bottom),
		};
	} catch {
		return null;
	}
}

/** What the bubble needs to keep itself in view. */
export interface VisibleArea {
	/** The part of the window the text can be seen in (the scrolling pane), or null if unknown. */
	area(): { top: number; bottom: number } | null;
	/** How tall the bubble is. */
	barHeight(): number;
}

/**
 * Keep the bubble where it can be seen. It goes above the selection, or below
 * it when there is no room above. A selection longer than the window can have
 * both of those out of view, with the start scrolled off above and the end
 * below, and then the bubble would be somewhere nobody sees it. In that case
 * it is put inside, at the top of the part of the selection that is showing.
 * A selection that is entirely out of view is left alone.
 */
export function fitToVisibleArea(box: Rect, visible: VisibleArea): Rect {
	const area = visible.area();
	if (!area) return box;
	const top = Math.max(area.top, 0);
	const bottom = Math.min(area.bottom, window.innerHeight);
	if (box.bottom < top || box.top > bottom) return box;

	const room = visible.barHeight() + BUBBLE_OFFSET + BUBBLE_EDGE;
	if (box.top - room >= top || box.bottom + room <= bottom) return box;

	// The bubble sits above what it is given, so give it a point `room` down from the top.
	const pinned = top + room;
	return { ...box, top: pinned, bottom: pinned };
}

/**
 * The box around the selected text itself, line by line, so the bubble sits
 * over the words and not over the middle of the block they are in. The
 * default looks only at the two ends of the selection, which, for text that
 * wraps over several lines, is somewhere else entirely. Given the visible
 * area, the box is also kept where the bubble can be seen.
 *
 * Null when there is no such text (a cell selection, say), which leaves the
 * default in charge.
 */
export function selectedTextBox(editor: Editor, visible?: VisibleArea): Box | null {
	const { selection } = editor.state;
	const text = selection instanceof TextSelection || selection instanceof AllSelection;
	if (!text || selection.empty || selection instanceof CellSelection) return null;

	const rect = measureLines(editor) ?? measureEnds(editor);
	if (!rect) return null;
	return asBox(visible ? fitToVisibleArea(rect, visible) : rect);
}

/**
 * Which way the block-type menu opens: away from the selected text, so what
 * is being changed stays in view. The bubble sits above the text unless that
 * left no room, so a bubble above opens its menu upward, and one below,
 * downward. (If there isn't room that way either, the menu itself flips.)
 */
export function blockMenuSide(trigger: DOMRect | null, textTop: number | null): "top" | "bottom" {
	if (!trigger || textTop === null) return "bottom";
	return trigger.bottom <= textTop + 2 ? "top" : "bottom";
}

/**
 * Hide the bubble when a mouse selection starts, and show it when the button
 * comes up, wherever that is (the pointer can leave the editor mid-drag). The
 * bubble's own update runs only when the selection changes, so without this it
 * would stay hidden after a drag that ended on its last change. Selecting with
 * the keyboard has no release, and is left to the bubble's short delay.
 * Returns the function that stops listening.
 */
export function trackPointerSelection(editor: Editor): () => void {
	const send = (meta: "hide" | "show" | "updatePosition") => {
		if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_MENU_KEY, meta));
	};

	const reveal = () => {
		if (editor.isDestroyed || selectingWithPointer.has(editor)) return;
		const { state, view } = editor;
		const { ranges } = state.selection;
		const shown = shouldShowBubble({
			editor,
			// Not the bubble's own element: a release is in the editor, which has focus.
			element: document.createElement("div"),
			view,
			state,
			from: Math.min(...ranges.map((range) => range.$from.pos)),
			to: Math.max(...ranges.map((range) => range.$to.pos)),
		});
		if (!shown) return;
		// The bubble only places itself after it is shown, so it takes two steps.
		send("show");
		send("updatePosition");
	};

	const press = (event: PointerEvent) => {
		if (event.button !== 0 || !editor.isEditable) return;
		selectingWithPointer.add(editor);
		send("hide");
	};

	const release = () => {
		if (!selectingWithPointer.delete(editor)) return;
		// ProseMirror reads the final selection from the page just after the button comes up.
		setTimeout(reveal, 0);
	};

	// A press whose release was missed (the window lost it) must not leave the bubble off.
	const move = (event: PointerEvent) => {
		if (event.buttons === 0) release();
	};

	const dom = editor.view.dom;
	dom.addEventListener("pointerdown", press);
	window.addEventListener("pointerup", release, true);
	window.addEventListener("pointercancel", release, true);
	window.addEventListener("dragend", release, true);
	window.addEventListener("pointermove", move, true);
	return () => {
		dom.removeEventListener("pointerdown", press);
		window.removeEventListener("pointerup", release, true);
		window.removeEventListener("pointercancel", release, true);
		window.removeEventListener("dragend", release, true);
		window.removeEventListener("pointermove", move, true);
		selectingWithPointer.delete(editor);
	};
}

/** How the bubble moves from one place to another while it stays on screen. */
export const BUBBLE_GLIDE =
	"left 100ms var(--ease-ui, cubic-bezier(0.23, 1, 0.32, 1)), top 100ms var(--ease-ui, cubic-bezier(0.23, 1, 0.32, 1))";

const prefersReducedMotion = () =>
	typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The bubble follows a selection that is still growing, which with the
 * keyboard is a move on every key. It glides for a moment instead of
 * jumping, but only once it is on screen: where it first appears is not
 * somewhere it travelled to from where it was last, and a system that asks
 * for less motion gets none. Callbacks for the bubble menu's `options`.
 */
export function bubbleGlide(getElement: () => HTMLElement | null, reduceMotion = prefersReducedMotion) {
	let placed = false;
	const set = (transition: string) => {
		const element = getElement();
		if (element) element.style.transition = transition;
	};
	return {
		onShow: () => {
			placed = false;
			set("none");
		},
		onHide: () => {
			placed = false;
			set("none");
		},
		onUpdate: () => {
			if (placed) return;
			placed = true;
			// After the first placement has been drawn, so that it doesn't slide in.
			requestAnimationFrame(() => {
				if (placed) set(reduceMotion() ? "none" : BUBBLE_GLIDE);
			});
		},
	};
}
