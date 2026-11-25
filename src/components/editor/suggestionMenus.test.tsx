import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MentionList, type MentionListHandle } from "./MentionList";
import { SlashCommandMenu, slashCommands, type SlashCommandMenuHandle } from "./extensions/SlashCommandMenu";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
	(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
	host = document.createElement("div");
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

const rows = () => [...host.querySelectorAll<HTMLElement>("[data-selected]")];
const selectedIndex = () => rows().findIndex((row) => row.dataset.selected === "true");

function mouseMove(target: Element, movement: number) {
	const event = new MouseEvent("mousemove", { bubbles: true });
	Object.defineProperty(event, "movementX", { value: movement });
	Object.defineProperty(event, "movementY", { value: 0 });
	act(() => {
		target.dispatchEvent(event);
	});
}

function arrowDown(handle: { onKeyDown: (props: { event: KeyboardEvent }) => boolean }) {
	act(() => {
		handle.onKeyDown({ event: new KeyboardEvent("keydown", { key: "ArrowDown" }) });
	});
}

const notes = ["Alpha", "Beta", "Gamma", "Delta"].map((label) => ({ id: label, label }));

describe.each([
	[
		"mention list",
		() => {
			const ref = createRef<MentionListHandle>();
			act(() => root.render(<MentionList ref={ref} items={notes} command={() => {}} />));
			return ref;
		},
	],
	[
		"block menu",
		() => {
			const ref = createRef<SlashCommandMenuHandle>();
			act(() => root.render(<SlashCommandMenu ref={ref} items={slashCommands} command={() => {}} />));
			return ref;
		},
	],
])("%s hover", (_name, mount) => {
	it("selects the row under a moving mouse, so only one row is ever highlighted", () => {
		mount();
		mouseMove(rows()[2], 3);
		expect(selectedIndex()).toBe(2);
		expect(rows().filter((row) => row.dataset.selected === "true")).toHaveLength(1);
	});

	it("ignores a resting pointer while the arrow keys move the highlight", () => {
		const ref = mount();
		arrowDown(ref.current!);
		// Rows scrolling under a still pointer report a mouse-move with no movement.
		mouseMove(rows()[3], 0);
		expect(selectedIndex()).toBe(1);
	});
});
