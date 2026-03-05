import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { SortMode } from "@/types";

const SORT_CYCLE: SortMode[] = ["name-asc", "name-desc", "modified"];

interface SidebarStoreState {
  collapsed: boolean;
  tagsCollapsed: boolean;
  sort: SortMode;
  loaded: boolean;

  loadState: () => Promise<void>;
  toggleCollapsed: () => Promise<void>;
  toggleTagsCollapsed: () => Promise<void>;
  cycleSort: () => Promise<void>;
  setSort: (sort: SortMode) => Promise<void>;
}

export const useSidebarStore = create<SidebarStoreState>((set, get) => ({
  collapsed: false,
  tagsCollapsed: true,
  sort: "name-asc",
  loaded: false,

  loadState: async () => {
    try {
      const state = await invoke<{
        collapsed: boolean;
        tags_collapsed: boolean;
        sort: SortMode;
      }>("get_sidebar_state");
      set({
        collapsed: state.collapsed,
        tagsCollapsed: state.tags_collapsed,
        sort: state.sort,
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  toggleCollapsed: async () => {
    const next = !get().collapsed;
    set({ collapsed: next });
    try {
      await invoke("save_sidebar_state", {
        state: {
          collapsed: next,
          tags_collapsed: get().tagsCollapsed,
          sort: get().sort,
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
          collapsed: get().collapsed,
          tags_collapsed: next,
          sort: get().sort,
        },
      });
    } catch (e) {
      console.error("Failed to save tags collapsed state:", e);
    }
  },

  cycleSort: async () => {
    const current = get().sort;
    const idx = SORT_CYCLE.indexOf(current);
    const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length];
    await get().setSort(next);
  },

  setSort: async (sort: SortMode) => {
    set({ sort });
    try {
      await invoke("save_sidebar_state", {
        state: {
          collapsed: get().collapsed,
          tags_collapsed: get().tagsCollapsed,
          sort,
        },
      });
    } catch (e) {
      console.error("Failed to save sidebar sort:", e);
    }
  },
}));
