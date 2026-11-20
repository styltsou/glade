/**
 * Tabs and split views, as plain data.
 *
 * Each note and each folder overview is open at most once in the window:
 * opening it again focuses its tab, in whichever pane it is. Blank "new tab"
 * pages are the exception. Splitting moves the active tab into the new pane.
 *
 * The window has one or two panes ("groups"). Each pane has its own tabs and
 * its own active tab; a pane closes when its last tab does. The last pane can
 * have no tabs at all, and then shows Home. A tab shows a note, a folder
 * overview, or the "new tab" page. All operations return new state, so
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

function emptyGroup(): Group {
	return { id: newId("g"), tabs: [], activeId: "" };
}

/** Start with `path` open, or with no tabs (Home) when there is none. */
export function initialTabs(path: string | null = null): TabsState {
	return { groups: [path === null ? emptyGroup() : makeGroup(makeTab(path))], focused: 0, ratio: 0.5 };
}

/** A fresh window on a folder: one tab with the root folder overview. */
export function rootTabs(): TabsState {
	return { groups: [makeGroup(makeTab(null, null))], focused: 0, ratio: 0.5 };
}

/** Nothing opened yet: no tabs, or only the root folder tab a window starts with. */
export function isPristine(state: TabsState): boolean {
	if (state.groups.length !== 1) return false;
	const tabs = state.groups[0].tabs;
	return tabs.length === 0 || (tabs.length === 1 && tabs[0].path === null && tabs[0].folder === null);
}

/** Stand-in for "no tab": a pane with no tabs shows Home. */
export const NO_TAB: Tab = Object.freeze({ id: "", path: null }) as Tab;

export function focusedGroup(state: TabsState): Group {
	return state.groups[state.focused] ?? state.groups[0];
}

export function activeTabOf(group: Group): Tab {
	return group.tabs.find((t) => t.id === group.activeId) ?? group.tabs[0] ?? NO_TAB;
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

/** Where a note is open within one pane. */
export function findInGroup(state: TabsState, group: number, path: string): string | null {
	return state.groups[group]?.tabs.find((t) => t.path === path)?.id ?? null;
}

/** Where a note is already open, in any pane. Prefers the focused pane. */
export function findOpen(state: TabsState, path: string): { group: number; tabId: string } | null {
	const order = state.groups.map((_, i) => i).sort((a, b) => (a === state.focused ? -1 : b === state.focused ? 1 : a - b));
	for (const gi of order) {
		const tab = state.groups[gi].tabs.find((t) => t.path === path);
		if (tab) return { group: gi, tabId: tab.id };
	}
	return null;
}

/** Where a folder overview (`null` = the root) is already open. Prefers the focused pane. */
export function findFolder(state: TabsState, folder: string | null): { group: number; tabId: string } | null {
	const order = state.groups.map((_, i) => i).sort((a, b) => (a === state.focused ? -1 : b === state.focused ? 1 : a - b));
	for (const gi of order) {
		const tab = state.groups[gi].tabs.find((t) => t.path === null && t.folder === folder);
		if (tab) return { group: gi, tabId: tab.id };
	}
	return null;
}

function reveal(state: TabsState, group: number, tabId: string): TabsState {
	return mapGroup({ ...state, focused: group }, group, (g) => ({ ...g, activeId: tabId }));
}

/**
 * Show `path` in the active tab of the focused pane. A note that is already
 * open anywhere is focused instead of being opened twice.
 */
export function openInActive(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) return reveal(state, open.group, open.tabId);
	}
	const gi = state.focused;
	if (focusedGroup(state).tabs.length === 0) return mapGroup(state, gi, (g) => insertTabAfterActive(g, makeTab(path)));
	return mapGroup(state, gi, (g) => ({
		...g,
		tabs: g.tabs.map((t) => (t.id === g.activeId ? makeTabKeepingId(t.id, path) : t)),
	}));
}

function makeTabKeepingId(id: string, path: string | null, folder?: string | null): Tab {
	return folder === undefined ? { id, path } : { id, path, folder };
}

/** Show a folder overview in the active tab, or focus it where it is already open. */
export function openFolder(state: TabsState, folder: string | null): TabsState {
	const open = findFolder(state, folder);
	if (open) return reveal(state, open.group, open.tabId);
	if (focusedGroup(state).tabs.length === 0) return mapGroup(state, state.focused, (g) => insertTabAfterActive(g, makeTab(null, folder)));
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

/** Open `path` in a tab of its own in the focused pane, or focus it where it is open. */
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

/** Open `path` in the other pane (creating it), or focus it where it is open. */
export function openToTheSide(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) return reveal(state, open.group, open.tabId);
	}
	if (state.groups.length < MAX_GROUPS) {
		return { ...state, groups: [...state.groups, makeGroup(makeTab(path))], focused: state.groups.length };
	}
	const other = state.focused === 0 ? 1 : 0;
	return mapGroup({ ...state, focused: other }, other, (g) => insertTabAfterActive(g, makeTab(path)));
}

/** Open a folder overview in the other pane (creating it), or focus it where it is open. */
export function openFolderToTheSide(state: TabsState, folder: string | null): TabsState {
	const open = findFolder(state, folder);
	if (open) return reveal(state, open.group, open.tabId);
	if (state.groups.length < MAX_GROUPS) {
		return { ...state, groups: [...state.groups, makeGroup(makeTab(null, folder))], focused: state.groups.length };
	}
	const other = state.focused === 0 ? 1 : 0;
	return mapGroup({ ...state, focused: other }, other, (g) => insertTabAfterActive(g, makeTab(null, folder)));
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
 * Close a tab. A pane disappears with its last tab; closing the very last tab
 * of the window leaves no tabs, and the window shows Home.
 */
export function closeTab(state: TabsState, group: number, tabId: string): TabsState {
	const g = state.groups[group];
	if (!g) return state;
	const index = g.tabs.findIndex((t) => t.id === tabId);
	if (index === -1) return state;

	if (g.tabs.length === 1) {
		if (state.groups.length > 1) return removeGroup(state, group);
		return { ...state, groups: [{ ...g, tabs: [], activeId: "" }], focused: 0 };
	}
	const tabs = g.tabs.filter((t) => t.id !== tabId);
	const activeId = g.activeId === tabId ? tabs[Math.min(index, tabs.length - 1)].id : g.activeId;
	return mapGroup(state, group, () => ({ ...g, tabs, activeId }));
}

/** What is needed to bring back a closed tab: a note, or a folder overview. */
export interface ClosedTab {
	path: string | null;
	folder?: string | null;
}

/** The tab as it would be remembered, or null for blank "new tab" pages (nothing to bring back). */
export function closedEntry(state: TabsState, group: number, tabId: string): ClosedTab | null {
	const tab = state.groups[group]?.tabs.find((t) => t.id === tabId);
	if (!tab) return null;
	if (tab.path !== null) return { path: tab.path };
	return tab.folder === undefined ? null : { path: null, folder: tab.folder };
}

/** Saved form of a closed tab: same encoding as saved tabs ("a.md", "sub/", "./"). */
export function encodeClosed(e: ClosedTab): string | null {
	return savedTab({ id: "", path: e.path, folder: e.folder });
}

export function decodeClosed(p: unknown): ClosedTab | null {
	if (typeof p !== "string" || p === "") return null;
	if (p === ROOT_SAVED) return { path: null, folder: null };
	if (p.endsWith("/")) return p.startsWith("/") ? null : { path: null, folder: p.slice(0, -1) };
	return { path: p };
}

/** Keep only closed tabs whose note or folder still exists (outside files are kept as they are). */
export function pruneClosed(
	list: ClosedTab[],
	exists: (path: string) => boolean,
	folderExists: (folder: string) => boolean,
): ClosedTab[] {
	return list.filter((e) =>
		e.path !== null ? e.path.startsWith("/") || exists(e.path) : e.folder === null || e.folder === undefined || folderExists(e.folder),
	);
}

/** A note or folder moved: update closed tabs inside it too. */
export function renameClosed(list: ClosedTab[], from: string, to: string): ClosedTab[] {
	const prefix = `${from.replace(/\/$/, "")}/`;
	const fix = (p: string) => (p === from ? to : p.startsWith(prefix) ? `${to.replace(/\/$/, "")}/${p.slice(prefix.length)}` : p);
	return list.map((e) => (e.path !== null ? { ...e, path: fix(e.path) } : typeof e.folder === "string" ? { ...e, folder: fix(e.folder) } : e));
}

/** A note or folder was deleted: forget closed tabs inside it. */
export function removeClosed(list: ClosedTab[], path: string): ClosedTab[] {
	const prefix = `${path.replace(/\/$/, "")}/`;
	const gone = (p: string | null | undefined) => typeof p === "string" && (p === path || p.startsWith(prefix));
	return list.filter((e) => !gone(e.path) && !gone(e.folder));
}

export function isOpenElsewhere(state: TabsState, entry: ClosedTab): boolean {
	return entry.path !== null ? !!findOpen(state, entry.path) : !!findFolder(state, entry.folder ?? null);
}

/** Open a closed tab again as a new tab next to the active one in the focused pane. */
export function reopenTab(state: TabsState, entry: ClosedTab): TabsState {
	if (entry.path !== null) return openInNewTab(state, entry.path);
	const open = findFolder(state, entry.folder ?? null);
	if (open) return reveal(state, open.group, open.tabId);
	return mapGroup(state, state.focused, (g) => insertTabAfterActive(g, makeTab(null, entry.folder ?? null)));
}

/** Close every tab showing `path`, in every pane (used when a note is deleted). */
export function closePathTab(state: TabsState, path: string): TabsState {
	let next = state;
	for (let open = findOpen(next, path); open; open = findOpen(next, path)) {
		next = closeTab(next, open.group, open.tabId);
	}
	return next;
}

/**
 * Split: move the active tab into a new right pane. A lone tab stays where it
 * is and the new pane starts with a blank "new tab" page.
 */
export function splitActive(state: TabsState): TabsState {
	if (state.groups.length >= MAX_GROUPS) return state;
	const g = focusedGroup(state);
	if (g.tabs.length === 0) return state;
	if (g.tabs.length === 1) {
		return { ...state, groups: [...state.groups, makeGroup()], focused: state.groups.length };
	}
	const moving = activeTabOf(g);
	const at = g.tabs.indexOf(moving);
	const rest = g.tabs.filter((t) => t.id !== moving.id);
	const left: Group = { ...g, tabs: rest, activeId: rest[Math.max(0, at - 1)].id };
	const groups = state.groups.map((x) => (x === g ? left : x));
	return { ...state, groups: [...groups, makeGroup(moving)], focused: groups.length };
}

/** Move a tab to the other pane (creating it if needed). */
export function moveTabToOtherGroup(state: TabsState, group: number, tabId: string): TabsState {
	const from = state.groups[group];
	const tab = from?.tabs.find((t) => t.id === tabId);
	if (!from || !tab) return state;
	const to = group === 0 ? 1 : 0;
	// The other pane already has this note: select it there instead of duplicating.
	if (state.groups[to] && tab.path !== null) {
		const existing = findInGroup(state, to, tab.path);
		if (existing) {
			const closed = closeTab(state, group, tabId);
			const target = closed.groups.findIndex((g) => g.id === state.groups[to].id);
			return target === -1 ? closed : reveal(closed, target, existing);
		}
	}
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

/** Saved form of a folder overview: "./" for the root, "sub/dir/" for a subfolder. */
const ROOT_SAVED = "./";
function savedTab(t: Tab): string | null {
	if (t.path !== null) return t.path;
	if (t.folder === null) return ROOT_SAVED;
	return typeof t.folder === "string" ? `${t.folder}/` : null;
}

/** Paths per pane, for saving. Folder overviews are saved with a trailing slash. */
export function toSaved(state: TabsState): SavedTabs {
	return {
		groups: state.groups.map((g) => g.tabs.map(savedTab)),
		activeIndex: state.groups.map((g) => Math.max(0, g.tabs.findIndex((t) => t.id === g.activeId))),
		focused: state.focused,
		ratio: state.ratio,
	};
}

function restoreTab(p: unknown, exists: (path: string) => boolean, folderExists: (folder: string) => boolean): Tab {
	if (typeof p !== "string") return makeTab(null);
	if (p === ROOT_SAVED) return makeTab(null, null);
	if (p.endsWith("/") && !p.startsWith("/")) {
		const folder = p.slice(0, -1);
		return folderExists(folder) ? makeTab(null, folder) : makeTab(null);
	}
	return makeTab(p.startsWith("/") || exists(p) ? p : null);
}

export function fromSaved(
	saved: Partial<SavedTabs> | null | undefined,
	exists: (path: string) => boolean,
	folderExists: (folder: string) => boolean = () => true,
): TabsState | null {
	if (!saved || !Array.isArray(saved.groups) || saved.groups.length === 0) return null;
	const seen = new Set<string>();
	const groups: Group[] = saved.groups
		.slice(0, MAX_GROUPS)
		.map((paths, gi) => {
			const tabs = (Array.isArray(paths) ? paths : [])
				.map((p) => restoreTab(p, exists, folderExists))
				// Drop blank pages: they carry nothing worth restoring.
				.filter((t, _i, all) => t.path !== null || t.folder !== undefined || all.length === 1)
				// Older sessions could hold a note or folder twice; keep its first tab.
				.filter((t) => {
					const key = t.path ?? (t.folder === undefined ? null : `dir:${t.folder ?? ""}`);
					return key === null || (seen.has(key) ? false : (seen.add(key), true));
				});
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

/** Where a dragged tab, note or folder can land. */
export type TabDrop =
	| { kind: "strip"; group: number; index: number; x: number }
	| { kind: "pane"; group: number; zone: "center" | "left" | "right" };

/**
 * Drop an existing tab somewhere: reorder within its tab bar, move it to the
 * other pane, or split it off into a new pane on the left or right.
 */
export function dropTab(state: TabsState, fromGroup: number, tabId: string, target: TabDrop): TabsState {
	const src = state.groups[fromGroup];
	const tab = src?.tabs.find((t) => t.id === tabId);
	if (!src || !tab) return state;
	const from = src.tabs.indexOf(tab);

	if (target.kind === "strip" && target.group === fromGroup) {
		const to = target.index > from ? target.index - 1 : target.index;
		return activateTab(reorder(state, fromGroup, from, Math.min(to, src.tabs.length - 1)), fromGroup, tabId);
	}
	if (target.kind === "pane" && target.zone === "center" && target.group === fromGroup) {
		return activateTab(state, fromGroup, tabId);
	}
	const side = target.kind === "pane" && target.zone !== "center" ? target.zone : null;
	// A pane's only tab can't be split off from it (the pane would be empty).
	if (side && (state.groups.length >= MAX_GROUPS || src.tabs.length === 1)) return activateTab(state, fromGroup, tabId);

	const remaining = src.tabs.filter((t) => t.id !== tabId);
	let groups = state.groups.map((g, i) =>
		i === fromGroup
			? { ...g, tabs: remaining, activeId: g.activeId === tabId ? (remaining[Math.max(0, from - 1)]?.id ?? "") : g.activeId }
			: g,
	);
	let targetId: string;
	if (side) {
		const fresh = makeGroup(tab);
		groups = side === "left" ? [fresh, ...groups] : [...groups, fresh];
		targetId = fresh.id;
	} else {
		const tg = groups[target.group];
		if (!tg) return state;
		const at = target.kind === "strip" ? target.index : tg.tabs.findIndex((t) => t.id === tg.activeId) + 1;
		const tabs = [...tg.tabs];
		tabs.splice(Math.min(Math.max(at, 0), tabs.length), 0, tab);
		groups = groups.map((g, i) => (i === target.group ? { ...g, tabs, activeId: tab.id } : g));
		targetId = tg.id;
	}
	const kept = groups.filter((g) => g.tabs.length > 0);
	return {
		groups: kept,
		focused: kept.findIndex((g) => g.id === targetId),
		ratio: kept.length !== state.groups.length ? 0.5 : state.ratio,
	};
}

/**
 * Drop a note or folder (dragged from the sidebar). If it is already open, its
 * tab moves there; otherwise a new tab is opened at the drop.
 */
export function dropView(state: TabsState, view: { path: string | null; folder?: string | null }, target: TabDrop): TabsState {
	const open = view.path !== null ? findOpen(state, view.path) : view.folder !== undefined ? findFolder(state, view.folder) : null;
	if (open) return dropTab(state, open.group, open.tabId, target);
	const tab = makeTab(view.path, view.path === null ? view.folder : undefined);
	if (target.kind === "pane" && target.zone !== "center" && state.groups.length < MAX_GROUPS) {
		const fresh = makeGroup(tab);
		const groups = target.zone === "left" ? [fresh, ...state.groups] : [...state.groups, fresh];
		return { ...state, groups, focused: groups.indexOf(fresh), ratio: 0.5 };
	}
	const gi = target.group;
	const g = state.groups[gi];
	if (!g) return state;
	const at = target.kind === "strip" ? target.index : g.tabs.findIndex((t) => t.id === g.activeId) + 1;
	const tabs = [...g.tabs];
	tabs.splice(Math.min(Math.max(at, 0), tabs.length), 0, tab);
	return mapGroup({ ...state, focused: gi }, gi, () => ({ ...g, tabs, activeId: tab.id }));
}
