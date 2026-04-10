import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createThemeSlice, type ThemeSlice } from "./slices/themeSlice";
import { createVaultsSlice, type VaultsSlice } from "./slices/vaultsSlice";
import { createVaultSlice, type VaultSlice } from "./slices/vaultSlice";
import { createNoteSlice, type NoteSlice } from "./slices/noteSlice";
import { createDialogSlice, type DialogSlice } from "./slices/dialogSlice";
import { createHomeSlice, type HomeSlice } from "./slices/homeSlice";
import { createSidebarSlice, type SidebarSlice } from "./slices/sidebarSlice";

export type StoreState = ThemeSlice &
  VaultsSlice &
  VaultSlice &
  NoteSlice &
  DialogSlice &
  HomeSlice &
  SidebarSlice;


export const useStore = create<StoreState>()(
  persist(
    (...a) => ({
      ...createThemeSlice(...a),
      ...createVaultsSlice(...a),
      ...createVaultSlice(...a),
      ...createNoteSlice(...a),
      ...createDialogSlice(...a),
      ...createHomeSlice(...a),
      ...createSidebarSlice(...a),
    }),
    {
      name: "glade-store",
      partialize: (state) => ({
        theme: state.theme,
        mode: state.mode,
        tocOpen: state.tocOpen,
        noteEditMode: state.noteEditMode,
        tocWidth: state.tocWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        tagsCollapsed: state.tagsCollapsed,
        pinnedNotesCollapsed: state.pinnedNotesCollapsed,
        sidebarWidth: state.sidebarWidth,
        tagsHeight: state.tagsHeight,
        pinnedHeight: state.pinnedHeight,
        expandedFolders: state.expandedFolders,
        soundStates: state.soundStates,
        currentView: state.currentView,
        settingsSection: state.settingsSection,
      }),
    }
  )
);