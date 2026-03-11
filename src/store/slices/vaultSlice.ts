import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { VaultEntry, NoteData, TagCount } from "@/types";
import { 
  addEntryToTree, 
  removeEntryFromTree, 
  moveEntryInTree, 
  updateEntryInTree 
} from "@/lib/tree";

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
  selectNote: (path: string, partial?: Partial<NoteData>) => Promise<void>;
  saveNote: (path: string, content: string) => Promise<void>;
  createNote: (folder?: string) => Promise<void>;
  renameNote: (path: string, newTitle: string) => Promise<void>;
  renameFolder: (path: string, newName: string) => Promise<void>;
  duplicateNote: (path: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  loadTags: () => Promise<void>;
  clearTags: () => void;
  toggleTagFilter: (tag: string) => void;
  clearTagFilters: () => void;
  searchNotes: (query: string, titleOnly?: boolean) => Promise<void>;
  clearSearch: () => void;
  updateNoteTags: (tags: string[]) => Promise<void>;
  goHome: () => void;
  setSidebarQuery: (query: string) => void;
  prefetchNote: (path: string) => Promise<void>;
  moveEntry: (fromPath: string, toPath: string) => Promise<void>;
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

  selectNote: async (path: string, partial?: Partial<NoteData>) => {
    const { noteCache } = get();
    
    // 1. Optimistic Update: Set activeNote immediately with whatever we have
    // This makes navigation feel instant.
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
        vaultError: null,
        currentFolder: null
      });
    }

    // 2. Fetch Latest: Always load the full note to ensure we have complete data
    try {
      const note = await invoke<NoteData>("read_note", { path });
      
      // Update cache
      set((state: StoreState) => ({ 
        noteCache: { ...state.noteCache, [path]: note } 
      }));

      // 3. Final Update: Only update activeNote if the user is still on this note
      // This prevents race conditions when switching notes rapidly.
      if (get().activeNote?.path === path) {
        set({ activeNote: note, vaultError: null });
      }
      
      invoke("record_note_opened", { path }).catch(() => {});
    } catch (e) {
      // If we don't have even partial data and loading failed
      if (!get().activeNote) {
        set({ vaultError: String(e) });
      }
    }
  },

  saveNote: async (path: string, content: string) => {
    try {
      await invoke("write_note", { path, content });
      const note = await invoke<NoteData>("read_note", { path });
      
      // Update cache and current note
      set((state: StoreState) => ({
        activeNote: state.activeNote?.path === path ? note : state.activeNote,
        noteCache: { ...state.noteCache, [path]: note },
        vaultError: null
      }));
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  createNote: async (folder?: string) => {
    try {
      const note = await invoke<NoteData>("create_note", { folder: folder ?? null });
      
      // Optimistically update entries tree
      const newEntry: VaultEntry = {
        name: note.title,
        path: note.path,
        is_dir: false,
        children: [],
        modified: note.updated,
        tags: note.tags,
      };
      
      const newEntries = addEntryToTree(get().entries, folder, newEntry);
      
      // Also add to noteCache
      set((state: StoreState) => ({
        entries: newEntries,
        activeNote: note,
        noteCache: { ...state.noteCache, [note.path]: note },
        vaultError: null
      }));
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  renameNote: async (path: string, newTitle: string) => {
    // Optimistically update entries tree
    const newEntries = updateEntryInTree(get().entries, path, { name: newTitle });
    
    const { noteCache, activeNote, pinnedNotes } = get();
    
    // Update pinned notes list
    const newPinned = pinnedNotes.map(n => n.path === path ? { ...n, title: newTitle } : n);

    const newCache = { ...noteCache };
    if (newCache[path]) {
      newCache[path] = { ...newCache[path]!, title: newTitle };
    }
    
    if (activeNote?.path === path) {
      set({ 
        entries: newEntries,
        activeNote: { ...activeNote, title: newTitle },
        noteCache: newCache,
        pinnedNotes: newPinned,
      });
    } else {
      set({ 
        entries: newEntries, 
        noteCache: newCache,
        pinnedNotes: newPinned,
      });
    }
    
    try {
      await invoke("rename_note", { path, newTitle });
    } catch (e) {
      // On error, reload vault to sync state
      await get().loadVault();
      set({ vaultError: String(e) });
    }
  },

  renameFolder: async (path: string, newName: string) => {
    try {
      await invoke("rename_folder", { path, new_name: newName });
      // Reload vault entirely to update all nested note paths correctly
      await get().loadVault();
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  duplicateNote: async (path: string) => {
    try {
      const note = await invoke<NoteData>("duplicate_note", { path });
      
      // Optimistically add to entries tree
      const newEntry: VaultEntry = {
        name: note.title,
        path: note.path,
        is_dir: false,
        children: [],
        modified: note.updated,
        tags: note.tags,
      };
      
      // Determine parent folder from path
      const parentPath = note.path.includes('/') 
        ? note.path.substring(0, note.path.lastIndexOf('/'))
        : undefined;
      
      const newEntries = addEntryToTree(get().entries, parentPath, newEntry);
      set({ entries: newEntries });
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  deleteEntry: async (path: string) => {
    // Optimistically update UI first
    const { activeNote, entries, noteCache, pinnedNotes } = get();
    
    const newEntries = removeEntryFromTree(entries, path);
    const newCache = { ...noteCache };
    delete newCache[path];

    const newPinned = pinnedNotes.filter((n: { path: string }) => n.path !== path);

    set({
      entries: newEntries,
      activeNote: activeNote?.path === path ? null : activeNote,
      noteCache: newCache,
      pinnedNotes: newPinned,
    });
    
    // Then call backend
    try {
      await invoke("delete_entry", { path });
    } catch (e) {
      // On error, reload vault to sync state
      await get().loadVault();
      set({ vaultError: String(e) });
    }
  },

  createFolder: async (path: string) => {
    try {
      // Optimistically update entries tree
      const folderName = path.split("/").pop() || path;
      const parentPath = path.includes("/")
        ? path.substring(0, path.lastIndexOf("/"))
        : undefined;

      const newEntry: VaultEntry = {
        name: folderName,
        path: path,
        is_dir: true,
        children: [],
        modified: new Date().toISOString(),
        tags: [],
      };

      const newEntries = addEntryToTree(get().entries, parentPath, newEntry);
      set({ entries: newEntries, vaultError: null });

      await invoke("create_folder", { path });
      // Reload vault to sync with server (ensures correct modification times etc)
      await get().loadVault();
    } catch (e) {
      set({ vaultError: String(e) });
      // Re-sync on error
      await get().loadVault();
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

  updateNoteTags: async (tags: string[]) => {
    const { activeNote } = get();
    if (!activeNote) return;
    try {
      await invoke("update_tags", { path: activeNote.path, tags });
      const note = await invoke<NoteData>("read_note", { path: activeNote.path });
      
      // Update both activeNote and noteCache
      set((state: StoreState) => ({
        activeNote: note,
        noteCache: { ...state.noteCache, [activeNote.path]: note },
      }));
      await get().loadTags();
    } catch (e) {
      set({ vaultError: String(e) });
    }
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

  moveEntry: async (fromPath: string, toPath: string) => {
    const originalEntries = get().entries;
    const newEntries = moveEntryInTree(originalEntries, fromPath, toPath);
    
    set({ entries: newEntries });
    
    try {
      await invoke("move_entry", { fromPath, toPath });
      // Reload everything to stay in sync with backend state (tags, etc.)
      await get().loadVault();
      await get().loadTags();
    } catch (e) {
      // Rollback on error
      set({ entries: originalEntries, vaultError: String(e) });
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
