import { StateCreator } from "zustand";

export interface DialogSlice {
  // Rename dialog
  renameOpen: boolean;
  renamePath: string | null;
  renameInitialTitle: string;
  renameIsFolder: boolean;
  openRename: (path: string, title: string, isFolder?: boolean) => void;
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
  renameInitialTitle: "",
  renameIsFolder: false,
  openRename: (path, title, isFolder = false) =>
    set({ renameOpen: true, renamePath: path, renameInitialTitle: title, renameIsFolder: isFolder }),
  closeRename: () =>
    set({ renameOpen: false, renamePath: null, renameInitialTitle: "", renameIsFolder: false }),

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
