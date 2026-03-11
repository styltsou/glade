import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { SortMode } from "@/types";

const SORT_CYCLE: SortMode[] = ["name-asc", "name-desc", "modified"];

export interface SidebarSlice {
  sidebarCollapsed: boolean;
  tagsCollapsed: boolean;
  sidebarSort: SortMode;
  sidebarWidth: number;
  tagsHeight: number;
  isSidebarLoaded: boolean;
  expandedFolders: Set<string>;

  loadSidebarState: () => Promise<void>;
  toggleSidebarCollapsed: () => Promise<void>;
  toggleTagsCollapsed: () => Promise<void>;
  toggleFolderExpanded: (path: string) => void;
  cycleSidebarSort: () => Promise<void>;
  setSidebarSort: (sort: SortMode) => Promise<void>;
  setSidebarWidth: (width: number) => void;
  setTagsHeight: (height: number) => void;
  saveSidebarState: () => Promise<void>;
}
import type { StoreState } from "../index";

let _folderSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const createSidebarSlice: StateCreator<StoreState, [], [], SidebarSlice> = (set, get) => ({
  sidebarCollapsed: false,
  tagsCollapsed: true,
  sidebarWidth: 260,
  tagsHeight: 200,
  sidebarSort: "name-asc",
  isSidebarLoaded: false,
  expandedFolders: new Set<string>(),

  loadSidebarState: async () => {
    try {
      const state = await invoke<{
        collapsed: boolean;
        tags_collapsed: boolean;
        width: number;
        tags_height: number;
        sort: SortMode;
        expanded_folders: string[];
      }>("get_sidebar_state");
      set({
        sidebarCollapsed: state.collapsed,
        tagsCollapsed: state.tags_collapsed,
        sidebarWidth: state.width || 260,
        tagsHeight: state.tags_height || 200,
        sidebarSort: state.sort,
        expandedFolders: new Set(state.expanded_folders || []),
        isSidebarLoaded: true,
      });
    } catch {
      set({ isSidebarLoaded: true });
    }
  },

  toggleSidebarCollapsed: async () => {
    const next = !get().sidebarCollapsed;
    set({ sidebarCollapsed: next });
    await get().saveSidebarState();
  },

  toggleTagsCollapsed: async () => {
    const next = !get().tagsCollapsed;
    set({ tagsCollapsed: next });
    await get().saveSidebarState();
  },

  toggleFolderExpanded: (path: string) => {
    const next = new Set(get().expandedFolders);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
    }
    set({ expandedFolders: next });
    // Debounce the save to avoid spamming the backend
    if (_folderSaveTimer) clearTimeout(_folderSaveTimer);
    _folderSaveTimer = setTimeout(() => {
      get().saveSidebarState();
    }, 500);
  },

  cycleSidebarSort: async () => {
    const current = get().sidebarSort;
    const idx = SORT_CYCLE.indexOf(current);
    const next = SORT_CYCLE[(idx + 1) % SORT_CYCLE.length] as SortMode;
    await get().setSidebarSort(next);
  },

  setSidebarSort: async (sort: SortMode) => {
    set({ sidebarSort: sort });
    await get().saveSidebarState();
  },

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width });
  },

  setTagsHeight: (height: number) => {
    set({ tagsHeight: height });
  },

  saveSidebarState: async () => {
    try {
      await invoke("save_sidebar_state", {
        state: {
          collapsed: get().sidebarCollapsed,
          tags_collapsed: get().tagsCollapsed,
          width: get().sidebarWidth,
          tags_height: get().tagsHeight,
          sort: get().sidebarSort,
          expanded_folders: Array.from(get().expandedFolders),
        },
      });
    } catch (e) {
      console.error("Failed to save sidebar state:", e);
    }
  },
});
