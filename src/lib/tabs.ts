/**
 * Tabs and split views, as plain data.
 *
 * A tab shows one pane, or two side by side (a split). Each pane shows a note,
 * or nothing (the folder overview). All operations return a new state, so they
 * are easy to test and to persist.
 */

export interface Pane {
	/** Note path (relative to the root, or absolute for outside files); null = folder overview. */
	path: string | null;
}

export interface Tab {
	id: string;
	panes: Pane[];
	/** Index of the pane that has focus. */
	focused: number;
	/** Share of the width the left pane takes in a split. */
	ratio: number;
}

export interface TabsState {
	tabs: Tab[];
	activeId: string;
}

export const MIN_RATIO = 0.25;
export const MAX_PANES = 2;

let counter = 0;
export function newId(): string {
	counter += 1;
	return `t${Date.now().toString(36)}${counter}`;
}

export function emptyTab(path: string | null = null): Tab {
	return { id: newId(), panes: [{ path }], focused: 0, ratio: 0.5 };
}

export function initialTabs(path: string | null = null): TabsState {
	const tab = emptyTab(path);
	return { tabs: [tab], activeId: tab.id };
}

export function activeTab(state: TabsState): Tab {
	return state.tabs.find((t) => t.id === state.activeId) ?? state.tabs[0];
}

export function focusedPath(state: TabsState): string | null {
	const tab = activeTab(state);
	return tab.panes[tab.focused]?.path ?? null;
}

function mapTab(state: TabsState, id: string, fn: (tab: Tab) => Tab): TabsState {
	return { ...state, tabs: state.tabs.map((t) => (t.id === id ? fn(t) : t)) };
}

/** Where a note is already open: (tab, pane) or null. Prefers the active tab. */
export function findOpen(state: TabsState, path: string): { tabId: string; pane: number } | null {
	const ordered = [activeTab(state), ...state.tabs.filter((t) => t.id !== state.activeId)];
	for (const tab of ordered) {
		const pane = tab.panes.findIndex((p) => p.path === path);
		if (pane !== -1) return { tabId: tab.id, pane };
	}
	return null;
}

/**
 * Show `path` in the focused pane of the active tab. A note that is already
 * open somewhere is revealed instead of being opened twice, so two editors never
 * hold the same file.
 */
export function openInActive(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) {
			return mapTab({ ...state, activeId: open.tabId }, open.tabId, (t) => ({ ...t, focused: open.pane }));
		}
	}
	const tab = activeTab(state);
	return mapTab(state, tab.id, (t) => ({
		...t,
		panes: t.panes.map((p, i) => (i === t.focused ? { path } : p)),
	}));
}

/** Open `path` in a tab of its own (or reveal it if it is already open). */
export function openInNewTab(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) {
			return mapTab({ ...state, activeId: open.tabId }, open.tabId, (t) => ({ ...t, focused: open.pane }));
		}
	}
	const tab = emptyTab(path);
	const at = state.tabs.findIndex((t) => t.id === state.activeId);
	const tabs = [...state.tabs];
	tabs.splice(at + 1, 0, tab);
	return { tabs, activeId: tab.id };
}

/** Open `path` in the second pane of the active tab, splitting it if needed. */
export function openToTheSide(state: TabsState, path: string | null): TabsState {
	if (path !== null) {
		const open = findOpen(state, path);
		if (open) {
			return mapTab({ ...state, activeId: open.tabId }, open.tabId, (t) => ({ ...t, focused: open.pane }));
		}
	}
	const tab = activeTab(state);
	if (tab.panes.length >= MAX_PANES) {
		// Already split: "the side" is always the right pane.
		return mapTab(state, tab.id, (t) => ({
			...t,
			panes: t.panes.map((p, i) => (i === 1 ? { path } : p)),
			focused: 1,
		}));
	}
	return mapTab(state, tab.id, (t) => ({ ...t, panes: [...t.panes, { path }], focused: 1 }));
}

export function activateTab(state: TabsState, id: string): TabsState {
	return state.tabs.some((t) => t.id === id) ? { ...state, activeId: id } : state;
}

/** Close a tab. The last tab is never removed; it just goes back to the overview. */
export function closeTab(state: TabsState, id: string): TabsState {
	const index = state.tabs.findIndex((t) => t.id === id);
	if (index === -1) return state;
	if (state.tabs.length === 1) {
		const tab = emptyTab();
		return { tabs: [tab], activeId: tab.id };
	}
	const tabs = state.tabs.filter((t) => t.id !== id);
	if (state.activeId !== id) return { ...state, tabs };
	return { tabs, activeId: tabs[Math.min(index, tabs.length - 1)].id };
}

/** Split the active tab: a second, empty pane on the right. */
export function split(state: TabsState): TabsState {
	const tab = activeTab(state);
	if (tab.panes.length >= MAX_PANES) return state;
	return mapTab(state, tab.id, (t) => ({ ...t, panes: [...t.panes, { path: null }], focused: 1 }));
}

/** Close one pane of a split; the tab keeps the other. */
export function closePane(state: TabsState, index: number): TabsState {
	const tab = activeTab(state);
	if (tab.panes.length < 2 || !tab.panes[index]) return state;
	return mapTab(state, tab.id, (t) => ({
		...t,
		panes: t.panes.filter((_, i) => i !== index),
		focused: 0,
	}));
}

export function focusPane(state: TabsState, index: number): TabsState {
	const tab = activeTab(state);
	if (!tab.panes[index] || tab.focused === index) return state;
	return mapTab(state, tab.id, (t) => ({ ...t, focused: index }));
}

export function setRatio(state: TabsState, id: string, ratio: number): TabsState {
	const clamped = Math.min(1 - MIN_RATIO, Math.max(MIN_RATIO, ratio));
	return mapTab(state, id, (t) => ({ ...t, ratio: clamped }));
}

export function reorder(state: TabsState, from: number, to: number): TabsState {
	if (from === to || from < 0 || to < 0 || from >= state.tabs.length || to >= state.tabs.length) return state;
	const tabs = [...state.tabs];
	const [moved] = tabs.splice(from, 1);
	tabs.splice(to, 0, moved);
	return { ...state, tabs };
}

/** A note or folder was renamed or moved. */
export function renamePath(state: TabsState, from: string, to: string): TabsState {
	const prefix = `${from.replace(/\/$/, "")}/`;
	const fix = (p: string | null) =>
		p === null ? p : p === from ? to : p.startsWith(prefix) ? `${to.replace(/\/$/, "")}/${p.slice(prefix.length)}` : p;
	return { ...state, tabs: state.tabs.map((t) => ({ ...t, panes: t.panes.map((p) => ({ path: fix(p.path) })) })) };
}

/** A note or folder was deleted: panes showing it fall back to the overview. */
export function removePath(state: TabsState, path: string): TabsState {
	const prefix = `${path.replace(/\/$/, "")}/`;
	const gone = (p: string | null) => p !== null && (p === path || p.startsWith(prefix));
	return {
		...state,
		tabs: state.tabs.map((t) => ({ ...t, panes: t.panes.map((p) => (gone(p.path) ? { path: null } : p)) })),
	};
}

/** Paths per tab, for saving. */
export function toSaved(state: TabsState): { tabs: (string | null)[][]; active: number; focused: number } {
	const active = Math.max(0, state.tabs.findIndex((t) => t.id === state.activeId));
	return {
		tabs: state.tabs.map((t) => t.panes.map((p) => p.path)),
		active,
		focused: state.tabs[active]?.focused ?? 0,
	};
}

export function fromSaved(
	saved: { tabs: (string | null)[][]; active: number; focused?: number } | null | undefined,
	exists: (path: string) => boolean,
): TabsState | null {
	if (!saved || !Array.isArray(saved.tabs) || saved.tabs.length === 0) return null;
	const tabs: Tab[] = saved.tabs
		.map((paths) => {
			const panes = (Array.isArray(paths) ? paths : [paths]).slice(0, MAX_PANES).map((p) => ({
				path: typeof p === "string" && (p.startsWith("/") || exists(p)) ? p : null,
			}));
			return { id: newId(), panes: panes.length ? panes : [{ path: null }], focused: 0, ratio: 0.5 } as Tab;
		})
		.filter((t) => t.panes.length > 0);
	if (tabs.length === 0) return null;
	const active = Math.min(Math.max(saved.active ?? 0, 0), tabs.length - 1);
	tabs[active].focused = Math.min(saved.focused ?? 0, tabs[active].panes.length - 1);
	return { tabs, activeId: tabs[active].id };
}
