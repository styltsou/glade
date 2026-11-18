/**
 * Tabs and split views, as plain data.
 *
 * The window has one or two panes ("groups"). Each pane has its own tabs and
 * its own active tab; a pane closes when its last tab does. A tab shows a note,
 * a folder overview, or the "new tab" page. All operations return new state, so
 * they are easy to test and to persist.
 */

export interface Tab {
	id: string;
	/** Note path (relative to the root, or absolute for outside files). */
	path: string | null;
	/**
	 * Only meaningful when `path` is null: which folder overview this tab shows
	 * (`null` = the root, a string = a subfolder). `undefined` = the "new tab" page.
	 */
	folder?: string | null;
}

export interface Group {
	id: string;
	tabs: Tab[];
	activeId: string;
}

export interface TabsState {
	groups: Group[];
	/** Index of the pane that has focus. */
	focused: number;
	/** Share of the width the left pane takes in a split. */
	ratio: number;
}

export const MIN_RATIO = 0.25;
export const MAX_GROUPS = 2;

let counter = 0;
export function newId(prefix = "t"): string {
	counter += 1;
	return `${prefix}${Date.now().toString(36)}${counter}`;
}

export function makeTab(path: string | null = null, folder?: string | null): Tab {
	return folder === undefined ? { id: newId(), path } : { id: newId(), path, folder };
}

function makeGroup(tab: Tab = makeTab()): Group {
	return { id: newId("g"), tabs: [tab], activeId: tab.id };
}

export function initialTabs(path: string | null = null): TabsState {
	return { groups: [makeGroup(makeTab(path))], focused: 0, ratio: 0.5 };
}

export function focusedGroup(state: TabsState): Group {
	return state.groups[state.focused] ?? state.groups[0];
}

export function activeTabOf(group: Group): Tab {
	return group.tabs.find((t) => t.id === group.activeId) ?? group.tabs[0];
}

export function activeTab(state: TabsState): Tab {
	return activeTabOf(focusedGroup(state));
}

export function focusedPath(state: TabsState): string | null {
	return activeTab(state).path;
}

function mapGroup(state: TabsState, index: number, fn: (g: Group) => Group): TabsState {
	return { ...state, groups: state.groups.map((g, i) => (i === index ? fn(g) : g)) };
}

/** Where a note is already open. Prefers the focused pane. */
export function findOpen(state: TabsState, path: string): { group: number; tabId: string } | null {
	const order = state.groups.map((_, i) => i).sort((a, b) => (a === state.focused ? -1 : b === state.focused ? 1 : a - b));
	for (const gi of order) {
		const tab = state.groups[gi].tabs.find((t) => t.path === path);
		if (tab) return { group: gi, tabId: tab.id };
	}
	return null;
}

function reveal(state: TabsState, group: number, tabId: string): TabsState {
	return mapGroup({ ...state, focused: group }, group, (g) => ({ ...g, activeId: tabId }));
}

/**
 * Show `path` in the active tab of the focused pane. A note that is already
 * open somewhere is revealed instead of being opened twice, so two editors never
 * hold the same file.
 */
export function openInActive(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) return reveal(state, open.group, open.tabId);
	}
	const gi = state.focused;
	return mapGroup(state, gi, (g) => ({
		...g,
		tabs: g.tabs.map((t) => (t.id === g.activeId ? makeTabKeepingId(t.id, path) : t)),
	}));
}

function makeTabKeepingId(id: string, path: string | null, folder?: string | null): Tab {
	return folder === undefined ? { id, path } : { id, path, folder };
}

/** Show a folder overview in the active tab. */
export function openFolder(state: TabsState, folder: string | null): TabsState {
	return mapGroup(state, state.focused, (g) => ({
		...g,
		tabs: g.tabs.map((t) => (t.id === g.activeId ? makeTabKeepingId(t.id, null, folder) : t)),
	}));
}

function insertTabAfterActive(group: Group, tab: Tab): Group {
	const at = group.tabs.findIndex((t) => t.id === group.activeId);
	const tabs = [...group.tabs];
	tabs.splice(at + 1, 0, tab);
	return { ...group, tabs, activeId: tab.id };
}

/** Open `path` in a tab of its own in the focused pane (or reveal it). */
export function openInNewTab(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) return reveal(state, open.group, open.tabId);
	}
	return mapGroup(state, state.focused, (g) => insertTabAfterActive(g, makeTab(path)));
}

/** A blank "new tab" page in the focused pane. */
export function newTab(state: TabsState): TabsState {
	return openInNewTab(state, null);
}

/** Open `path` in the right pane (creating it), as a tab there. */
export function openToTheSide(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) return reveal(state, open.group, open.tabId);
	}
	if (state.groups.length < MAX_GROUPS) {
		return { ...state, groups: [...state.groups, makeGroup(makeTab(path))], focused: 1 };
	}
	return mapGroup({ ...state, focused: 1 }, 1, (g) => insertTabAfterActive(g, makeTab(path)));
}

export function activateTab(state: TabsState, group: number, tabId: string): TabsState {
	if (!state.groups[group]?.tabs.some((t) => t.id === tabId)) return state;
	return reveal(state, group, tabId);
}

export function focusGroup(state: TabsState, index: number): TabsState {
	return state.groups[index] && state.focused !== index ? { ...state, focused: index } : state;
}

function removeGroup(state: TabsState, index: number): TabsState {
	const groups = state.groups.filter((_, i) => i !== index);
	return { groups, focused: Math.min(state.focused > index ? state.focused - 1 : state.focused, groups.length - 1), ratio: 0.5 };
}

/**
 * Close a tab. A pane disappears with its last tab; the very last tab of the
 * window is replaced by a fresh "new tab" page instead.
 */
export function closeTab(state: TabsState, group: number, tabId: string): TabsState {
	const g = state.groups[group];
	if (!g) return state;
	const index = g.tabs.findIndex((t) => t.id === tabId);
	if (index === -1) return state;

	if (g.tabs.length === 1) {
		if (state.groups.length > 1) return removeGroup(state, group);
		return { ...state, groups: [makeGroup()], focused: 0 };
	}
	const tabs = g.tabs.filter((t) => t.id !== tabId);
	const activeId = g.activeId === tabId ? tabs[Math.min(index, tabs.length - 1)].id : g.activeId;
	return mapGroup(state, group, () => ({ ...g, tabs, activeId }));
}

/** Close whichever tab shows `path` (used when a note is deleted). */
export function closePathTab(state: TabsState, path: string): TabsState {
	const open = findOpen(state, path);
	return open ? closeTab(state, open.group, open.tabId) : state;
}

/**
 * Split: move the active tab into a new right pane. A lone tab stays where it is
 * and the new pane starts with a blank "new tab" page.
 */
export function splitActive(state: TabsState): TabsState {
	if (state.groups.length >= MAX_GROUPS) return state;
	const g = focusedGroup(state);
	if (g.tabs.length === 1) {
		return { ...state, groups: [...state.groups, makeGroup()], focused: 1 };
	}
	const moving = activeTabOf(g);
	const rest = g.tabs.filter((t) => t.id !== moving.id);
	const left: Group = { ...g, tabs: rest, activeId: rest[Math.max(0, g.tabs.indexOf(moving) - 1)].id };
	return { ...state, groups: [left, makeGroup(moving)], focused: 1 };
}

/** Move a tab to the other pane (creating it if needed). */
export function moveTabToOtherGroup(state: TabsState, group: number, tabId: string): TabsState {
	const from = state.groups[group];
	const tab = from?.tabs.find((t) => t.id === tabId);
	if (!from || !tab) return state;
	const to = group === 0 ? 1 : 0;
	let groups = [...state.groups];
	if (!groups[to]) {
		if (from.tabs.length === 1) return state; // nothing left behind to split from
		groups = group === 0 ? [...groups, makeGroup(tab)] : [makeGroup(tab), ...groups];
	} else {
		groups[to] = insertTabAfterActive(groups[to], tab);
	}
	// Remove from the source pane.
	const sourceIndex = groups.findIndex((g) => g.id === from.id);
	const remaining = groups[sourceIndex].tabs.filter((t) => t.id !== tabId);
	let next: TabsState = { ...state, groups, focused: groups.findIndex((g) => g.tabs.some((t) => t.id === tab.id)) };
	if (remaining.length === 0) {
		next = removeGroup(next, sourceIndex);
		next = { ...next, focused: Math.max(0, next.groups.findIndex((g) => g.tabs.some((t) => t.id === tab.id))) };
	} else {
		const activeId = groups[sourceIndex].activeId === tabId ? remaining[0].id : groups[sourceIndex].activeId;
		next = mapGroup(next, sourceIndex, (g) => ({ ...g, tabs: remaining, activeId }));
	}
	return next;
}

export function setRatio(state: TabsState, ratio: number): TabsState {
	return { ...state, ratio: Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, ratio)) };
}

export function reorder(state: TabsState, group: number, from: number, to: number): TabsState {
	const g = state.groups[group];
	if (!g || from === to || from < 0 || to < 0 || from >= g.tabs.length || to >= g.tabs.length) return state;
	const tabs = [...g.tabs];
	const [moved] = tabs.splice(from, 1);
	tabs.splice(to, 0, moved);
	return mapGroup(state, group, () => ({ ...g, tabs }));
}

function mapTabs(state: TabsState, fn: (t: Tab) => Tab): TabsState {
	return { ...state, groups: state.groups.map((g) => ({ ...g, tabs: g.tabs.map(fn) })) };
}

/** A note or folder was renamed or moved. */
export function renamePath(state: TabsState, from: string, to: string): TabsState {
	const prefix = `${from.replace(/\/$/, "")}/`;
	const fix = (p: string) => (p === from ? to : p.startsWith(prefix) ? `${to.replace(/\/$/, "")}/${p.slice(prefix.length)}` : p);
	return mapTabs(state, (t) => ({
		...t,
		path: t.path === null ? null : fix(t.path),
		folder: typeof t.folder === "string" ? fix(t.folder) : t.folder,
	}));
}

/** A note or folder was deleted: tabs showing it become blank "new tab" pages. */
export function removePath(state: TabsState, path: string): TabsState {
	const prefix = `${path.replace(/\/$/, "")}/`;
	const gone = (p: string | null | undefined) => typeof p === "string" && (p === path || p.startsWith(prefix));
	return mapTabs(state, (t) => (gone(t.path) || gone(t.folder) ? { id: t.id, path: null } : t));
}

export interface SavedTabs {
	groups: (string | null)[][];
	activeIndex: number[];
	focused: number;
	ratio: number;
}

/** Paths per pane, for saving. Folder overviews are not saved. */
export function toSaved(state: TabsState): SavedTabs {
	return {
		groups: state.groups.map((g) => g.tabs.map((t) => t.path)),
		activeIndex: state.groups.map((g) => Math.max(0, g.tabs.findIndex((t) => t.id === g.activeId))),
		focused: state.focused,
		ratio: state.ratio,
	};
}

export function fromSaved(saved: Partial<SavedTabs> | null | undefined, exists: (path: string) => boolean): TabsState | null {
	if (!saved || !Array.isArray(saved.groups) || saved.groups.length === 0) return null;
	const groups: Group[] = saved.groups
		.slice(0, MAX_GROUPS)
		.map((paths, gi) => {
			const tabs = (Array.isArray(paths) ? paths : [])
				.map((p) => makeTab(typeof p === "string" && (p.startsWith("/") || exists(p)) ? p : null))
				// Drop blank pages: they carry nothing worth restoring.
				.filter((t, _i, all) => t.path !== null || all.length === 1);
			if (tabs.length === 0) return null;
			const wanted = saved.activeIndex?.[gi] ?? 0;
			const active = tabs[Math.min(Math.max(wanted, 0), tabs.length - 1)];
			return { id: newId("g"), tabs, activeId: active.id } as Group;
		})
		.filter((g): g is Group => g !== null);
	if (groups.length === 0) return null;
	return {
		groups,
		focused: Math.min(Math.max(saved.focused ?? 0, 0), groups.length - 1),
		ratio: Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, saved.ratio ?? 0.5)),
	};
}
