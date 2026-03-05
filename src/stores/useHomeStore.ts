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
    const { pinnedNotes, recentNotes } = get();
    const hasData = pinnedNotes.length > 0 || recentNotes.length > 0;

    if (!hasData) {
      set({ isLoading: true });
    }

    try {
      await Promise.all([get().loadPinned(), get().loadRecents()]);
    } finally {
      set({ isLoading: false });
    }
  },

  pinNote: async (path: string) => {
    const previousPinned = get().pinnedNotes;
    const previousRecents = get().recentNotes;

    // Optimistically update
    const noteToPin = previousRecents.find((n) => n.path === path);
    if (noteToPin) {
      set({
        pinnedNotes: [...previousPinned, { ...noteToPin, pinned: true }],
        recentNotes: previousRecents.filter((n) => n.path !== path),
      });
    }

    try {
      await invoke("pin_note", { path });
      // Silent refresh to ensure consistency with backend
      const [pinned, recents] = await Promise.all([
        invoke<NoteCard[]>("get_pinned_notes"),
        invoke<NoteCard[]>("get_recent_notes"),
      ]);
      set({ pinnedNotes: pinned, recentNotes: recents });
    } catch (e) {
      console.error("Failed to pin note:", e);
      // Revert on failure
      set({ pinnedNotes: previousPinned, recentNotes: previousRecents });
    }
  },

  unpinNote: async (path: string) => {
    const previousPinned = get().pinnedNotes;
    const previousRecents = get().recentNotes;

    // Optimistically update
    const noteToUnpin = previousPinned.find((n) => n.path === path);
    if (noteToUnpin) {
      set({
        pinnedNotes: previousPinned.filter((n) => n.path !== path),
        recentNotes: [...previousRecents, { ...noteToUnpin, pinned: false }],
      });
    }

    try {
      await invoke("unpin_note", { path });
      // Silent refresh
      const [pinned, recents] = await Promise.all([
        invoke<NoteCard[]>("get_pinned_notes"),
        invoke<NoteCard[]>("get_recent_notes"),
      ]);
      set({ pinnedNotes: pinned, recentNotes: recents });
    } catch (e) {
      console.error("Failed to unpin note:", e);
      // Revert on failure
      set({ pinnedNotes: previousPinned, recentNotes: previousRecents });
    }
  },
}));
