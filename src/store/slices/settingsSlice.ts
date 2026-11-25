import { StateCreator } from "zustand";
import type { StoreState } from "../index";

/** What names a note across the app: its title (first H1) or its file name. */
export type NoteLabel = "title" | "filename";

export interface SettingsSlice {
  noteLabel: NoteLabel;
  setNoteLabel: (noteLabel: NoteLabel) => void;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
}

export const createSettingsSlice: StateCreator<StoreState, [], [], SettingsSlice> = (set) => ({
  noteLabel: "title",
  setNoteLabel: (noteLabel) => set({ noteLabel }),
  settingsOpen: false,
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
});
