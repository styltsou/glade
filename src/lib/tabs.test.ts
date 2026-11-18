import { describe, expect, it } from "vitest";
import * as T from "./tabs";

const paths = (s: T.TabsState) => s.tabs.map((t) => t.panes.map((p) => p.path));

describe("opening notes", () => {
	it("navigates the focused pane of the active tab", () => {
		let s = T.initialTabs();
		s = T.openInActive(s, "a.md");
		s = T.openInActive(s, "b.md");
		expect(paths(s)).toEqual([["b.md"]]);
	});

	it("reveals a note that is already open instead of opening it twice", () => {
		let s = T.initialTabs("a.md");
		s = T.openInNewTab(s, "b.md");
		s = T.openInActive(s, "a.md");
		expect(paths(s)).toEqual([["a.md"], ["b.md"]]);
		expect(T.focusedPath(s)).toBe("a.md");
	});

	it("opens in a new tab right after the active one", () => {
		let s = T.initialTabs("a.md");
		s = T.openInNewTab(s, "b.md");
		s = T.activateTab(s, s.tabs[0].id);
		s = T.openInNewTab(s, "c.md");
		expect(paths(s)).toEqual([["a.md"], ["c.md"], ["b.md"]]);
		expect(T.focusedPath(s)).toBe("c.md");
	});
});

describe("split views", () => {
	it("opens to the side, splitting the tab", () => {
		let s = T.initialTabs("a.md");
		s = T.openToTheSide(s, "b.md");
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
		expect(T.focusedPath(s)).toBe("b.md");
	});

	it("reuses the other pane when already split", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.openToTheSide(s, "c.md");
		expect(paths(s)).toEqual([["a.md", "c.md"]]);
	});

	it("splits with an empty pane and never goes past two", () => {
		let s = T.split(T.initialTabs("a.md"));
		expect(paths(s)).toEqual([["a.md", null]]);
		expect(T.split(s)).toBe(s);
	});

	it("focuses an existing pane for a note shown in the other pane", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.openInActive(s, "a.md");
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
		expect(T.focusedPath(s)).toBe("a.md");
	});

	it("closes one pane and keeps the other", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.closePane(s, 0);
		expect(paths(s)).toEqual([["b.md"]]);
	});

	it("clamps the divider", () => {
		let s = T.split(T.initialTabs("a.md"));
		s = T.setRatio(s, s.tabs[0].id, 0.02);
		expect(s.tabs[0].ratio).toBe(T.MIN_RATIO);
		s = T.setRatio(s, s.tabs[0].id, 0.99);
		expect(s.tabs[0].ratio).toBe(1 - T.MIN_RATIO);
	});
});

describe("closing and reordering", () => {
	it("activates a neighbour when the active tab closes", () => {
		let s = T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		const b = s.tabs[1].id;
		s = T.activateTab(s, b);
		s = T.closeTab(s, b);
		expect(paths(s)).toEqual([["a.md"], ["c.md"]]);
		expect(T.focusedPath(s)).toBe("c.md");
	});

	it("never closes the last tab; it returns to the overview", () => {
		const s = T.closeTab(T.initialTabs("a.md"), T.initialTabs().activeId);
		expect(s.tabs).toHaveLength(1);
		const only = T.initialTabs("a.md");
		expect(paths(T.closeTab(only, only.activeId))).toEqual([[null]]);
	});

	it("reorders tabs", () => {
		let s = T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		s = T.reorder(s, 0, 2);
		expect(paths(s)).toEqual([["b.md"], ["c.md"], ["a.md"]]);
	});
});

describe("file changes", () => {
	it("follows renames, including folders", () => {
		let s = T.openToTheSide(T.initialTabs("docs/a.md"), "docs/sub/b.md");
		s = T.renamePath(s, "docs", "notes");
		expect(paths(s)).toEqual([["notes/a.md", "notes/sub/b.md"]]);
		s = T.renamePath(s, "notes/a.md", "notes/x.md");
		expect(paths(s)).toEqual([["notes/x.md", "notes/sub/b.md"]]);
	});

	it("falls back to the overview when a note is deleted", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.removePath(s, "a.md");
		expect(paths(s)).toEqual([[null, "b.md"]]);
	});
});

describe("saving", () => {
	it("round-trips and drops notes that no longer exist", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "gone.md");
		s = T.openInNewTab(s, "c.md");
		const saved = T.toSaved(s);
		const restored = T.fromSaved(saved, (p) => p !== "gone.md")!;
		expect(paths(restored)).toEqual([["a.md", null], ["c.md"]]);
		expect(T.focusedPath(restored)).toBe("c.md");
	});

	it("returns null for empty or invalid saves", () => {
		expect(T.fromSaved(null, () => true)).toBeNull();
		expect(T.fromSaved({ tabs: [], active: 0 }, () => true)).toBeNull();
	});
});
