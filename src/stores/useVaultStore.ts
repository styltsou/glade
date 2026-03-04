import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { VaultEntry, NoteData, TagCount } from "@/types";
import { useHomeStore } from "./useHomeStore";

interface VaultState {
  /** Tree of vault entries */
  entries: VaultEntry[];
  /** Currently selected/open note */
  activeNote: NoteData | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** All unique tags with counts */
  tags: TagCount[];
  /** Currently active tag filters */
  activeTagFilters: string[];
  /** Search results */
  searchResults: NoteData[];

  /** Load vault contents from disk */
  loadVault: () => Promise<void>;
  /** Select and open a note by path */
  selectNote: (path: string) => Promise<void>;
  /** Save note content to disk */
  saveNote: (path: string, content: string) => Promise<void>;
  /** Create a new note, optionally in a folder */
  createNote: (folder?: string) => Promise<void>;
  /** Rename a note */
  renameNote: (path: string, newTitle: string) => Promise<void>;
  /** Duplicate a note */
  duplicateNote: (path: string) => Promise<void>;
  /** Delete a file or folder */
  deleteEntry: (path: string) => Promise<void>;
  /** Create a new folder */
  createFolder: (path: string) => Promise<void>;
  /** Load all tags */
  loadTags: () => Promise<void>;
  /** Toggle a tag filter */
  toggleTagFilter: (tag: string) => void;
  /** Clear all tag filters */
  clearTagFilters: () => void;
  /** Search notes by query */
  searchNotes: (query: string) => Promise<void>;
  /** Clear search results */
  clearSearch: () => void;
  /** Update tags for the active note */
  updateNoteTags: (tags: string[]) => Promise<void>;
  /** Clear active note to go to home view */
  goHome: () => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  entries: [],
  activeNote: null,
  isLoading: false,
  error: null,
  tags: [],
  activeTagFilters: [],
  searchResults: [],

  loadVault: async () => {
    set({ isLoading: true, error: null });
    try {
      const entries = await invoke<VaultEntry[]>("list_vault");
      set({ entries, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  selectNote: async (path: string) => {
    try {
      const note = await invoke<NoteData>("read_note", { path });
      set({ activeNote: note, error: null });
      // Record in recents (fire-and-forget)
      invoke("record_note_opened", { path }).catch(() => {});
    } catch (e) {
      set({ error: String(e) });
    }
  },

  saveNote: async (path: string, content: string) => {
    try {
      await invoke("write_note", { path, content });
      const note = await invoke<NoteData>("read_note", { path });
      set({ activeNote: note, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createNote: async (folder?: string) => {
    try {
      const note = await invoke<NoteData>("create_note", {
        folder: folder ?? null,
      });
      await get().loadVault();
      await useHomeStore.getState().loadAll();
      set({ activeNote: note, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  renameNote: async (path: string, newTitle: string) => {
    try {
      await invoke("rename_note", { path, newTitle });
      const { activeNote } = get();
      if (activeNote?.path === path) {
        set({ activeNote: { ...activeNote, title: newTitle } });
      }
      await get().loadVault();
      await useHomeStore.getState().loadAll();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  duplicateNote: async (path: string) => {
    try {
      await invoke<NoteData>("duplicate_note", { path });
      await get().loadVault();
      await useHomeStore.getState().loadAll();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteEntry: async (path: string) => {
    try {
      await invoke("delete_entry", { path });
      const { activeNote } = get();
      if (activeNote?.path === path) {
        set({ activeNote: null });
      }
      await get().loadVault();
      await useHomeStore.getState().loadAll();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  createFolder: async (path: string) => {
    try {
      await invoke("create_folder", { path });
      await get().loadVault();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadTags: async () => {
    try {
      const tags = await invoke<TagCount[]>("list_tags");
      set({ tags });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  toggleTagFilter: (tag: string) => {
    const { activeTagFilters } = get();
    if (activeTagFilters.includes(tag)) {
      set({ activeTagFilters: activeTagFilters.filter((t) => t !== tag) });
    } else {
      set({ activeTagFilters: [...activeTagFilters, tag] });
    }
  },

  clearTagFilters: () => {
    set({ activeTagFilters: [] });
  },

  searchNotes: async (query: string) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = await invoke<NoteData[]>("search_notes", { query });
      set({ searchResults: results });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  clearSearch: () => {
    set({ searchResults: [] });
  },

  updateNoteTags: async (tags: string[]) => {
    const { activeNote } = get();
    if (!activeNote) return;
    try {
      await invoke("update_tags", { path: activeNote.path, tags });
      // Reload note and tags
      const note = await invoke<NoteData>("read_note", {
        path: activeNote.path,
      });
      set({ activeNote: note });
      await get().loadTags();
      await useHomeStore.getState().loadAll();
    } catch (e) {
      set({ error: String(e) });
    }
  },
  goHome: () => {
    set({ activeNote: null });
  },
}));
