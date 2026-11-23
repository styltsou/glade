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
		expect(T.closedEntry(s, 0, s.groups[0].activeId)).toEqual({ path: null, folder: "docs", back: [{ path: "a.md" }] });
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

describe("history per tab", () => {
	const tab = (s: T.TabsState) => T.activeTab(s);
	const view = (s: T.TabsState) => T.viewOf(tab(s));
	const back = (s: T.TabsState) => T.goInHistory(s, "back");
	const forward = (s: T.TabsState) => T.goInHistory(s, "forward");

	it("goes back and forward through what one tab showed", () => {
		let s = T.openInActive(T.initialTabs("a.md"), "b.md");
		s = T.openFolder(s, "docs");
		expect(T.historyTarget(s, "back")?.view).toEqual({ path: "b.md" });
		s = back(s);
		expect(view(s)).toEqual({ path: "b.md" });
		s = back(s);
		expect(view(s)).toEqual({ path: "a.md" });
		expect(T.historyTarget(s, "back")).toBeNull();
		s = forward(s);
		s = forward(s);
		expect(view(s)).toEqual({ path: null, folder: "docs" });
		expect(T.historyTarget(s, "forward")).toBeNull();
	});

	it("drops the way forward on going somewhere new", () => {
		let s = T.openInActive(T.initialTabs("a.md"), "b.md");
		s = T.openInActive(back(s), "c.md");
		expect(tab(s).back).toEqual([{ path: "a.md" }]);
		expect(T.historyTarget(s, "forward")).toBeNull();
	});

	it("keeps each tab's history its own, and adds nothing for switching tabs", () => {
		let s = T.openInActive(T.initialTabs("a.md"), "b.md");
		s = T.openInNewTab(s, "c.md");
		expect(tab(s).back).toBeUndefined();
		s = T.activateTab(s, 0, s.groups[0].tabs[0].id);
		expect(tab(s).back).toEqual([{ path: "a.md" }]);
		// Opening a note that is open already only switches to its tab.
		s = T.openInActive(s, "c.md");
		expect(view(s)).toEqual({ path: "c.md" });
		expect(tab(s).back).toBeUndefined();
	});

	it("passes over a place that is open in another tab now", () => {
		let s = T.openInActive(T.initialTabs("a.md"), "b.md");
		s = T.openInActive(s, "c.md");
		s = T.openInNewTab(s, "b.md");
		s = T.activateTab(s, 0, s.groups[0].tabs[0].id);
		expect(T.historyTarget(s, "back")).toEqual({ view: { path: "a.md" }, steps: 2 });
		s = back(s);
		expect(view(s)).toEqual({ path: "a.md" });
		expect(paths(s)).toEqual([["a.md", "b.md"]]);
		expect(tab(s).forward).toEqual([{ path: "c.md" }]);
	});

	it("goes with the tab to the other pane", () => {
		let s = T.openInActive(T.initialTabs("a.md"), "b.md");
		s = T.openInNewTab(s, "c.md");
		s = T.moveTabToOtherGroup(s, 0, s.groups[0].tabs[0].id);
		expect(s.groups[1].tabs[0].back).toEqual([{ path: "a.md" }]);
	});

	it("remembers no blank page, and at most MAX_HISTORY places", () => {
		let s = T.newTab(T.initialTabs());
		s = T.openInActive(s, "a.md");
		expect(tab(s).back).toBeUndefined();
		for (let i = 0; i < T.MAX_HISTORY + 10; i++) s = T.openInActive(s, `n${i}.md`);
		expect(tab(s).back).toHaveLength(T.MAX_HISTORY);
	});

	it("follows renames and forgets deleted places", () => {
		let s = T.openInActive(T.initialTabs("a.md"), "dir/b.md");
		s = T.openInActive(s, "a2.md");
		s = T.openInActive(s, "a.md");
		s = back(s);
		s = T.renamePath(s, "dir", "folder");
		expect(tab(s).back).toEqual([{ path: "a.md" }, { path: "folder/b.md" }]);
		// a2 goes: what was before and after it are the same place now, and one.
		s = T.openInActive(T.initialTabs("a.md"), "b.md");
		s = T.openInActive(s, "a.md");
		s = T.openInActive(s, "c.md");
		s = T.removePath(s, "a.md");
		expect(tab(s).back).toEqual([{ path: "b.md" }]);
		s = T.openInActive(T.initialTabs("b.md"), "a.md");
		s = T.openInActive(s, "b.md");
		s = T.removePath(s, "a.md");
		expect(tab(s).back).toBeUndefined();
	});

	it("comes back with a reopened tab", () => {
		let s = T.openInActive(T.initialTabs("a.md"), "b.md");
		s = T.openInNewTab(s, "z.md");
		const closed = T.closedEntry(s, 0, s.groups[0].tabs[0].id)!;
		s = T.closeTab(s, 0, s.groups[0].tabs[0].id);
		s = T.reopenTab(s, closed);
		expect(view(s)).toEqual({ path: "b.md" });
		expect(tab(s).back).toEqual([{ path: "a.md" }]);
		expect(T.renameClosed([closed], "a.md", "x.md")[0].back).toEqual([{ path: "x.md" }]);
		expect(T.removeClosed([closed], "a.md")[0].back).toBeUndefined();
	});
});

describe("pinned tabs", () => {
	const pin = (s: T.TabsState, path: string, pinned = true) =>
		T.setPinned(s, 0, s.groups[0].tabs.find((t) => t.path === path)!.id, pinned);
	const three = () => T.openInNewTab(T.openInNewTab(T.initialTabs("a.md"), "b.md"), "c.md");

	it("go first, in the order pinned, and back among the rest when unpinned", () => {
		let s = pin(three(), "c.md");
		expect(paths(s)).toEqual([["c.md", "a.md", "b.md"]]);
		s = pin(s, "b.md");
		expect(paths(s)).toEqual([["c.md", "b.md", "a.md"]]);
		expect(T.pinnedCount(s.groups[0])).toBe(2);
		s = pin(s, "c.md", false);
		expect(paths(s)).toEqual([["b.md", "c.md", "a.md"]]);
		expect(active(s)).toBe("c.md");
	});

	it("keep their note: what is opened from one goes to a new tab after the pinned ones", () => {
		let s = pin(three(), "a.md");
		s = T.activateTab(s, 0, s.groups[0].tabs[0].id);
		s = T.openInActive(s, "d.md");
		expect(paths(s)).toEqual([["a.md", "d.md", "b.md", "c.md"]]);
		expect(active(s)).toBe("d.md");
		s = T.activateTab(s, 0, s.groups[0].tabs[0].id);
		s = T.openFolder(s, "docs");
		expect(s.groups[0].tabs[0].path).toBe("a.md");
		expect(T.activeTab(s).folder).toBe("docs");
		s = T.activateTab(s, 0, s.groups[0].tabs[0].id);
		expect(T.historyTarget(s, "back")).toBeNull();
	});

	it("stay when the others are closed", () => {
		const s = pin(three(), "a.md");
		const b = s.groups[0].tabs.find((t) => t.path === "b.md")!.id;
		expect(paths(T.closeTabsAround(s, 0, b, "others").state)).toEqual([["a.md", "b.md"]]);
		const a = s.groups[0].tabs[0].id;
		expect(paths(T.closeTabsAround(s, 0, a, "right").state)).toEqual([["a.md"]]);
		// Closing it directly still works.
		expect(paths(T.closeTab(s, 0, a))).toEqual([["b.md", "c.md"]]);
	});

	it("can't be dragged among the others, nor the others among them", () => {
		let s = pin(pin(three(), "a.md"), "b.md");
		s = T.reorder(s, 0, 2, 0);
		expect(paths(s)).toEqual([["a.md", "b.md", "c.md"]]);
		s = T.reorder(s, 0, 0, 2);
		expect(paths(s)).toEqual([["b.md", "a.md", "c.md"]]);
		s = T.dropView(s, { path: "d.md" }, { kind: "strip", group: 0, index: 0, x: 0 });
		expect(paths(s)).toEqual([["b.md", "a.md", "d.md", "c.md"]]);
	});

	it("are saved, come back pinned when reopened, and unpin when their note is deleted", () => {
		const s = pin(three(), "b.md");
		const saved = T.toSaved(s);
		expect(saved.pinned).toEqual([1]);
		const back = T.fromSaved(saved, () => true)!;
		expect(back.groups[0].tabs.map((t) => !!t.pinned)).toEqual([true, false, false]);

		const id = s.groups[0].tabs[0].id;
		const closed = T.closedEntry(s, 0, id)!;
		expect(closed.pinned).toBe(true);
		const reopened = T.reopenTab(T.closeTab(s, 0, id), closed);
		expect(reopened.groups[0].tabs[0]).toMatchObject({ path: "b.md", pinned: true });

		const removed = T.removePath(pin(s, "c.md"), "b.md");
		expect(removed.groups[0].tabs.map((t) => [t.path, !!t.pinned])).toEqual([["c.md", true], [null, false], ["a.md", false]]);
	});
});

describe("pinning a blank page", () => {
	it("pins it as the root folder overview it shows, unless that is open elsewhere", () => {
		let s = T.newTab(T.initialTabs("a.md"));
		expect(T.canPin(s, T.activeTab(s))).toBe(true);
		s = T.setPinned(s, 0, s.groups[0].activeId, true);
		expect(T.activeTab(s)).toMatchObject({ path: null, folder: null, pinned: true });
		expect(paths(s)).toEqual([[null, "a.md"]]);

		let t = T.openFolder(T.initialTabs("a.md"), null);
		t = T.newTab(t);
		expect(T.canPin(t, T.activeTab(t))).toBe(false);
		expect(T.setPinned(t, 0, t.groups[0].activeId, true)).toBe(t);
	});
});
