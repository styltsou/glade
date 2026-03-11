import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { VaultEntry, NoteData, TagCount } from "@/types";

export interface VaultSlice {
  entries: VaultEntry[];
  activeNote: NoteData | null;
  isVaultLoading: boolean;
  vaultError: string | null;
  tags: TagCount[];
  activeTagFilters: string[];
  searchResults: NoteData[];
  sidebarQuery: string;
  noteCache: Record<string, NoteData>;
  noteScrollPositions: Record<string, number>;

  loadVault: () => Promise<void>;
  loadTags: () => Promise<void>;
  clearTags: () => void;
  toggleTagFilter: (tag: string) => void;
  clearTagFilters: () => void;
  searchNotes: (query: string, titleOnly?: boolean) => Promise<void>;
  clearSearch: () => void;
  goHome: () => void;
  setSidebarQuery: (query: string) => void;
  prefetchNote: (path: string) => Promise<void>;
  clearCache: () => void;
  updateNoteScrollPosition: (path: string, position: number) => void;
}

import type { StoreState } from "../index";

export const createVaultSlice: StateCreator<StoreState, [], [], VaultSlice> = (set, get) => ({
  entries: [],
  activeNote: null,
  isVaultLoading: false,
  vaultError: null,
  tags: [],
  activeTagFilters: [],
  searchResults: [],
  sidebarQuery: "",
  noteCache: {},
  noteScrollPositions: {},

  loadVault: async () => {
    set({ isVaultLoading: true, vaultError: null });
    try {
      const entries = await invoke<VaultEntry[]>("list_vault");
      set({ entries, isVaultLoading: false });
    } catch (e) {
      set({ vaultError: String(e), isVaultLoading: false });
    }
  },

  loadTags: async () => {
    try {
      const tags = await invoke<TagCount[]>("list_tags");
      set({ tags });
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  clearTags: () => {
    set({ tags: [] });
  },

  toggleTagFilter: (tag: string) => {
    const { activeTagFilters } = get();
    if (activeTagFilters.includes(tag)) {
      set({ activeTagFilters: activeTagFilters.filter((t: string) => t !== tag) });
    } else {
      set({ activeTagFilters: [...activeTagFilters, tag] });
    }
  },

  clearTagFilters: () => {
    set({ activeTagFilters: [] });
  },

  searchNotes: async (query: string, titleOnly: boolean = false) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = await invoke<NoteData[]>("search_notes", { query, titleOnly });
      set({ searchResults: results });
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  clearSearch: () => {
    set({ searchResults: [] });
  },

  goHome: () => {
    set({ activeNote: null, currentFolder: null });
  },

  setSidebarQuery: (query: string) => {
    set({ sidebarQuery: query });
  },

  prefetchNote: async (path: string) => {
    const { noteCache } = get();
    if (noteCache[path]) return;

    try {
      const note = await invoke<NoteData>("read_note", { path });
      set((state: StoreState) => ({
        noteCache: { ...state.noteCache, [path]: note }
      }));
    } catch (e) {
      // Silently fail for prefetch
    }
  },

  clearCache: () => {
    set({ noteCache: {} });
  },

  updateNoteScrollPosition: (path: string, position: number) => {
    set((state) => ({
      noteScrollPositions: {
        ...state.noteScrollPositions,
        [path]: position,
      },
    }));
  },
});
