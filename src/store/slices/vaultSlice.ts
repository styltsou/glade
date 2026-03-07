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

  loadVault: () => Promise<void>;
  selectNote: (path: string, partial?: Partial<NoteData>) => Promise<void>;
  saveNote: (path: string, content: string) => Promise<void>;
  createNote: (folder?: string) => Promise<void>;
  renameNote: (path: string, newTitle: string) => Promise<void>;
  duplicateNote: (path: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  loadTags: () => Promise<void>;
  toggleTagFilter: (tag: string) => void;
  clearTagFilters: () => void;
  searchNotes: (query: string, titleOnly?: boolean) => Promise<void>;
  clearSearch: () => void;
  updateNoteTags: (tags: string[]) => Promise<void>;
  goHome: () => void;
  setSidebarQuery: (query: string) => void;
}

export const createVaultSlice: StateCreator<any, [], [], VaultSlice> = (set, get) => ({
  entries: [],
  activeNote: null,
  isVaultLoading: false,
  vaultError: null,
  tags: [],
  activeTagFilters: [],
  searchResults: [],
  sidebarQuery: "",

  loadVault: async () => {
    set({ isVaultLoading: true, vaultError: null });
    try {
      const entries = await invoke<VaultEntry[]>("list_vault");
      set({ entries, isVaultLoading: false });
    } catch (e) {
      set({ vaultError: String(e), isVaultLoading: false });
    }
  },

  selectNote: async (path: string, partial?: Partial<NoteData>) => {
    const { noteCache } = get();
    
    // Optimistic update: If we have partial data (from a card or tree), set it immediately
    // so the editor can show the title and transition instantly.
    if (partial || noteCache[path]) {
      const cached = noteCache[path];
      set({ 
        activeNote: {
          path,
          title: partial?.title || cached?.title || path.split("/").pop()?.replace(".md", "") || "Untitled",
          body: cached?.body || "",
          tags: partial?.tags || cached?.tags || [],
          preview: partial?.preview || cached?.preview || "",
          created: cached?.created || null,
          updated: cached?.updated || null,
          ...partial,
        } as NoteData,
        vaultError: null 
      });
    }

    try {
      const note = await invoke<NoteData>("read_note", { path });
      set({ activeNote: note, vaultError: null });
      
      // Update cache
      set({ noteCache: { ...get().noteCache, [path]: note } });
      
      invoke("record_note_opened", { path }).catch(() => {});
    } catch (e) {
      // Only show error if we don't have even partial data
      if (!get().activeNote) {
        set({ vaultError: String(e) });
      }
    }
  },

  saveNote: async (path: string, content: string) => {
    try {
      await invoke("write_note", { path, content });
      const note = await invoke<NoteData>("read_note", { path });
      set({ activeNote: note, vaultError: null });
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  createNote: async (folder?: string) => {
    try {
      const note = await invoke<NoteData>("create_note", { folder: folder ?? null });
      await get().loadVault();
      await get().loadAll();
      set({ activeNote: note, vaultError: null });
    } catch (e) {
      set({ vaultError: String(e) });
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
      await get().loadAll();
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  duplicateNote: async (path: string) => {
    try {
      await invoke<NoteData>("duplicate_note", { path });
      await get().loadVault();
      await get().loadAll();
    } catch (e) {
      set({ vaultError: String(e) });
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
      await get().loadAll();
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  createFolder: async (path: string) => {
    try {
      await invoke("create_folder", { path });
      await get().loadVault();
    } catch (e) {
      set({ vaultError: String(e) });
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

  updateNoteTags: async (tags: string[]) => {
    const { activeNote } = get();
    if (!activeNote) return;
    try {
      await invoke("update_tags", { path: activeNote.path, tags });
      const note = await invoke<NoteData>("read_note", { path: activeNote.path });
      set({ activeNote: note });
      await get().loadTags();
      await get().loadAll();
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  goHome: () => {
    set({ activeNote: null });
  },

  setSidebarQuery: (query: string) => {
    set({ sidebarQuery: query });
  },
});
