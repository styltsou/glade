import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfirmDialog, confirmDialog } from "./ConfirmDialog";

let host: HTMLDivElement;
let root: Root;

beforeEach(async () => {
	(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
	host = document.createElement("div");
	document.body.append(host);
	root = createRoot(host);
	await act(async () => root.render(<ConfirmDialog />));
});

afterEach(() => {
	act(() => root.unmount());
	host.remove();
});

const button = (label: string) =>
	[...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;

const ask = async (title: string) => {
	let answer!: Promise<boolean>;
	await act(async () => {
		answer = confirmDialog({ title, message: `${title}?`, confirmLabel: "Update", cancelLabel: "Leave as is" });
	});
	// Wrapped, or awaiting the helper would wait for the answer itself.
	return { answer };
};

describe("confirmDialog", () => {
	it("asks in the app's own dialog and answers yes from its button", async () => {
		const { answer } = await ask("Update links");
		expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Update links?");
		await act(async () => button("Update").click());
		expect(await answer).toBe(true);
		expect(document.querySelector('[role="alertdialog"]')).toBeNull();
	});

	it("answers no from the other button", async () => {
		const { answer } = await ask("Update links");
		await act(async () => button("Leave as is").click());
		expect(await answer).toBe(false);
	});

	it("asks one question at a time, in order", async () => {
		const { answer: first } = await ask("First");
		const { answer: second } = await ask("Second");
		expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("First?");
		await act(async () => button("Update").click());
		expect(await first).toBe(true);
		expect(document.querySelector('[role="alertdialog"]')?.textContent).toContain("Second?");
		await act(async () => button("Leave as is").click());
		expect(await second).toBe(false);
	});
});
