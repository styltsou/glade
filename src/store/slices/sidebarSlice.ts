import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
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
  expandedFolders: Set<string>;
  soundStates: Record<SoundId, SoundState>;

  loadSidebarState: () => Promise<void>;
  toggleSidebarCollapsed: () => Promise<void>;
  toggleTagsCollapsed: () => Promise<void>;
  togglePinnedNotesCollapsed: () => Promise<void>;
  toggleFolderExpanded: (path: string) => void;
  setSidebarWidth: (width: number) => void;
  setTagsHeight: (height: number) => void;
  setPinnedHeight: (height: number) => void;
  setSoundStates: (states: Record<SoundId, SoundState>) => void;
  saveSidebarState: () => Promise<void>;
}
import type { StoreState } from "../index";

const DEFAULT_SOUND_STATES: Record<SoundId, SoundState> = {
  rain: { enabled: false, volume: 0.7 },
  whiteNoise: { enabled: false, volume: 0.7 },
  people: { enabled: false, volume: 0.7 },
};

let _folderSaveTimer: ReturnType<typeof setTimeout> | null = null;

export const createSidebarSlice: StateCreator<StoreState, [], [], SidebarSlice> = (set, get) => ({
  sidebarCollapsed: false,
  tagsCollapsed: true,
  pinnedNotesCollapsed: false,
  sidebarWidth: 260,
  tagsHeight: 200,
  pinnedHeight: 150,
  isSidebarLoaded: false,
  expandedFolders: new Set<string>(),
  soundStates: DEFAULT_SOUND_STATES,

  loadSidebarState: async () => {
    try {
      const state = await invoke<{
        collapsed: boolean;
        tags_collapsed: boolean;
        pinned_collapsed: boolean;
        width: number;
        tags_height: number;
        pinned_height: number;
        expanded_folders: string[];
        sound_states?: Record<string, { enabled: boolean; volume: number }>;
      }>("get_sidebar_state");
      set({
        sidebarCollapsed: state.collapsed,
        tagsCollapsed: state.tags_collapsed,
        pinnedNotesCollapsed: state.pinned_collapsed ?? false,
        sidebarWidth: state.width || 260,
        tagsHeight: state.tags_height || 200,
        pinnedHeight: state.pinned_height || 150,
        expandedFolders: new Set(state.expanded_folders || []),
        soundStates: {
          ...DEFAULT_SOUND_STATES,
          ...(state.sound_states
            ? Object.fromEntries(
                Object.entries(state.sound_states).map(([k, v]) => [k, { enabled: v.enabled, volume: v.volume }])
              )
            : {}),
        } as Record<SoundId, SoundState>,
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

  togglePinnedNotesCollapsed: async () => {
    const next = !get().pinnedNotesCollapsed;
    set({ pinnedNotesCollapsed: next });
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
    if (_folderSaveTimer) clearTimeout(_folderSaveTimer);
    _folderSaveTimer = setTimeout(() => {
      get().saveSidebarState();
    }, 500);
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
    get().saveSidebarState();
  },

  saveSidebarState: async () => {
    try {
      await invoke("save_sidebar_state", {
        state: {
          collapsed: get().sidebarCollapsed,
          tags_collapsed: get().tagsCollapsed,
          pinned_collapsed: get().pinnedNotesCollapsed,
          width: get().sidebarWidth,
          tags_height: get().tagsHeight,
          pinned_height: get().pinnedHeight,
          expanded_folders: Array.from(get().expandedFolders),
          sound_states: Object.fromEntries(
            Object.entries(get().soundStates).map(([k, v]) => [k, { enabled: v.enabled, volume: v.volume }])
          ),
        },
      });
    } catch (e) {
      console.error("Failed to save sidebar state:", e);
    }
  },
});
