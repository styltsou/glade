import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditableTitle } from "./EditableTitle";

const initial = useStore.getState();
const commitTitle = vi.fn(async () => true);
const onDone = vi.fn();
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
	(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
	useStore.setState({ ...initial, commitTitle, focusTitlePath: null });
	commitTitle.mockClear();
	onDone.mockClear();
	host = document.createElement("div");
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	act(() => root.unmount());
	host.remove();
	useStore.setState(initial, true);
});

async function show(path: string, title: string) {
	await act(async () => {
		root.render(
			<StrictMode>
				<TooltipProvider>
					<EditableTitle path={path} title={title} onDone={onDone} />
				</TooltipProvider>
			</StrictMode>,
		);
	});
}

const input = () => host.querySelector("input");
const click = () => act(async () => void host.querySelector("h1")!.parentElement!.click());

async function type(value: string) {
	await act(async () => {
		Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value);
		input()!.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

async function press(key: string, init: KeyboardEventInit = {}) {
	const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
	await act(async () => void input()!.dispatchEvent(event));
	return event;
}

describe("EditableTitle", () => {
	it("focuses an empty field on a new note, also under StrictMode", async () => {
		useStore.setState({ focusTitlePath: "untitled.md" });
		await show("untitled.md", "untitled");
		expect(document.activeElement).toBe(input());
		expect(input()!.value).toBe("");
		expect(input()!.placeholder).toBe("Untitled");
		expect(commitTitle).not.toHaveBeenCalled();
	});

	it("commits on Enter and hands the keyboard on, without typing a new line", async () => {
		await show("untitled.md", "untitled");
		await click();
		await type("Meeting Notes");
		const event = await press("Enter");
		expect(event.defaultPrevented).toBe(true);
		expect(commitTitle).toHaveBeenCalledExactlyOnceWith("untitled.md", "Meeting Notes");
		expect(onDone).toHaveBeenCalledOnce();
	});

	it("leaves Enter to an input method that is composing", async () => {
		await show("untitled.md", "untitled");
		await click();
		await type("会議");
		await press("Enter", { isComposing: true });
		expect(commitTitle).not.toHaveBeenCalled();
	});

	it("cancels on Escape", async () => {
		await show("plan.md", "Plan");
		await click();
		await type("Something else");
		await press("Escape");
		expect(input()).toBeNull();
		expect(commitTitle).not.toHaveBeenCalled();
	});

	it("writes nothing for an untouched title on a named file", async () => {
		await show("README.md", "README");
		await click();
		expect(input()!.value).toBe("README");
		await press("Enter");
		expect(commitTitle).not.toHaveBeenCalled();
	});

	it("names an untitled file from a title it already has, without rewriting it", async () => {
		await show("untitled.md", "Typed in the body");
		await click();
		await press("Enter");
		expect(commitTitle).toHaveBeenCalledExactlyOnceWith("untitled.md", null);
	});

	it("gives the title to the note it was typed for when the pane moves on", async () => {
		await show("a.md", "A");
		await click();
		await type("A, edited");
		await show("b.md", "B");
		expect(commitTitle).toHaveBeenCalledExactlyOnceWith("a.md", "A, edited");
	});

	it("saves what was typed when the pane closes", async () => {
		await show("a.md", "A");
		await click();
		await type("A, edited");
		await act(async () => root.unmount());
		expect(commitTitle).toHaveBeenCalledExactlyOnceWith("a.md", "A, edited");
		root = createRoot(host);
	});
});
