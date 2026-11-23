import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { afterEach, describe, expect, it, vi } from "vitest";
import { moveBlock } from "./blocks/blockPointerDrag";
import {
	BUBBLE_EDGE,
	BUBBLE_GLIDE,
	BUBBLE_MENU_KEY,
	BUBBLE_OFFSET,
	blockMenuSide,
	bubbleGlide,
	fitToVisibleArea,
	selectedTextBox,
	shouldShowBubble,
	trackPointerSelection,
} from "./bubbleMenu";

const editors: Editor[] = [];
afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

function open(content: string, editable = true) {
	const editor = new Editor({ element: document.createElement("div"), extensions: [StarterKit], content, editable });
	editors.push(editor);
	return editor;
}

/** What tiptap hands `shouldShow`, with the editor's focus decided here. */
function ask(editor: Editor, { focused = true, inMenu = false } = {}) {
	const { state } = editor;
	const { from, to } = state.selection;
	const element = document.createElement("div");
	if (inMenu) {
		const inside = document.createElement("button");
		element.append(inside);
		document.body.append(element);
		inside.focus();
	}
	const result = shouldShowBubble({
		editor,
		element,
		state,
		from,
		to,
		view: { hasFocus: () => focused } as never,
	});
	element.remove();
	return result;
}

/** Position of the text in the first block that holds `text`. */
function at(editor: Editor, text: string): number {
	let found = -1;
	editor.state.doc.descendants((node, pos) => {
		if (found < 0 && node.isText && node.text!.includes(text)) found = pos + node.text!.indexOf(text);
	});
	return found;
}

describe("shouldShowBubble", () => {
	it("shows for selected text", () => {
		const editor = open("<p>some words here</p>");
		editor.commands.setTextSelection({ from: 2, to: 7 });
		expect(ask(editor)).toBe(true);
	});

	it("does not show for a cursor", () => {
		const editor = open("<p>some words here</p>");
		editor.commands.setTextSelection(3);
		expect(ask(editor)).toBe(false);
	});

	it("does not show when a whole block is selected, as after dropping one", () => {
		const editor = open("<p>first</p><p>second</p><hr>");
		editor.commands.setNodeSelection(0);
		expect(editor.state.selection).toBeInstanceOf(NodeSelection);
		expect(ask(editor)).toBe(false);
		let rule = -1;
		editor.state.doc.forEach((node, pos) => {
			if (node.type.name === "horizontalRule") rule = pos;
		});
		editor.commands.setNodeSelection(rule);
		expect(editor.state.selection).toBeInstanceOf(NodeSelection);
		expect(ask(editor)).toBe(false);
	});

	it("does not show after a block is dragged and dropped", () => {
		const editor = open("<p>first</p><p>second</p><p>third</p>");
		const first = 0;
		const afterSecond = editor.state.doc.child(0).nodeSize + editor.state.doc.child(1).nodeSize;
		const tr = moveBlock(editor.state, first, afterSecond)!;
		editor.view.dispatch(tr);
		// The drop leaves the moved block selected, and the editor focused.
		expect(editor.state.selection).toBeInstanceOf(NodeSelection);
		expect(editor.state.doc.textContent).toBe("secondfirstthird");
		expect(ask(editor, { focused: true })).toBe(false);
	});

	it("needs the editor to be focused, or the bubble itself", () => {
		const editor = open("<p>some words here</p>");
		editor.commands.setTextSelection({ from: 2, to: 7 });
		expect(ask(editor, { focused: false })).toBe(false);
		expect(ask(editor, { focused: false, inMenu: true })).toBe(true);
	});

	it("does not show when the note can't be edited", () => {
		const editor = open("<p>some words here</p>", false);
		editor.commands.setTextSelection({ from: 2, to: 7 });
		expect(ask(editor)).toBe(false);
	});
});

describe("selectedTextBox", () => {
	/** Lines of text as the browser would report them for a range. */
	function withLines(lines: Array<[number, number, number, number]>) {
		const original = Range.prototype.getClientRects;
		Range.prototype.getClientRects = (() =>
			lines.map(([left, top, width, height]) => ({ left, top, width, height, right: left + width, bottom: top + height }))) as never;
		return () => {
			Range.prototype.getClientRects = original;
		};
	}

	it("is the box around the selected lines, not around the block", () => {
		const editor = open("<p>one two three four five six</p>");
		editor.commands.setTextSelection({ from: at(editor, "two") + 1, to: at(editor, "five") + 5 });
		// The selection starts mid-line on the first line and ends mid-line on the second.
		const restore = withLines([
			[300, 100, 200, 20],
			[100, 120, 150, 20],
		]);
		const box = selectedTextBox(editor)!.getBoundingClientRect();
		restore();
		expect([box.left, box.right, box.top, box.bottom]).toEqual([100, 500, 100, 140]);
		expect(box.left + box.width / 2).toBe(300);
	});

	it("ignores empty boxes, such as a line break", () => {
		const editor = open("<p>one two</p>");
		editor.commands.setTextSelection({ from: 2, to: 6 });
		const restore = withLines([
			[100, 100, 0, 20],
			[100, 100, 60, 20],
			[100, 100, 60, 0],
		]);
		const box = selectedTextBox(editor)!.getBoundingClientRect();
		restore();
		expect([box.left, box.right]).toEqual([100, 160]);
	});

	it("stops measuring line by line past a point, so each key stays cheap however long the selection is", () => {
		const measuredFor = (lines: number) => {
			const editor = open(Array.from({ length: lines }, (_, i) => `<p>line ${i}</p>`).join(""));
			let measured = 0;
			const original = Range.prototype.getClientRects;
			Range.prototype.getClientRects = (() => {
				measured++;
				return [{ left: 100, top: 100, width: 60, height: 20, right: 160, bottom: 120 }];
			}) as never;
			try {
				editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 2 });
				selectedTextBox(editor);
			} finally {
				Range.prototype.getClientRects = original;
			}
			return measured;
		};
		const some = measuredFor(400);
		expect(some).toBeGreaterThan(0);
		expect(some).toBeLessThanOrEqual(300);
		// Ten times the text, the same work.
		expect(measuredFor(4000)).toBe(some);
	});

	it("leaves the default in charge when there is no selected text", () => {
		const editor = open("<p>one</p><hr>");
		expect(selectedTextBox(editor)).toBeNull();
		editor.commands.setNodeSelection(0);
		expect(selectedTextBox(editor)).toBeNull();
		editor.commands.setTextSelection({ from: 2, to: 3 });
		// No layout in this environment, so nothing to measure.
		expect(selectedTextBox(editor)).toBeNull();
		expect(editor.state.selection).toBeInstanceOf(TextSelection);
	});
});

describe("blockMenuSide", () => {
	const rect = (top: number, bottom: number) => ({ top, bottom }) as DOMRect;

	it("opens upward from a bubble above the selected text", () => {
		expect(blockMenuSide(rect(100, 138), 146)).toBe("top");
	});

	it("opens downward from a bubble below the selected text", () => {
		expect(blockMenuSide(rect(70, 108), 40)).toBe("bottom");
	});

	it("opens downward when it can't tell", () => {
		expect(blockMenuSide(null, 100)).toBe("bottom");
		expect(blockMenuSide(rect(0, 10), null)).toBe("bottom");
	});
});

describe("trackPointerSelection", () => {
	const later = () => new Promise((resolve) => setTimeout(resolve, 5));

	/** An editor with some text selected, that records what is asked of the bubble. */
	function setup(editable = true) {
		const editor = open("<p>some words here</p>", editable);
		editor.view.hasFocus = () => true;
		editor.commands.setTextSelection({ from: 2, to: 7 });
		const asked: string[] = [];
		editor.on("transaction", ({ transaction }) => {
			const meta = transaction.getMeta(BUBBLE_MENU_KEY);
			if (meta) asked.push(meta);
		});
		const stop = trackPointerSelection(editor);
		const press = (init: MouseEventInit = {}) =>
			editor.view.dom.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, ...init }));
		const release = (target: EventTarget = window) =>
			target.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, button: 0 }));
		return { editor, asked, stop, press, release };
	}

	it("hides the bubble when a selection starts, and keeps it away while the button is down", () => {
		const { editor, asked, press } = setup();
		expect(ask(editor)).toBe(true);
		press();
		expect(asked).toEqual(["hide"]);
		// Even though text is selected, even long after the last change.
		expect(ask(editor)).toBe(false);
	});

	it("shows it, and places it, when the button comes up", async () => {
		const { editor, asked, press, release } = setup();
		press();
		release();
		await later();
		expect(asked).toEqual(["hide", "show", "updatePosition"]);
		expect(ask(editor)).toBe(true);
	});

	it("shows it for a release outside the editor, as after dragging out of it", async () => {
		const { asked, press, release } = setup();
		press();
		release(document.body);
		await later();
		expect(asked).toEqual(["hide", "show", "updatePosition"]);
	});

	it("shows nothing when the release leaves no selection, as for a click", async () => {
		const { editor, asked, press, release } = setup();
		press();
		editor.commands.setTextSelection(3);
		release();
		await later();
		expect(asked).toEqual(["hide"]);
	});

	it("ignores other buttons", () => {
		const { editor, asked, press } = setup();
		press({ button: 2 });
		expect(asked).toEqual([]);
		expect(ask(editor)).toBe(true);
	});

	it("takes a move with no button down as the release it missed", async () => {
		const { editor, asked, press } = setup();
		press();
		window.dispatchEvent(new MouseEvent("pointermove", { buttons: 1 }));
		expect(ask(editor)).toBe(false);
		window.dispatchEvent(new MouseEvent("pointermove", { buttons: 0 }));
		await later();
		expect(asked).toEqual(["hide", "show", "updatePosition"]);
		expect(ask(editor)).toBe(true);
	});

	it("takes a cancelled press, such as dragging the selected text away, as a release", async () => {
		const { asked, press } = setup();
		press();
		window.dispatchEvent(new Event("pointercancel"));
		await later();
		expect(asked).toEqual(["hide", "show", "updatePosition"]);
	});

	it("does nothing for a release it didn't start", async () => {
		const { asked, release } = setup();
		release();
		await later();
		expect(asked).toEqual([]);
	});

	it("leaves a note that can't be edited alone", () => {
		const { asked, press } = setup(false);
		press();
		expect(asked).toEqual([]);
	});

	it("stops when asked, and lets go of the editor", async () => {
		const { editor, asked, stop, press, release } = setup();
		press();
		stop();
		// Not left hidden by a press that never gets its release.
		expect(ask(editor)).toBe(true);
		asked.length = 0;
		press();
		release();
		await later();
		expect(asked).toEqual([]);
	});
});

describe("bubbleGlide", () => {
	function setup(reduce = false) {
		const element = document.createElement("div");
		const frames: Array<() => void> = [];
		vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
		const glide = bubbleGlide(() => element, () => reduce);
		const nextFrame = () => frames.splice(0).forEach((run) => run());
		return { element, glide, nextFrame };
	}
	afterEach(() => vi.unstubAllGlobals());

	it("does not glide to where it first appears, then glides when it moves", () => {
		const { element, glide, nextFrame } = setup();
		glide.onShow();
		expect(element.style.transition).toBe("none");
		glide.onUpdate(); // the first placement
		expect(element.style.transition).toBe("none");
		nextFrame(); // drawn
		expect(element.style.transition).toBe(BUBBLE_GLIDE);
		glide.onUpdate(); // a later move
		nextFrame();
		expect(element.style.transition).toBe(BUBBLE_GLIDE);
	});

	it("starts over each time it appears", () => {
		const { element, glide, nextFrame } = setup();
		glide.onShow();
		glide.onUpdate();
		nextFrame();
		glide.onHide();
		expect(element.style.transition).toBe("none");
		glide.onShow();
		glide.onUpdate();
		expect(element.style.transition).toBe("none");
		nextFrame();
		expect(element.style.transition).toBe(BUBBLE_GLIDE);
	});

	it("is not left gliding by a frame that arrives after it was hidden", () => {
		const { element, glide, nextFrame } = setup();
		glide.onShow();
		glide.onUpdate();
		glide.onHide();
		nextFrame();
		expect(element.style.transition).toBe("none");
	});

	it("never glides for someone who asked for less motion", () => {
		const { element, glide, nextFrame } = setup(true);
		glide.onShow();
		glide.onUpdate();
		nextFrame();
		glide.onUpdate();
		nextFrame();
		expect(element.style.transition).toBe("none");
	});

	it("is fine before the bubble exists", () => {
		const frames: Array<() => void> = [];
		vi.stubGlobal("requestAnimationFrame", (callback: () => void) => frames.push(callback));
		const glide = bubbleGlide(() => null, () => false);
		glide.onShow();
		glide.onUpdate();
		expect(() => frames.forEach((run) => run())).not.toThrow();
		glide.onHide();
	});
});

describe("fitToVisibleArea", () => {
	// A pane from 40 to 760 (the window is 768 tall in this environment), and a bubble 38 tall.
	const pane = { top: 40, bottom: 760 };
	const visible = (area: typeof pane | null = pane, barHeight = 38) => ({ area: () => area, barHeight: () => barHeight });
	const box = (top: number, bottom: number) => ({ left: 100, right: 500, top, bottom });
	const room = 38 + BUBBLE_OFFSET + BUBBLE_EDGE;

	it("leaves a selection alone when the bubble fits above it", () => {
		expect(fitToVisibleArea(box(300, 340), visible())).toEqual(box(300, 340));
	});

	it("leaves it alone when there is no room above but there is below, as when the start is scrolled off", () => {
		expect(fitToVisibleArea(box(-400, 300), visible())).toEqual(box(-400, 300));
		expect(fitToVisibleArea(box(50, 90), visible())).toEqual(box(50, 90));
	});

	it("puts the bubble inside, at the top of what is showing, when both ends are out of view", () => {
		const fitted = fitToVisibleArea(box(-500, 2000), visible());
		expect(fitted).toEqual({ left: 100, right: 500, top: 40 + room, bottom: 40 + room });
		// The bubble sits above that point, so it is `BUBBLE_EDGE` below the top of the pane.
		expect(fitted.top - BUBBLE_OFFSET - 38 - 40).toBe(BUBBLE_EDGE);
	});

	it("does the same when the start is scrolled off and the end is too close to the bottom", () => {
		expect(fitToVisibleArea(box(-200, 740), visible()).top).toBe(40 + room);
	});

	it("keeps the horizontal place of the selection", () => {
		const { left, right } = fitToVisibleArea(box(-500, 2000), visible());
		expect([left, right]).toEqual([100, 500]);
	});

	it("counts the window as the bottom edge when the pane runs past it", () => {
		expect(fitToVisibleArea(box(-100, 1500), visible({ top: 40, bottom: 5000 })).top).toBe(40 + room);
	});

	it("allows for a taller bubble", () => {
		expect(fitToVisibleArea(box(-500, 2000), visible(pane, 80)).top).toBe(40 + 80 + BUBBLE_OFFSET + BUBBLE_EDGE);
	});

	it("leaves a selection that is not in view at all", () => {
		expect(fitToVisibleArea(box(-900, -300), visible())).toEqual(box(-900, -300));
		expect(fitToVisibleArea(box(2000, 2400), visible())).toEqual(box(2000, 2400));
	});

	it("leaves it alone when the pane isn't known", () => {
		expect(fitToVisibleArea(box(-500, 2000), visible(null))).toEqual(box(-500, 2000));
	});
});

describe("selectedTextBox for select all", () => {
	it("is treated as selected text, so it can be kept in view", () => {
		const editor = open("<p>one</p><p>two</p>");
		editor.commands.selectAll();
		const original = Range.prototype.getClientRects;
		Range.prototype.getClientRects = (() => [{ left: 10, top: 50, width: 80, height: 20, right: 90, bottom: 70 }]) as never;
		try {
			expect(selectedTextBox(editor)).not.toBeNull();
		} finally {
			Range.prototype.getClientRects = original;
		}
	});
});
