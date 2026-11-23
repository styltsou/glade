import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { NoteData } from "@/types";
import * as T from "@/lib/tabs";
import type { StoreState } from "../index";
import { findEntryByPath } from "@/components/sidebar/file-tree-helpers";

export interface TabsSlice {
  tabsState: T.TabsState;

  /** Open a note: in the active tab, a new tab, or in the pane to the side. */
  openNote: (path: string, mode?: "active" | "tab" | "side", partial?: Partial<NoteData>) => Promise<void>;
  /** Make `activeNote` (and the folder overview) follow the focused pane's active tab. */
  syncFocusedNote: () => Promise<void>;
  /** Put a note in the cache without making it the active one (for other panes). */
  fetchNote: (path: string) => Promise<void>;
  /** Show a folder overview in the active tab (null = the root). */
  openFolderTab: (folder: string | null) => void;
  /** Show a folder overview in the other pane. */
  openFolderToSide: (folder: string | null) => void;
  /** Turn the active tab into the blank "new tab" page. */
  setFocusedPathNull: () => void;
  /** Back and Forward in the focused pane's active tab. */
  goBack: () => void;
  goForward: () => void;

  /** Where a tab, note or folder being dragged would land (drives the drop highlights). */
  tabDropTarget: T.TabDrop | null;
  setTabDropTarget: (target: T.TabDrop | null) => void;
  dropTabAt: (fromGroup: number, tabId: string, target: T.TabDrop) => void;
  dropViewAt: (view: { path: string | null; folder?: string | null }, target: T.TabDrop) => void;

  newTab: () => void;
  activateTab: (group: number, id: string) => void;
  closeTab: (group: number, id: string) => void;
  closeActiveTab: () => void;
  /** Close the other tabs of a pane, or only the ones after `id`. The tab stays open and active if it was. */
  closeOtherTabs: (group: number, id: string, which: "others" | "right") => void;
  /** Recently closed tabs, newest last (capped). */
  closedTabs: T.ClosedTab[];
  setClosedTabs: (list: T.ClosedTab[]) => void;
  /** Bring back the most recently closed tab that is not already open. Returns whether one came back. */
  reopenClosedTab: () => boolean;
  closePathTab: (path: string) => void;
  splitActive: () => void;
  moveTabToOtherGroup: (group: number, id: string) => void;
  focusGroup: (index: number) => void;
  setTabRatio: (ratio: number) => void;
  reorderTabs: (group: number, from: number, to: number) => void;
  tabsRemovePath: (path: string) => void;
  resetTabs: (state?: T.TabsState) => void;
}

const MAX_CLOSED_TABS = 10;

export const createTabsSlice: StateCreator<StoreState, [], [], TabsSlice> = (set, get) => {
  const apply = (next: T.TabsState) => {
    set({ tabsState: next });
    void get().syncFocusedNote();
  };

  /** Push onto the closed-tabs stack. Like a browser, closing the same page twice leaves two entries. */
  const remember = (entry: T.ClosedTab | null) => {
    if (!entry) return;
    set({ closedTabs: [...get().closedTabs, entry].slice(-MAX_CLOSED_TABS) });
  };

  return {
    tabsState: T.initialTabs(),

    openNote: async (path, mode = "active", partial) => {
      const state = get().tabsState;
      const next =
        mode === "tab" ? T.openInNewTab(state, path) : mode === "side" ? T.openToTheSide(state, path) : T.openInActive(state, path);
      set({ tabsState: next });
      await get().loadNote(path, partial);
    },

    syncFocusedNote: async () => {
      const tab = T.activeTab(get().tabsState);
      if (!tab.path) {
        // A folder overview follows its tab; the blank page has no folder.
        set({ activeNote: null, currentFolder: typeof tab.folder === "string" ? tab.folder : null });
        if (tab.folder !== undefined) void get().loadFolderNotes(typeof tab.folder === "string" ? tab.folder : null);
        return;
      }
      const cached = get().noteCache[tab.path];
      set({ activeNote: cached ?? null, currentFolder: null });
      await get().loadNote(tab.path);
    },

    fetchNote: async (path) => {
      if (get().noteCache[path]) return;
      try {
        const note = await invoke<NoteData>("read_note", { path });
        set((s: StoreState) => ({ noteCache: { ...s.noteCache, [path]: note } }));
      } catch {
        // The pane shows an empty state until the file is readable.
      }
    },

    openFolderTab: (folder) => {
      set({
        tabsState: T.openFolder(get().tabsState, folder),
        activeNote: null,
        currentFolder: folder,
        folderNotes: [],
      });
      void get().loadFolderNotes(folder);
    },

    openFolderToSide: (folder) => apply(T.openFolderToTheSide(get().tabsState, folder)),

    setFocusedPathNull: () => {
      set({ tabsState: T.openInActive(get().tabsState, null), activeNote: null });
    },

    goBack: () => {
      const next = T.goInHistory(get().tabsState, "back");
      if (next !== get().tabsState) apply(next);
    },
    goForward: () => {
      const next = T.goInHistory(get().tabsState, "forward");
      if (next !== get().tabsState) apply(next);
    },

    tabDropTarget: null,
    setTabDropTarget: (target) => set({ tabDropTarget: target }),
    dropTabAt: (fromGroup, tabId, target) => apply(T.dropTab(get().tabsState, fromGroup, tabId, target)),
    dropViewAt: (view, target) => apply(T.dropView(get().tabsState, view, target)),

    newTab: () => {
      set({ tabsState: T.newTab(get().tabsState), activeNote: null, currentFolder: null });
    },
    activateTab: (group, id) => apply(T.activateTab(get().tabsState, group, id)),
    closedTabs: [],
    setClosedTabs: (list) => set({ closedTabs: list.slice(-MAX_CLOSED_TABS) }),
    closeTab: (group, id) => {
      const state = get().tabsState;
      remember(T.closedEntry(state, group, id));
      apply(T.closeTab(state, group, id));
    },
    closeActiveTab: () => {
      const s = get().tabsState;
      const id = T.focusedGroup(s).activeId;
      remember(T.closedEntry(s, s.focused, id));
      apply(T.closeTab(s, s.focused, id));
    },
    closeOtherTabs: (group, id, which) => {
      const state = get().tabsState;
      const { state: next, closedIds } = T.closeTabsAround(state, group, id, which);
      if (closedIds.length === 0) return;
      // Left to right, so reopening brings back the right-most one first.
      closedIds.forEach((closed) => remember(T.closedEntry(state, group, closed)));
      apply(next);
    },
    reopenClosedTab: () => {
      // Check against the files on disk every time: something may have been removed since it was closed.
      const { idToPath, entries } = get();
      const stack = T.pruneClosed(
        get().closedTabs,
        (p) => !!idToPath[p],
        (f) => !!findEntryByPath(entries, f)?.is_dir,
      );
      const state = get().tabsState;
      while (stack.length) {
        const entry = stack.pop()!;
        if (T.isOpenElsewhere(state, entry)) continue;
        set({ closedTabs: stack });
        apply(T.reopenTab(state, entry));
        return true;
      }
      set({ closedTabs: [] });
      return false;
    },
    closePathTab: (path) => apply(T.closePathTab(get().tabsState, path)),
    splitActive: () => apply(T.splitActive(get().tabsState)),
    moveTabToOtherGroup: (group, id) => apply(T.moveTabToOtherGroup(get().tabsState, group, id)),
    focusGroup: (index) => {
      const next = T.focusGroup(get().tabsState, index);
      if (next !== get().tabsState) apply(next);
    },
    setTabRatio: (ratio) => set({ tabsState: T.setRatio(get().tabsState, ratio) }),
    reorderTabs: (group, from, to) => set({ tabsState: T.reorder(get().tabsState, group, from, to) }),

    tabsRemovePath: (path) => {
      // A deleted note can't come back, so drop it from the closed stack too.
      set({ closedTabs: T.removeClosed(get().closedTabs, path) });
      apply(T.removePath(get().tabsState, path));
    },

    resetTabs: (state) => set({ tabsState: state ?? T.initialTabs(), activeNote: null, closedTabs: [] }),
  };
};
