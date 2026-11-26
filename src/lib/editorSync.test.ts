import { describe, expect, it } from "vitest";
import { shouldResetEditor } from "./editorSync";

const base = { pathChanged: false, storedBody: "a", lastSaved: "a", editorMarkdown: "a" };

describe("shouldResetEditor", () => {
	it("loads a note that was just opened", () => {
		expect(shouldResetEditor({ ...base, pathChanged: true })).toBe(true);
	});

	it("leaves the editor alone when nothing changed", () => {
		expect(shouldResetEditor(base)).toBe(false);
	});

	it("keeps what was typed since the last save when something unrelated changes, like the scroll position", () => {
		expect(shouldResetEditor({ ...base, editorMarkdown: "a, then more" })).toBe(false);
	});

	it("keeps the editor when its own save comes back, even if more was typed meanwhile", () => {
		expect(shouldResetEditor({ storedBody: "ab", lastSaved: "ab", editorMarkdown: "abc", pathChanged: false })).toBe(false);
	});

	it("shows a body reloaded from disk", () => {
		expect(shouldResetEditor({ ...base, storedBody: "changed elsewhere" })).toBe(true);
	});

	it("does not reload what the editor already shows", () => {
		expect(shouldResetEditor({ ...base, storedBody: "b", editorMarkdown: "b" })).toBe(false);
	});
});
