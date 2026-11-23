import { invoke } from "@tauri-apps/api/core";
import type { StateCreator } from "zustand";
import { toast } from "sonner";
import type { NoteData, TagCount, VaultEntry } from "@/types";

export interface VaultSlice {
  entries: VaultEntry[];
  activeNote: NoteData | null;
  isVaultLoading: boolean;
  isVaultLoaded: boolean;
  vaultError: string | null;
  tags: TagCount[];
  activeTagFilters: string[];
  searchResults: NoteData[];
  sidebarQuery: string;
  idToPath: Record<string, string>;
  noteCache: Record<string, NoteData>;
  noteScrollPositions: Record<string, number>;

  loadVault: () => Promise<void>;
  loadTags: () => Promise<void>;
  clearTags: () => void;
  toggleTagFilter: (tag: string) => void;
  clearTagFilters: () => void;
  /** Rename a tag everywhere; naming an existing tag merges the two. */
  renameTag: (from: string, to: string) => Promise<boolean>;
  searchNotes: (query: string, titleOnly?: boolean) => Promise<void>;
  clearSearch: () => void;
  goHome: () => void;
  setSidebarQuery: (query: string) => void;
  prefetchNote: (path: string) => Promise<void>;
  clearCache: () => void;
  updateNoteScrollPosition: (path: string, position: number) => void;
}

import type { StoreState } from "../index";

export const buildIdMapping = (
  items: VaultEntry[],
  mapping: Record<string, string> = {},
) => {
  items.forEach((item) => {
    mapping[item.id] = item.path;
    if (item.children) {
      buildIdMapping(item.children, mapping);
    }
  });
  return mapping;
};

export const createVaultSlice: StateCreator<StoreState, [], [], VaultSlice> = (
  set,
  get,
) => ({
  entries: [],
  activeNote: null,
  isVaultLoading: false,
  isVaultLoaded: false,
  vaultError: null,
  tags: [],
  activeTagFilters: [],
  searchResults: [],
  sidebarQuery: "",
  idToPath: {},
  noteCache: {},
  noteScrollPositions: {},

  loadVault: async () => {
    // Only the first load shows skeletons; refreshes (file watcher, renames,
    // moves) update in place instead of flashing the tree.
    if (get().entries.length === 0) set({ isVaultLoading: true, vaultError: null });
    else set({ vaultError: null });

    try {
      const entries = await invoke<VaultEntry[]>("list_vault");
      const idToPath = buildIdMapping(entries);
      set({ entries, idToPath, isVaultLoading: false, isVaultLoaded: true });
    } catch (e) {
      set({
        vaultError: String(e),
        isVaultLoading: false,
        isVaultLoaded: false,
      });
    }
  },

  loadTags: async () => {
    try {
      const tags = await invoke<TagCount[]>("list_tags");
      const { activeTagFilters } = get();

      // Prune active filters: remove any filter that no longer exists in the global tags list
      if (activeTagFilters.length > 0) {
        const existingTagNames = new Set(tags.map((t) => t.name));
        const prunedFilters = activeTagFilters.filter((tag) =>
          existingTagNames.has(tag),
        );

        if (prunedFilters.length !== activeTagFilters.length) {
          set({ tags, activeTagFilters: prunedFilters });
        } else {
          set({ tags });
        }
      } else {
        set({ tags });
      }
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
      set({
        activeTagFilters: activeTagFilters.filter((t: string) => t !== tag),
      });
    } else {
      set({ activeTagFilters: [...activeTagFilters, tag] });
    }
  },

  clearTagFilters: () => {
    set({ activeTagFilters: [] });
  },

  renameTag: async (from: string, to: string) => {
    const name = to.trim().replace(/^#/, "").trim();
    try {
      const changed = await invoke<string[]>("rename_tag", { from, to: name });
      set((s) => ({
        activeTagFilters: [...new Set(s.activeTagFilters.map((t) => (t === from ? name : t)))],
      }));
      await get().loadVault();
      await get().loadTags();
      // Notes already open show their tags from memory.
      const { noteCache, activeNote } = get();
      for (const path of changed) {
        if (noteCache[path] || activeNote?.path === path) void get().refreshNoteMeta(path);
      }
      return true;
    } catch (e) {
      toast.error(`Couldn't rename "${from}"`, { description: String(e).replace(/^(Error|Invalid path): /, "") });
      return false;
    }
  },

  searchNotes: async (query: string, titleOnly: boolean = false) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = await invoke<NoteData[]>("search_notes", {
        query,
        titleOnly,
      });
      set({ searchResults: results });
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  clearSearch: () => {
    set({ searchResults: [] });
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
        noteCache: { ...state.noteCache, [path]: note },
      }));
    } catch (e) {
      // Silently fail for prefetch
    }
  },

  clearCache: () => {
    set({ noteCache: {}, entries: [], isVaultLoaded: false });
  },

  goHome: () => {
    get().setFocusedPathNull();
    set({
      activeNote: null,
      currentFolder: null,
      pinnedNotes: [],
      folderNotes: [],
    });
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
