import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { SortMode } from "@/types";

const SORT_CYCLE: SortMode[] = ["name-asc", "name-desc", "modified"];

export interface SidebarSlice {
  sidebarCollapsed: boolean;
  tagsCollapsed: boolean;
  sidebarSort: SortMode;
  isSidebarLoaded: boolean;

  loadSidebarState: () => Promise<void>;
  toggleSidebarCollapsed: () => Promise<void>;
  toggleTagsCollapsed: () => Promise<void>;
  cycleSidebarSort: () => Promise<void>;
  setSidebarSort: (sort: SortMode) => Promise<void>;
}
import type { StoreState } from "../index";

export const createSidebarSlice: StateCreator<StoreState, [], [], SidebarSlice> = (set, get) => ({
  sidebarCollapsed: false,
  tagsCollapsed: true,
  sidebarSort: "name-asc",
  isSidebarLoaded: false,

  loadSidebarState: async () => {
    try {
      const state = await invoke<{
        collapsed: boolean;
        tags_collapsed: boolean;
        sort: SortMode;
      }>("get_sidebar_state");
      set({
        sidebarCollapsed: state.collapsed,
        tagsCollapsed: state.tags_collapsed,
        sidebarSort: state.sort,
        isSidebarLoaded: true,
      });
    } catch {
      set({ isSidebarLoaded: true });
    }
  },

  toggleSidebarCollapsed: async () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    try {
      await invoke("save_sidebar_state", {
        state: {
          collapsed: next,
          tags_collapsed: get().tagsCollapsed,
          sort: get().sidebarSort,
        },
      });
    } catch (e) {
      console.error("Failed to save sidebar state:", e);
    }
  },

  toggleTagsCollapsed: async () => {
    const next = !get().tagsCollapsed;
    set({ tagsCollapsed: next });
    try {
      await invoke("save_sidebar_state", {
        state: {
          collapsed: get().sidebarCollapsed,
          tags_collapsed: next,
          sort: get().sidebarSort,
        },
      });
    } catch (e) {
      console.error("Failed to save tags collapsed state:", e);
    }
  },

  cycleSidebarSort: async () => {
    const current = get().sidebarSort;
    const idx = SORT_CYCLE.indexOf(current);
    const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length] as SortMode;
    await get().setSidebarSort(next);
  },

  setSidebarSort: async (sort: SortMode) => {
    set({ sidebarSort: sort });
    try {
      await invoke("save_sidebar_state", {
        state: {
          collapsed: get().sidebarCollapsed,
          tags_collapsed: get().tagsCollapsed,
          sort,
        },
      });
    } catch (e) {
      console.error("Failed to save sidebar sort:", e);
    }
  },
});
