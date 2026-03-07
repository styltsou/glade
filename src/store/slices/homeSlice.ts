import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { NoteCard, NoteData } from "@/types";

export interface HomeSlice {
  pinnedNotes: NoteCard[];
  recentNotes: NoteCard[];
  isHomeLoading: boolean;
  noteCache: Record<string, NoteData>;

  loadPinned: () => Promise<void>;
  loadRecents: () => Promise<void>;
  loadAll: () => Promise<void>;
  pinNote: (path: string) => Promise<void>;
  unpinNote: (path: string) => Promise<void>;
  prefetchNote: (path: string) => Promise<void>;
  clearCache: () => void;
  onNoteOpened: (note: NoteCard) => void;
  homeScrollPos: number;
  setHomeScrollPos: (pos: number) => void;
}

import type { StoreState } from "../index";

export const createHomeSlice: StateCreator<StoreState, [], [], HomeSlice> = (set, get) => ({
  pinnedNotes: [],
  recentNotes: [],
  isHomeLoading: false,
  noteCache: {},
  homeScrollPos: 0,

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
      set({ recentNotes: recentNotes.slice(0, 9) });
    } catch (e) {
      console.error("Failed to load recent notes:", e);
    }
  },

  loadAll: async () => {
    const { pinnedNotes, recentNotes } = get();
    const hasData = pinnedNotes.length > 0 || recentNotes.length > 0;

    // Only show loading if we have no data at all
    if (!hasData) {
      set({ isHomeLoading: true });
    }

    try {
      await Promise.all([get().loadPinned(), get().loadRecents()]);
    } finally {
      set({ isHomeLoading: false });
    }
  },

  prefetchNote: async (path: string) => {
    const { noteCache } = get();
    if (noteCache[path]) return;

    try {
      const note = await invoke<NoteData>("read_note", { path });
      set({ noteCache: { ...get().noteCache, [path]: note } });
    } catch (e) {
      // Silently fail for prefetch
    }
  },

  clearCache: () => {
    set({ noteCache: {} });
  },

  onNoteOpened: (note: NoteCard) => {
    const { recentNotes } = get();
    // Move to top if already exists, else add to top
    const filtered = recentNotes.filter((n) => n.path !== note.path);
    set({
      recentNotes: [{ ...note, modified: new Date().toISOString() }, ...filtered].slice(0, 9),
    });
  },

  setHomeScrollPos: (pos: number) => {
    set({ homeScrollPos: pos });
  },

  pinNote: async (path: string) => {
    const previousPinned = get().pinnedNotes;
    const previousRecents = get().recentNotes;

    const noteToPin = previousRecents.find((n: NoteCard) => n.path === path);
    if (noteToPin) {
      set({
        pinnedNotes: [...previousPinned, { ...noteToPin, pinned: true }],
        recentNotes: previousRecents.filter((n: NoteCard) => n.path !== path),
      });
    }

    try {
      await invoke("pin_note", { path });
      const [pinned, recents] = await Promise.all([
        invoke<NoteCard[]>("get_pinned_notes"),
        invoke<NoteCard[]>("get_recent_notes"),
      ]);
      set({ pinnedNotes: pinned, recentNotes: recents });
    } catch (e) {
      console.error("Failed to pin note:", e);
      set({ pinnedNotes: previousPinned, recentNotes: previousRecents });
    }
  },

  unpinNote: async (path: string) => {
    const previousPinned = get().pinnedNotes;
    const previousRecents = get().recentNotes;

    const noteToUnpin = previousPinned.find((n: NoteCard) => n.path === path);
    if (noteToUnpin) {
      set({
        pinnedNotes: previousPinned.filter((n: NoteCard) => n.path !== path),
        recentNotes: [...previousRecents, { ...noteToUnpin, pinned: false }],
      });
    }

    try {
      await invoke("unpin_note", { path });
      const [pinned, recents] = await Promise.all([
        invoke<NoteCard[]>("get_pinned_notes"),
        invoke<NoteCard[]>("get_recent_notes"),
      ]);
      set({ pinnedNotes: pinned, recentNotes: recents });
    } catch (e) {
      console.error("Failed to unpin note:", e);
      set({ pinnedNotes: previousPinned, recentNotes: previousRecents });
    }
  },
});
