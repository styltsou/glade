import { StateCreator } from "zustand";
import type { SoundId } from "@/lib/sounds";

export interface SoundState {
  enabled: boolean;
  volume: number;
}

export interface SidebarSlice {
  sidebarCollapsed: boolean;
  tagsCollapsed: boolean;
  pinnedNotesCollapsed: boolean;
  sidebarWidth: number;
  tagsHeight: number;
  pinnedHeight: number;
  isSidebarLoaded: boolean;
  expandedFolders: string[];
  soundStates: Record<SoundId, SoundState>;

  loadSidebarState: () => Promise<void>;
  toggleSidebarCollapsed: () => void;
  toggleTagsCollapsed: () => void;
  togglePinnedNotesCollapsed: () => void;
  toggleFolderExpanded: (path: string) => void;
  setSidebarWidth: (width: number) => void;
  setTagsHeight: (height: number) => void;
  setPinnedHeight: (height: number) => void;
  setSoundStates: (states: Record<SoundId, SoundState>) => void;
}
import type { StoreState } from "../index";

const DEFAULT_SOUND_STATES: Record<SoundId, SoundState> = {
  rain: { enabled: false, volume: 0.7 },
  whiteNoise: { enabled: false, volume: 0.7 },
  people: { enabled: false, volume: 0.7 },
};

export const createSidebarSlice: StateCreator<StoreState, [], [], SidebarSlice> = (set, get) => ({
  sidebarCollapsed: false,
  tagsCollapsed: true,
  pinnedNotesCollapsed: false,
  sidebarWidth: 260,
  tagsHeight: 200,
  pinnedHeight: 150,
  isSidebarLoaded: true,
  expandedFolders: [],
  soundStates: DEFAULT_SOUND_STATES,

  loadSidebarState: async () => {
    set({ isSidebarLoaded: true });
  },

  toggleSidebarCollapsed: () => {
    set({ sidebarCollapsed: !get().sidebarCollapsed });
  },

  toggleTagsCollapsed: () => {
    set({ tagsCollapsed: !get().tagsCollapsed });
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

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width });
  },

  setTagsHeight: (height: number) => {
    set({ tagsHeight: height });
  },

  setPinnedHeight: (height: number) => {
    set({ pinnedHeight: height });
  },

  setSoundStates: (states: Record<SoundId, SoundState>) => {
    set({ soundStates: states });
  },
});