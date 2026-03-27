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
      } as StoreState),
    }
  )
);