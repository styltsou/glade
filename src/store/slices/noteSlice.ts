import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { VaultEntry, NoteData } from "@/types";
import { 
  addEntryToTree, 
  removeEntryFromTree, 
  moveEntryInTree, 
  updateEntryInTree 
} from "@/lib/tree";

export interface NoteSlice {
  selectNote: (path: string, partial?: Partial<NoteData>) => Promise<void>;
  saveNote: (path: string, content: string) => Promise<void>;
  createNote: (folder?: string) => Promise<void>;
  renameNote: (path: string, newTitle: string) => Promise<void>;
  renameFolder: (path: string, newName: string) => Promise<void>;
  duplicateNote: (path: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  updateNoteTags: (tags: string[]) => Promise<void>;
  moveEntry: (fromPath: string, toPath: string) => Promise<void>;
  tocOpen: Record<string, boolean>;
  toggleToc: (path: string) => void;
  tocWidth: number;
  setTocWidth: (width: number) => void;
  noteEditMode: Record<string, boolean>;
  setNoteEditMode: (path: string, isEditMode: boolean) => void;
  isRawMode: Record<string, boolean>;
  toggleRawMode: (path: string) => void;
  mermaidFullscreenOpen: boolean;
  setMermaidFullscreenOpen: (open: boolean) => void;
}

import type { StoreState } from "../index";

export const createNoteSlice: StateCreator<StoreState, [], [], NoteSlice> = (set, get) => ({
  selectNote: async (path: string, partial?: Partial<NoteData>) => {
    const { noteCache } = get();
    
    if (partial || noteCache[path]) {
      const cached = noteCache[path];
      set({ 
        activeNote: {
          id: partial?.id || cached?.id || "",
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

    try {
      const note = await invoke<NoteData>("read_note", { path });
      
      set((state: StoreState) => ({ 
        noteCache: { ...state.noteCache, [path]: note } 
      }));

      if (get().activeNote?.path === path) {
        set({ activeNote: note, vaultError: null });
      }
      
      invoke("record_note_opened", { path }).catch(() => {});
    } catch (e) {
      if (!get().activeNote) {
        set({ vaultError: String(e) });
      }
    }
  },

  saveNote: async (path: string, content: string) => {
    try {
      await invoke("write_note", { path, content });
      const note = await invoke<NoteData>("read_note", { path });
      
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
      
      const newEntry: VaultEntry = {
        id: note.id,
        name: note.title,
        path: note.path,
        is_dir: false,
        children: [],
        modified: note.updated,
        created_at: note.created,
        tags: note.tags,
      };
      
      const newEntries = addEntryToTree(get().entries, folder, newEntry);
      
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
    const newEntries = updateEntryInTree(get().entries, path, { name: newTitle });
    
    const { noteCache, activeNote, pinnedNotes } = get();
    
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
      get().loadFolderNotes();
    } catch (e) {
      await get().loadVault();
      set({ vaultError: String(e) });
    }
  },

  renameFolder: async (path: string, newName: string) => {
    try {
      await invoke("rename_folder", { path, newName });
      await get().loadVault();
      await get().loadTags();
      get().loadFolderNotes();
    } catch (e) {
      await get().loadVault();
      set({ vaultError: String(e) });
    }
  },

  duplicateNote: async (path: string) => {
    try {
      const note = await invoke<NoteData>("duplicate_note", { path });
      
      const newEntry: VaultEntry = {
        id: note.id,
        name: note.title,
        path: note.path,
        is_dir: false,
        children: [],
        modified: note.updated,
        created_at: note.created,
        tags: note.tags,
      };
      
      const parentPath = note.path.includes('/') 
        ? note.path.substring(0, note.path.lastIndexOf('/'))
        : undefined;
      
      const newEntries = addEntryToTree(get().entries, parentPath, newEntry);
      set({ entries: newEntries });
      get().loadFolderNotes();
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  deleteEntry: async (path: string) => {
    const { activeNote, entries, noteCache, pinnedNotes, folderNotes } = get();
    
    const newEntries = removeEntryFromTree(entries, path);

    const newCache = { ...noteCache };
    delete newCache[path];
    if (path.includes('/')) {
      const folderPrefix = path + '/';
      for (const cachePath of Object.keys(newCache)) {
        if (cachePath.startsWith(folderPrefix)) {
          delete newCache[cachePath];
        }
      }
    }

    const newPinned = pinnedNotes.filter((n: { path: string }) => {
      if (n.path === path) return false;
      if (path.includes('/')) {
        const folderPrefix = path + '/';
        if (n.path.startsWith(folderPrefix)) return false;
      }
      return true;
    });

    const newFolderNotes = folderNotes.filter((n: { path: string }) => {
      if (n.path === path) return false;
      if (path.includes('/')) {
        const folderPrefix = path + '/';
        if (n.path.startsWith(folderPrefix)) return false;
      }
      return true;
    });

    set({
      entries: newEntries,
      activeNote: activeNote?.path === path ? null : activeNote,
      noteCache: newCache,
      pinnedNotes: newPinned,
      folderNotes: newFolderNotes,
    });
    
    try {
      await invoke("delete_entry", { path });
      get().loadFolderNotes();
    } catch (e) {
      await get().loadVault();
      set({ vaultError: String(e) });
    }
  },

  createFolder: async (path: string) => {
    try {
      await invoke("create_folder", { path });
      await get().loadVault();
      get().loadFolderNotes();
    } catch (e) {
      set({ vaultError: String(e) });
      await get().loadVault();
    }
  },

  updateNoteTags: async (tags: string[]) => {
    const { activeNote, entries, noteCache } = get();
    if (!activeNote) return;

    // 1. Optimistic update of activeNote and cache
    const updatedNote = { ...activeNote, tags };
    set({
      activeNote: updatedNote,
      noteCache: { ...noteCache, [activeNote.path]: updatedNote },
    });

    // 2. Optimistic update of the entries tree
    const newEntries = updateEntryInTree(entries, activeNote.path, { tags });
    set({ entries: newEntries });

    try {
      // 3. Persist to backend
      await invoke("update_tags", { path: activeNote.path, tags });
      
      // 4. Refresh global tags list (this is usually fast and non-disruptive)
      await get().loadTags();
      
      // We skip loadVault() on success since entries are updated optimistically above.
      // This avoids the flash caused by toggling isVaultLoading.
    } catch (e) {
      set({ vaultError: String(e) });
      // On error, reload vault to ensure consistency
      await get().loadVault();
    }
  },

  moveEntry: async (fromPath: string, toPath: string) => {
    const originalEntries = get().entries;
    const newEntries = moveEntryInTree(originalEntries, fromPath, toPath);
    
    set({ entries: newEntries });
    
    try {
      await invoke("move_entry", { fromPath, toPath });
      await get().loadVault();
      await get().loadTags();
      get().loadFolderNotes();

      const { activeNote } = get();
      if (activeNote?.path === fromPath) {
        set({ activeNote: { ...activeNote, path: toPath } as NoteData });
      }
    } catch (e) {
      set({ entries: originalEntries, vaultError: String(e) });
    }
  },

  tocOpen: {},

  toggleToc: (path: string) => {
    set((state: StoreState) => ({
      tocOpen: {
        ...state.tocOpen,
        [path]: !state.tocOpen[path],
      },
    }));
  },

  tocWidth: 280,

  setTocWidth: (width: number) => {
    set({ tocWidth: width });
  },

  noteEditMode: {},

  setNoteEditMode: (path: string, isEditMode: boolean) => {
    set((state: StoreState) => ({
      noteEditMode: {
        ...state.noteEditMode,
        [path]: isEditMode,
      },
    }));
  },

  isRawMode: {},

  toggleRawMode: (path: string) => {
    set((state: StoreState) => ({
      isRawMode: {
        ...state.isRawMode,
        [path]: !state.isRawMode[path],
      },
    }));
  },

  mermaidFullscreenOpen: false,

  setMermaidFullscreenOpen: (open: boolean) => {
    set({ mermaidFullscreenOpen: open });
  },
});
