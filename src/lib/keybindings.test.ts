import { describe, expect, it } from "vitest";
import { KEYBINDINGS, TAB_DIGITS, matchesShortcut, tabJumpTarget, bindingFor } from "./keybindings";

const press = (init: KeyboardEventInit) => new KeyboardEvent("keydown", init);

describe("tab jump shortcuts", () => {
	it("binds Ctrl+1 to Ctrl+9, and 9 means the last tab", () => {
		for (const d of TAB_DIGITS) {
			const kb = bindingFor(`go-to-tab-${d}`);
			expect(kb && matchesShortcut(press({ code: `Digit${d}`, ctrlKey: true }), kb)).toBe(true);
		}
		expect(tabJumpTarget("go-to-tab-3")).toBe(3);
		expect(tabJumpTarget("go-to-tab-9")).toBe("last");
		expect(tabJumpTarget("new-tab")).toBeNull();
	});

	it("does not fire with extra modifiers", () => {
		const kb = bindingFor("go-to-tab-1")!;
		expect(matchesShortcut(press({ code: "Digit1", ctrlKey: true, shiftKey: true }), kb)).toBe(false);
		expect(matchesShortcut(press({ code: "Digit1" }), kb)).toBe(false);
	});
});

describe("registry", () => {
	it("gives no two commands the same shortcut", () => {
		const seen = new Map<string, string>();
		for (const kb of KEYBINDINGS) {
			const id = [kb.code ?? kb.key, kb.mod, kb.shiftKey, kb.altKey].join("|");
			expect(seen.get(id) ?? kb.command).toBe(kb.command);
			seen.set(id, kb.command);
		}
	});
});
