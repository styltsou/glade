import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { NoteCard } from "@/types";

interface HomeState {
  pinnedNotes: NoteCard[];
  recentNotes: NoteCard[];
  isLoading: boolean;

  loadPinned: () => Promise<void>;
  loadRecents: () => Promise<void>;
  loadAll: () => Promise<void>;
  pinNote: (path: string) => Promise<void>;
  unpinNote: (path: string) => Promise<void>;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  pinnedNotes: [],
  recentNotes: [],
  isLoading: false,

  loadPinned: async () => {
    try {
      const pinnedNotes = await invoke<NoteCard[]>("get_pinned_notes");
      set({ pinnedNotes });
    } catch (e) {
      console.error("Failed to load pinned notes:", e);
    }
  },

  loadRecents: async () => {
    try {
      const recentNotes = await invoke<NoteCard[]>("get_recent_notes");
      set({ recentNotes });
    } catch (e) {
      console.error("Failed to load recent notes:", e);
    }
  },

  loadAll: async () => {
    set({ isLoading: true });
    await Promise.all([get().loadPinned(), get().loadRecents()]);
    set({ isLoading: false });
  },

  pinNote: async (path: string) => {
    try {
      await invoke("pin_note", { path });
      await get().loadAll();
    } catch (e) {
      console.error("Failed to pin note:", e);
    }
  },

  unpinNote: async (path: string) => {
    try {
      await invoke("unpin_note", { path });
      await get().loadAll();
    } catch (e) {
      console.error("Failed to unpin note:", e);
    }
  },
}));
