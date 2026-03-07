import { StateCreator } from "zustand";

export interface DialogSlice {
  // Rename dialog
  renameOpen: boolean;
  renamePath: string | null;
  renameInitialTitle: string;
  openRename: (path: string, title: string) => void;
  closeRename: () => void;

  // Delete dialog
  deleteOpen: boolean;
  deletePath: string | null;
  deleteName: string;
  deleteIsFolder: boolean;
  openDelete: (path: string, name: string, isFolder?: boolean) => void;
  closeDelete: () => void;

  // Settings dialog
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

import type { StoreState } from "../index";

export const createDialogSlice: StateCreator<StoreState, [], [], DialogSlice> = (set) => ({
  renameOpen: false,
  renamePath: null,
  renameInitialTitle: "",
  openRename: (path, title) =>
    set({ renameOpen: true, renamePath: path, renameInitialTitle: title }),
  closeRename: () =>
    set({ renameOpen: false, renamePath: null, renameInitialTitle: "" }),

  deleteOpen: false,
  deletePath: null,
  deleteName: "",
  deleteIsFolder: false,
  openDelete: (path, name, isFolder = false) =>
    set({ deleteOpen: true, deletePath: path, deleteName: name, deleteIsFolder: isFolder }),
  closeDelete: () =>
    set({ deleteOpen: false, deletePath: null, deleteName: "", deleteIsFolder: false }),

  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
});
