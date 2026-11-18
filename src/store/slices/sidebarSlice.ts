import { StateCreator } from "zustand";

export interface SidebarSlice {
  sidebarCollapsed: boolean;
  pinnedNotesCollapsed: boolean;
  sidebarWidth: number;
  pinnedHeight: number;
  isSidebarLoaded: boolean;
  expandedFolders: string[];
  pinnedNotePaths: string[];

  loadSidebarState: () => Promise<void>;
  toggleSidebarCollapsed: () => void;
  togglePinnedNotesCollapsed: () => void;
  toggleFolderExpanded: (path: string) => void;
  setPinnedNotePaths: (paths: string[]) => void;
  addPinnedNote: (path: string) => void;
  removePinnedNote: (path: string) => void;
  setSidebarWidth: (width: number) => void;
  setPinnedHeight: (height: number) => void;
}
import type { StoreState } from "../index";

export const createSidebarSlice: StateCreator<StoreState, [], [], SidebarSlice> = (set, get) => ({
  sidebarCollapsed: false,
  pinnedNotesCollapsed: false,
  sidebarWidth: 260,
  pinnedHeight: 150,
  isSidebarLoaded: true,
  expandedFolders: [],
  pinnedNotePaths: [],

  loadSidebarState: async () => {
    set({ isSidebarLoaded: true });
  },

  toggleSidebarCollapsed: () => {
    set({ sidebarCollapsed: !get().sidebarCollapsed });
  },

  togglePinnedNotesCollapsed: () => {
    set({ pinnedNotesCollapsed: !get().pinnedNotesCollapsed });
  },

  toggleFolderExpanded: (path: string) => {
    const current = get().expandedFolders;
    const next = current.includes(path)
      ? current.filter((p) => p !== path)
      : [...current, path];
    set({ expandedFolders: next });
  },

  setPinnedNotePaths: (paths: string[]) => {
    set({ pinnedNotePaths: paths });
  },

  addPinnedNote: (path: string) => {
    const current = get().pinnedNotePaths;
    if (!current.includes(path)) {
      set({ pinnedNotePaths: [...current, path] });
    }
  },

  removePinnedNote: (path: string) => {
    const current = get().pinnedNotePaths;
    set({ pinnedNotePaths: current.filter((p) => p !== path) });
  },

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width });
  },

  setPinnedHeight: (height: number) => {
    set({ pinnedHeight: height });
  },
});