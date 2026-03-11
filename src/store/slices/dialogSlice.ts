import { StateCreator } from "zustand";

export interface DialogSlice {
  // Current view
  currentView: "home" | "settings";
  setCurrentView: (view: "home" | "settings") => void;

  // Settings page
  settingsSection: "vaults" | "appearance" | "about";
  setSettingsSection: (section: "vaults" | "appearance" | "about") => void;
  openSettingsPage: (section?: "vaults" | "appearance" | "about") => void;
  closeSettingsPage: () => void;

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
  settingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
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

  settingsOpen: false,
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),

  currentView: "home",
  setCurrentView: (view) => set({ currentView: view }),

  settingsSection: "vaults",
  setSettingsSection: (section) => set({ settingsSection: section }),
  openSettingsPage: (section) => set({ 
    currentView: "settings", 
    settingsSection: section || "vaults",
    settingsOpen: false 
  }),
  closeSettingsPage: () => set({ currentView: "home" }),
});
