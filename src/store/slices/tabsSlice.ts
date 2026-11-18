import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { NoteData } from "@/types";
import * as T from "@/lib/tabs";
import type { StoreState } from "../index";

export interface TabsSlice {
  tabsState: T.TabsState;

  /** Open a note: in the focused pane, a new tab, or beside the current one. */
  openNote: (path: string, mode?: "active" | "tab" | "side", partial?: Partial<NoteData>) => Promise<void>;
  /** Make `activeNote` follow the focused pane. */
  syncFocusedNote: () => Promise<void>;
  /** Put a note in the cache without making it the active one (for other panes). */
  fetchNote: (path: string) => Promise<void>;
  /** Show the folder overview (no note) in the focused pane. */
  setFocusedPathNull: () => void;

  newTab: () => void;
  activateTab: (id: string) => void;
  closeTab: (id: string) => void;
  splitActive: () => void;
  closePane: (index: number) => void;
  focusPane: (index: number) => void;
  setTabRatio: (id: string, ratio: number) => void;
  reorderTabs: (from: number, to: number) => void;
  /** Rename/move/delete bookkeeping. */
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
      const path = T.focusedPath(get().tabsState);
      if (!path) {
        set({ activeNote: null });
        return;
      }
      const cached = get().noteCache[path];
      set({ activeNote: cached ?? null, currentFolder: null });
      await get().loadNote(path);
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

    setFocusedPathNull: () => {
      set({ tabsState: T.openInActive(get().tabsState, null), activeNote: null });
    },

    newTab: () => {
      const next = T.openInNewTab(get().tabsState, null);
      set({ tabsState: next, activeNote: null });
    },
    activateTab: (id) => apply(T.activateTab(get().tabsState, id)),
    closeTab: (id) => apply(T.closeTab(get().tabsState, id)),
    splitActive: () => apply(T.split(get().tabsState)),
    closePane: (index) => apply(T.closePane(get().tabsState, index)),
    focusPane: (index) => {
      const next = T.focusPane(get().tabsState, index);
      if (next !== get().tabsState) apply(next);
    },
    setTabRatio: (id, ratio) => set({ tabsState: T.setRatio(get().tabsState, id, ratio) }),
    reorderTabs: (from, to) => set({ tabsState: T.reorder(get().tabsState, from, to) }),

    tabsRenamePath: (from, to) => set({ tabsState: T.renamePath(get().tabsState, from, to) }),
    tabsRemovePath: (path) => apply(T.removePath(get().tabsState, path)),

    resetTabs: (state) => set({ tabsState: state ?? T.initialTabs(), activeNote: null }),
  };
};
