import { describe, expect, it } from "vitest";
import * as T from "./tabs";

/** Paths per group, for compact assertions. */
const paths = (s: T.TabsState) => s.groups.map((g) => g.tabs.map((t) => t.path));
const active = (s: T.TabsState, g = s.focused) => T.activeTabOf(s.groups[g]).path;

describe("opening notes", () => {
	it("navigates the active tab of the focused pane", () => {
		let s = T.openInActive(T.initialTabs(), "a.md");
		s = T.openInActive(s, "b.md");
		expect(paths(s)).toEqual([["b.md"]]);
	});

	it("reveals a note that is already open instead of opening it twice", () => {
		let s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		s = T.openInActive(s, "a.md");
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
		expect(active(s)).toBe("a.md");
	});

	it("opens new tabs right after the active one", () => {
		let s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		s = T.activateTab(s, 0, s.groups[0].tabs[0].id);
		s = T.openInNewTab(s, "c.md");
		expect(paths(s)).toEqual([["a.md", "c.md", "b.md"]]);
	});

	it("shows a folder overview in the active tab", () => {
		const s = T.openFolder(T.initialTabs("a.md"), "docs");
		expect(T.activeTab(s)).toMatchObject({ path: null, folder: "docs" });
	});
});

describe("panes with their own tabs", () => {
	it("opens to the side as a new pane", () => {
		const s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		expect(paths(s)).toEqual([["a.md"], ["b.md"]]);
		expect(s.focused).toBe(1);
	});

	it("opens to the side in the other pane when already split", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.focusGroup(s, 0);
		s = T.openToTheSide(s, "c.md");
		expect(paths(s)).toEqual([["a.md"], ["b.md", "c.md"]]);
		expect(active(s)).toBe("c.md");
		expect(s.focused).toBe(1);
	});

	it("keeps tabs per pane when opening in the focused one", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.focusGroup(s, 0);
		s = T.openInNewTab(s, "c.md");
		expect(paths(s)).toEqual([["a.md", "c.md"], ["b.md"]]);
	});

	it("opens a note in the focused pane even if the other pane has it", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.openInNewTab(s, "a.md");
		expect(paths(s)).toEqual([["a.md"], ["b.md", "a.md"]]);
		expect(s.focused).toBe(1);
	});

	it("keeps one tab per note within a pane", () => {
		let s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		s = T.openInNewTab(s, "a.md");
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
		expect(active(s)).toBe("a.md");
		s = T.openInActive(s, "b.md");
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
		expect(active(s)).toBe("b.md");
	});

	it("selects the note's tab in the other pane when opening to the side", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.focusGroup(s, 0);
		s = T.openToTheSide(s, "b.md");
		expect(paths(s)).toEqual([["a.md"], ["b.md"]]);
		expect(s.focused).toBe(1);
	});

	it("splitting copies the active tab into a new pane", () => {
		let s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		s = T.splitActive(s);
		expect(paths(s)).toEqual([["a.md", "b.md"], ["b.md"]]);
		expect(s.focused).toBe(1);
		expect(s.groups[1].tabs[0].id).not.toBe(s.groups[0].tabs[1].id);
		expect(T.splitActive(s)).toBe(s);
	});

	it("splitting a lone tab copies it too", () => {
		const s = T.splitActive(T.initialTabs("a.md"));
		expect(paths(s)).toEqual([["a.md"], ["a.md"]]);
	});

	it("moving a tab into a pane that has the note selects it there", () => {
		let s = T.splitActive(T.openInNewTab(T.initialTabs("a.md"), "b.md"));
		s = T.moveTabToOtherGroup(s, 0, s.groups[0].tabs[1].id);
		expect(paths(s)).toEqual([["a.md"], ["b.md"]]);
		expect(s.focused).toBe(1);
	});

	it("closes a deleted note in every pane", () => {
		let s = T.splitActive(T.openInNewTab(T.initialTabs("a.md"), "b.md"));
		s = T.closePathTab(s, "b.md");
		expect(paths(s)).toEqual([["a.md"]]);
	});

	it("moves a tab to the other pane and removes an emptied pane", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.moveTabToOtherGroup(s, 1, s.groups[1].tabs[0].id);
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
	});

	it("clamps the divider", () => {
		let s = T.splitActive(T.initialTabs("a.md"));
		expect(T.setRatio(s, 0.01).ratio).toBe(T.MIN_RATIO);
		expect(T.setRatio(s, 0.99).ratio).toBe(1 - T.MIN_RATIO);
	});
});

describe("closing", () => {
	it("closes the pane with its last tab", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.closeTab(s, 1, s.groups[1].tabs[0].id);
		expect(paths(s)).toEqual([["a.md"]]);
		expect(s.focused).toBe(0);
	});

	it("keeps the pane while it still has tabs and activates a neighbour", () => {
		let s = T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		const b = s.groups[0].tabs[1].id;
		s = T.activateTab(s, 0, b);
		s = T.closeTab(s, 0, b);
		expect(paths(s)).toEqual([["a.md", "c.md"]]);
		expect(active(s)).toBe("c.md");
	});

	it("closing the last tab leaves no tabs, and opening a note adds one again", () => {
		const only = T.initialTabs("a.md");
		const s = T.closeTab(only, 0, only.groups[0].tabs[0].id);
		expect(paths(s)).toEqual([[]]);
		expect(T.activeTab(s).path).toBeNull();
		expect(T.splitActive(s)).toBe(s);
		expect(paths(T.openInActive(s, "b.md"))).toEqual([["b.md"]]);
		expect(active(T.openInActive(s, "b.md"))).toBe("b.md");
		expect(paths(T.openFolder(s, "docs"))).toEqual([[null]]);
		expect(T.toSaved(s).groups).toEqual([[]]);
	});

	it("starts with no tabs when there is nothing to open", () => {
		expect(paths(T.initialTabs())).toEqual([[]]);
	});

	it("closes the tab showing a deleted path", () => {
		let s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		s = T.closePathTab(s, "b.md");
		expect(paths(s)).toEqual([["a.md"]]);
	});

	it("reorders tabs within a pane", () => {
		let s = T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		s = T.reorder(s, 0, 0, 2);
		expect(paths(s)).toEqual([["b.md", "c.md", "a.md"]]);
	});
});

describe("file changes", () => {
	it("follows renames, including folders", () => {
		let s = T.openToTheSide(T.initialTabs("docs/a.md"), "docs/sub/b.md");
		s = T.renamePath(s, "docs", "notes");
		expect(paths(s)).toEqual([["notes/a.md"], ["notes/sub/b.md"]]);
	});

	it("turns tabs for deleted notes into blank pages", () => {
		const s = T.removePath(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "a.md");
		expect(paths(s)).toEqual([[null, "b.md"]]);
	});
});

describe("saving", () => {
	it("round-trips and drops notes that no longer exist", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "gone.md");
		s = T.openInNewTab(s, "c.md");
		const restored = T.fromSaved(T.toSaved(s), (p) => p !== "gone.md")!;
		expect(paths(restored)).toEqual([["a.md"], ["c.md"]]);
		expect(restored.focused).toBe(1);
	});

	it("returns null for empty or invalid saves", () => {
		expect(T.fromSaved(null, () => true)).toBeNull();
		expect(T.fromSaved({ groups: [] }, () => true)).toBeNull();
	});
});
