import { StateCreator } from "zustand";

export interface DialogSlice {
  // Rename dialog (a note's file or a folder; titles are edited in the note)
  renameOpen: boolean;
  renamePath: string | null;
  renameIsFolder: boolean;
  openRename: (path: string, isFolder?: boolean) => void;
  closeRename: () => void;

  // Create Folder dialog
  createFolderOpen: boolean;
  createFolderParentPath: string | null;
  openCreateFolder: (parentPath?: string) => void;
  closeCreateFolder: () => void;

  // Delete dialog
  deleteOpen: boolean;
  deletePath: string | null;
  deleteName: string;
  deleteIsFolder: boolean;
  openDelete: (path: string, name: string, isFolder?: boolean) => void;
  closeDelete: () => void;

  // Settings dialog


}

import type { StoreState } from "../index";

export const createDialogSlice: StateCreator<StoreState, [], [], DialogSlice> = (set) => ({
  renameOpen: false,
  renamePath: null,
  renameIsFolder: false,
  openRename: (path, isFolder = false) =>
    set({ renameOpen: true, renamePath: path, renameIsFolder: isFolder }),
  // The path stays, so the dialog doesn't empty while it fades out.
  closeRename: () => set({ renameOpen: false }),

  createFolderOpen: false,
  createFolderParentPath: null,
  openCreateFolder: (parentPath) =>
    set({ createFolderOpen: true, createFolderParentPath: parentPath || null }),
  closeCreateFolder: () =>
    set({ createFolderOpen: false, createFolderParentPath: null }),

  deleteOpen: false,
  deletePath: null,
  deleteName: "",
  deleteIsFolder: false,
  openDelete: (path, name, isFolder = false) =>
    set({ deleteOpen: true, deletePath: path, deleteName: name, deleteIsFolder: isFolder }),
  closeDelete: () =>
    set({ deleteOpen: false, deletePath: null, deleteName: "", deleteIsFolder: false }),

});
