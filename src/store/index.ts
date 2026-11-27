import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createThemeSlice, type ThemeSlice } from "./slices/themeSlice";
import { createWorkspaceSlice, type WorkspaceSlice } from "./slices/workspaceSlice";
import { createVaultSlice, type VaultSlice } from "./slices/vaultSlice";
import { createNoteSlice, type NoteSlice } from "./slices/noteSlice";
import { createDialogSlice, type DialogSlice } from "./slices/dialogSlice";
import { createHomeSlice, type HomeSlice } from "./slices/homeSlice";
import { createSidebarSlice, type SidebarSlice } from "./slices/sidebarSlice";
import { createTabsSlice, type TabsSlice } from "./slices/tabsSlice";
import { createSettingsSlice, type SettingsSlice } from "./slices/settingsSlice";

export type StoreState = ThemeSlice &
  WorkspaceSlice &
  VaultSlice &
  NoteSlice &
  DialogSlice &
  HomeSlice &
  SidebarSlice &
  TabsSlice &
  SettingsSlice;


export const useStore = create<StoreState>()(
  persist(
    (...a) => ({
      ...createThemeSlice(...a),
      ...createWorkspaceSlice(...a),
      ...createVaultSlice(...a),
      ...createNoteSlice(...a),
      ...createDialogSlice(...a),
      ...createHomeSlice(...a),
      ...createSidebarSlice(...a),
      ...createTabsSlice(...a),
      ...createSettingsSlice(...a),
    }),
    {
      name: "glade-store",
      partialize: (state) => ({
        theme: state.theme,
        mode: state.mode,
        noteLabel: state.noteLabel,
        onboarded: state.onboarded,
        tocOpen: state.tocOpen,
        referencesOpen: state.referencesOpen,
        referencesWidth: state.referencesWidth,
        isRawMode: state.isRawMode,
        tocWidth: state.tocWidth,
        sidebarCollapsed: state.sidebarCollapsed,
        pinnedNotesCollapsed: state.pinnedNotesCollapsed,
        tagsCollapsed: state.tagsCollapsed,
        sidebarWidth: state.sidebarWidth,
        pinnedHeight: state.pinnedHeight,
        pinnedNotePaths: state.pinnedNotePaths,
        propertiesOpen: state.propertiesOpen,
      }),
    }
  )
);