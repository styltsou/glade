import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EditableTitle } from "./EditableTitle";
import { PASTE_NOTE_EVENT, type PasteNoteDetail } from "@/lib/pastedNote";

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

	it("keeps what was typed on Escape", async () => {
		await show("plan.md", "Plan");
		await click();
		await type("Something else");
		await press("Escape");
		expect(input()).toBeNull();
		expect(commitTitle).toHaveBeenCalledExactlyOnceWith("plan.md", "Something else");
		expect(onDone).toHaveBeenCalled();
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

	describe("pasting a whole note", () => {
		async function paste(text: string) {
			const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
			event.clipboardData = { getData: (type: string) => (type === "text/plain" ? text : "") };
			await act(async () => void input()!.dispatchEvent(event));
			return event;
		}
		const received: PasteNoteDetail[] = [];
		let answer: (detail: PasteNoteDetail) => void = () => {};
		const listen = (e: Event) => {
			const detail = (e as CustomEvent<PasteNoteDetail>).detail;
			received.push(detail);
			answer(detail);
		};
		beforeEach(() => {
			received.length = 0;
			window.addEventListener(PASTE_NOTE_EVENT, listen);
		});
		afterEach(() => window.removeEventListener(PASTE_NOTE_EVENT, listen));

		it("hands an empty note the whole of it, and writes no title of its own", async () => {
			answer = (detail) => {
				detail.handled = "whole";
				detail.done = new Promise(() => {}); // still saving
			};
			await show("untitled.md", "untitled");
			await click();
			const event = await paste("# Trip plan\n\nDay one: beach");
			expect(event.defaultPrevented).toBe(true);
			expect(received[0]).toMatchObject({ path: "untitled.md", note: { title: "Trip plan", body: "Day one: beach" } });
			expect(input()).toBeNull();
			expect(host.querySelector("h1")!.textContent).toBe("Trip plan");
			expect(commitTitle).not.toHaveBeenCalled();
		});

		it("keeps the title here and sends the rest to a body that has text", async () => {
			answer = (detail) => {
				detail.handled = "body";
			};
			await show("untitled.md", "untitled");
			await click();
			await paste("# Trip plan\n\nDay one: beach");
			expect(commitTitle).toHaveBeenCalledExactlyOnceWith("untitled.md", "Trip plan");
			expect(onDone).toHaveBeenCalled();
		});

		it("keeps the title field open when nothing pasted reads as a title", async () => {
			answer = (detail) => {
				detail.handled = "whole";
			};
			await show("untitled.md", "untitled");
			await click();
			const event = await paste("- socks\n- hat");
			expect(event.defaultPrevented).toBe(true);
			expect(received[0].note).toMatchObject({ title: "", body: "- socks\n- hat" });
			expect(input()).not.toBeNull();
			expect(commitTitle).not.toHaveBeenCalled();
		});

		it("pastes a single line, or with no editor to take the body, as usual", async () => {
			answer = () => {};
			await show("untitled.md", "untitled");
			await click();
			expect((await paste("Trip plan")).defaultPrevented).toBe(false);
			expect(received).toHaveLength(0);
			expect((await paste("# Trip plan\n\nBeach")).defaultPrevented).toBe(false);
			expect(commitTitle).not.toHaveBeenCalled();
		});
	});
});
