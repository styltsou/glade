import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { NoteCard } from "@/types";

export interface HomeSlice {
  pinnedNotes: NoteCard[];
  folderNotes: NoteCard[];
  isHomeLoading: boolean;
  currentFolder: string | null;

  loadPinned: () => Promise<void>;
  loadFolderNotes: (path?: string | null) => Promise<void>;
  loadAll: () => Promise<void>;
  pinNote: (path: string) => Promise<void>;
  unpinNote: (path: string) => Promise<void>;
  onNoteOpened: (note: NoteCard) => void;
  setCurrentFolder: (path: string | null) => void;
  navigateToFolder: (path: string | null) => void;
}

import type { StoreState } from "../index";

export const createHomeSlice: StateCreator<StoreState, [], [], HomeSlice> = (set, get) => ({
  pinnedNotes: [],
  folderNotes: [],
  isHomeLoading: false,
  currentFolder: null,

  loadPinned: async () => {
    try {
      const pinnedNotes = await invoke<NoteCard[]>("get_pinned_notes");
      set({ pinnedNotes });
    } catch (e) {
      console.error("Failed to load pinned notes:", e);
    }
  },

  loadFolderNotes: async (path) => {
    try {
      const folderPath = path === undefined ? get().currentFolder : path;
      const folderNotes = await invoke<NoteCard[]>("get_notes_in_folder", { 
        folder: folderPath || null 
      });
      set({ folderNotes });
    } catch (e) {
      console.error("Failed to load folder notes:", e);
    }
  },

  loadAll: async () => {
    const { folderNotes, pinnedNotes } = get();
    const hasData = pinnedNotes.length > 0 || folderNotes.length > 0;

    if (!hasData) {
      set({ isHomeLoading: true });
    }

    try {
      await Promise.all([get().loadPinned(), get().loadFolderNotes()]);
    } finally {
      set({ isHomeLoading: false });
    }
  },

  onNoteOpened: (_note: NoteCard) => {
    // We no longer manage local recents list, 
    // but we might want to refresh current folder if needed.
    // For now, doing nothing is fine as we refresh on view enter.
  },

  pinNote: async (path: string) => {
    const previousPinned = get().pinnedNotes;

    const noteToPin = get().folderNotes.find((n: NoteCard) => n.path === path);
    if (noteToPin) {
      set({
        pinnedNotes: [...previousPinned, { ...noteToPin, pinned: true }],
        folderNotes: get().folderNotes.map((n: NoteCard) => 
          n.path === path ? { ...n, pinned: true } : n
        ),
      });
    }

    try {
      await invoke("pin_note", { path });
      get().loadPinned();
      get().loadFolderNotes();
    } catch (e) {
      console.error("Failed to pin note:", e);
      set({ pinnedNotes: previousPinned });
    }
  },

  unpinNote: async (path: string) => {
    const previousPinned = get().pinnedNotes;

    const noteToUnpin = previousPinned.find((n: NoteCard) => n.path === path);
    if (noteToUnpin) {
      set({
        pinnedNotes: previousPinned.filter((n: NoteCard) => n.path !== path),
        folderNotes: get().folderNotes.map((n: NoteCard) => 
          n.path === path ? { ...n, pinned: false } : n
        ),
      });
    }

    try {
      await invoke("unpin_note", { path });
      get().loadPinned();
      get().loadFolderNotes();
    } catch (e) {
      console.error("Failed to unpin note:", e);
      set({ pinnedNotes: previousPinned });
    }
  },

  setCurrentFolder: (path: string | null) => {
    set({ currentFolder: path });
    get().loadFolderNotes(path);
  },

  navigateToFolder: (path: string | null) => {
    set({ activeNote: null, currentFolder: path });
    get().loadFolderNotes(path);
  },
});
