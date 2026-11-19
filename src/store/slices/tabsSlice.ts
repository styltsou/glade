import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { NoteData } from "@/types";
import * as T from "@/lib/tabs";
import type { StoreState } from "../index";

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
  /** Turn the active tab into the blank "new tab" page. */
  setFocusedPathNull: () => void;

  newTab: () => void;
  activateTab: (group: number, id: string) => void;
  closeTab: (group: number, id: string) => void;
  closeActiveTab: () => void;
  closePathTab: (path: string) => void;
  splitActive: () => void;
  moveTabToOtherGroup: (group: number, id: string) => void;
  focusGroup: (index: number) => void;
  setTabRatio: (ratio: number) => void;
  reorderTabs: (group: number, from: number, to: number) => void;
  tabsRenamePath: (from: string, to: string) => void;
  tabsRemovePath: (path: string) => void;
  resetTabs: (state?: T.TabsState) => void;
}

export const createTabsSlice: StateCreator<StoreState, [], [], TabsSlice> = (set, get) => {
  const apply = (next: T.TabsState) => {
    set({ tabsState: next });
    void get().syncFocusedNote();
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

    setFocusedPathNull: () => {
      set({ tabsState: T.openInActive(get().tabsState, null), activeNote: null });
    },

    newTab: () => {
      set({ tabsState: T.newTab(get().tabsState), activeNote: null, currentFolder: null });
    },
    activateTab: (group, id) => apply(T.activateTab(get().tabsState, group, id)),
    closeTab: (group, id) => apply(T.closeTab(get().tabsState, group, id)),
    closeActiveTab: () => {
      const s = get().tabsState;
      apply(T.closeTab(s, s.focused, T.focusedGroup(s).activeId));
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

    tabsRenamePath: (from, to) => set({ tabsState: T.renamePath(get().tabsState, from, to) }),
    tabsRemovePath: (path) => apply(T.removePath(get().tabsState, path)),

    resetTabs: (state) => set({ tabsState: state ?? T.initialTabs(), activeNote: null }),
  };
};
