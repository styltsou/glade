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

	it("focuses a note already open in the other pane instead of opening it twice", () => {
		let s = T.openToTheSide(T.initialTabs("a.md"), "b.md");
		s = T.openInNewTab(s, "a.md");
		expect(paths(s)).toEqual([["a.md"], ["b.md"]]);
		expect(s.focused).toBe(0);
		s = T.openToTheSide(s, "b.md");
		expect(s.focused).toBe(1);
	});

	it("focuses a folder overview already open anywhere", () => {
		let s = T.openFolder(T.initialTabs(), "docs");
		s = T.openToTheSide(s, "a.md");
		s = T.openFolder(s, "docs");
		expect(s.focused).toBe(0);
		expect(T.activeTab(s).folder).toBe("docs");
		expect(paths(s)).toEqual([[null], ["a.md"]]);
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

	it("splitting moves the active tab into a new pane", () => {
		let s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		s = T.splitActive(s);
		expect(paths(s)).toEqual([["a.md"], ["b.md"]]);
		expect(s.focused).toBe(1);
		expect(T.splitActive(s)).toBe(s);
	});

	it("splitting a lone tab gives a blank new pane", () => {
		const s = T.splitActive(T.initialTabs("a.md"));
		expect(paths(s)).toEqual([["a.md"], [null]]);
	});

	it("restoring a session drops a note's duplicate tabs", () => {
		const s = T.fromSaved({ groups: [["a.md", "b.md"], ["b.md", "c.md"]], activeIndex: [0, 0], focused: 0, ratio: 0.5 }, () => true);
		expect(s && paths(s)).toEqual([["a.md", "b.md"], ["c.md"]]);
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

	it("closes all other tabs and activates the one that stays", () => {
		let s = T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		const b = s.groups[0].tabs[1].id;
		const { state, closedIds } = T.closeTabsAround(s, 0, b, "others");
		expect(paths(state)).toEqual([["b.md"]]);
		expect(active(state)).toBe("b.md");
		expect(closedIds).toHaveLength(2);
	});

	it("closes only the tabs to the right and keeps the active one if it stays", () => {
		let s = T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		const [a, b] = s.groups[0].tabs.map((t) => t.id);
		s = T.activateTab(s, 0, a);
		const keepActive = T.closeTabsAround(s, 0, b, "right");
		expect(paths(keepActive.state)).toEqual([["a.md", "b.md"]]);
		expect(active(keepActive.state)).toBe("a.md");
		// If the active tab is one of those closed, the clicked tab takes over.
		const c = s.groups[0].tabs[2].id;
		const onRight = T.closeTabsAround(T.activateTab(s, 0, c), 0, a, "right");
		expect(paths(onRight.state)).toEqual([["a.md"]]);
		expect(active(onRight.state)).toBe("a.md");
	});

	it("does nothing when there is nothing to close", () => {
		const s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		const last = s.groups[0].tabs[1].id;
		expect(T.closeTabsAround(s, 0, last, "right")).toEqual({ state: s, closedIds: [] });
		expect(T.closeTabsAround(s, 0, "missing", "others").closedIds).toEqual([]);
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

describe("drag and drop", () => {
	const strip = (group: number, index: number): T.TabDrop => ({ kind: "strip", group, index, x: 0 });
	const pane = (group: number, zone: "center" | "left" | "right"): T.TabDrop => ({ kind: "pane", group, zone });

	it("reorders within a tab bar", () => {
		let s = T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		const a = s.groups[0].tabs[0].id;
		s = T.dropTab(s, 0, a, strip(0, 3));
		expect(paths(s)).toEqual([["b.md", "c.md", "a.md"]]);
		expect(active(s)).toBe("a.md");
		s = T.dropTab(s, 0, a, strip(0, 0));
		expect(paths(s)).toEqual([["a.md", "b.md", "c.md"]]);
	});

	it("splits a tab off to the right or left", () => {
		const base = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		const b = base.groups[0].tabs[1].id;
		const right = T.dropTab(base, 0, b, pane(0, "right"));
		expect(paths(right)).toEqual([["a.md"], ["b.md"]]);
		expect(right.focused).toBe(1);
		const left = T.dropTab(base, 0, b, pane(0, "left"));
		expect(paths(left)).toEqual([["b.md"], ["a.md"]]);
		expect(left.focused).toBe(0);
	});

	it("won't split off a pane's only tab", () => {
		const s = T.initialTabs("a.md");
		expect(paths(T.dropTab(s, 0, s.groups[0].tabs[0].id, pane(0, "right")))).toEqual([["a.md"]]);
	});

	it("moves a tab into the other pane at a position, closing an emptied pane", () => {
		let s = T.openToTheSide(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");
		s = T.dropTab(s, 0, s.groups[0].tabs[0].id, strip(1, 0));
		expect(paths(s)).toEqual([["b.md"], ["a.md", "c.md"]]);
		s = T.dropTab(s, 0, s.groups[0].tabs[0].id, pane(1, "center"));
		expect(paths(s)).toEqual([["a.md", "b.md", "c.md"]]);
		expect(active(s)).toBe("b.md");
	});

	it("opens a dragged note where it is dropped, or moves its existing tab", () => {
		let s = T.dropView(T.initialTabs("a.md"), { path: "b.md" }, pane(0, "right"));
		expect(paths(s)).toEqual([["a.md"], ["b.md"]]);
		s = T.dropView(s, { path: "b.md" }, strip(0, 0));
		expect(paths(s)).toEqual([["b.md", "a.md"]]);
		s = T.dropView(s, { path: null, folder: "docs" }, pane(0, "center"));
		expect(paths(s)).toEqual([["b.md", null, "a.md"]]);
		expect(T.activeTab(s).folder).toBe("docs");
	});
});

describe("folders to the side", () => {
	it("opens a folder overview in the other pane, or focuses it where open", () => {
		let s = T.openFolderToTheSide(T.initialTabs("a.md"), "docs");
		expect(paths(s)).toEqual([["a.md"], [null]]);
		expect(T.activeTab(s).folder).toBe("docs");
		s = T.focusGroup(s, 0);
		s = T.openFolderToTheSide(s, "docs");
		expect(s.focused).toBe(1);
		expect(paths(s)).toEqual([["a.md"], [null]]);
	});
});

describe("root folder tab", () => {
	it("a folder window starts with the root overview tab", () => {
		const s = T.rootTabs();
		expect(s.groups[0].tabs).toHaveLength(1);
		expect(T.activeTab(s)).toMatchObject({ path: null, folder: null });
		expect(T.isPristine(s)).toBe(true);
	});

	it("is no longer pristine once something else is open", () => {
		expect(T.isPristine(T.openInNewTab(T.rootTabs(), "a.md"))).toBe(false);
		expect(T.isPristine(T.initialTabs())).toBe(true);
	});

	it("saves and restores folder overview tabs", () => {
		let s = T.rootTabs();
		s = T.openInNewTab(s, "a.md");
		s = T.openInNewTab(s, null);
		s = T.openFolder(s, "docs");
		const saved = T.toSaved(s);
		expect(saved.groups[0]).toEqual(["./", "a.md", "docs/"]);
		const back = T.fromSaved(saved, () => true, (f) => f === "docs")!;
		expect(back.groups[0].tabs.map((t) => [t.path, t.folder])).toEqual([[null, null], ["a.md", undefined], [null, "docs"]]);
	});

	it("drops folder tabs whose folder is gone", () => {
		const back = T.fromSaved({ groups: [["gone/", "a.md"]] }, () => true, () => false)!;
		expect(back.groups[0].tabs.map((t) => t.path)).toEqual(["a.md"]);
	});
});

describe("reopening closed tabs", () => {
	it("remembers notes and folders, but not blank tabs", () => {
		let s = T.openInNewTab(T.initialTabs("a.md"), "b.md");
		const b = s.groups[0].tabs[1].id;
		expect(T.closedEntry(s, 0, b)).toEqual({ path: "b.md" });
		s = T.newTab(s);
		expect(T.closedEntry(s, 0, s.groups[0].activeId)).toBeNull();
		s = T.openFolder(T.initialTabs("a.md"), "docs");
		expect(T.closedEntry(s, 0, s.groups[0].activeId)).toEqual({ path: null, folder: "docs" });
	});

	it("brings a note back next to the active tab", () => {
		const s = T.reopenTab(T.initialTabs("a.md"), { path: "b.md" });
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
		expect(active(s)).toBe("b.md");
	});

	it("knows when a tab is already open", () => {
		const s = T.initialTabs("a.md");
		expect(T.isOpenElsewhere(s, { path: "a.md" })).toBe(true);
		expect(T.isOpenElsewhere(s, { path: "b.md" })).toBe(false);
	});
});

describe("closed tab history", () => {
	it("round-trips through its saved form", () => {
		const list: T.ClosedTab[] = [{ path: "a.md" }, { path: null, folder: "docs" }, { path: null, folder: null }];
		expect(list.map(T.encodeClosed).map(T.decodeClosed)).toEqual(list);
	});

	it("drops entries whose note or folder is gone", () => {
		const list: T.ClosedTab[] = [{ path: "a.md" }, { path: "gone.md" }, { path: null, folder: "docs" }, { path: null, folder: "nope" }];
		const kept = T.pruneClosed(list, (p) => p === "a.md", (f) => f === "docs");
		expect(kept).toEqual([{ path: "a.md" }, { path: null, folder: "docs" }]);
	});

	it("follows renames and deletes, including inside folders", () => {
		const list: T.ClosedTab[] = [{ path: "docs/a.md" }, { path: "b.md" }, { path: null, folder: "docs" }];
		expect(T.renameClosed(list, "docs", "notes")).toEqual([{ path: "notes/a.md" }, { path: "b.md" }, { path: null, folder: "notes" }]);
		expect(T.removeClosed(list, "docs")).toEqual([{ path: "b.md" }]);
	});
});
