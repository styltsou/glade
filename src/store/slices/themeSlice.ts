import { StateCreator } from "zustand";
import type { ThemeId, ThemeMode } from "@/themes";

export interface ThemeSlice {
  theme: ThemeId;
  mode: ThemeMode;
  resolvedMode: "light" | "dark";
  setTheme: (theme: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
  setResolvedMode: (resolvedMode: "light" | "dark") => void;
  toggleAppearance: () => void;
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function applyToDOM(theme: ThemeId, resolvedMode: "light" | "dark") {
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);
  el.setAttribute("data-mode", resolvedMode);
}

import type { StoreState } from "../index";

export const createThemeSlice: StateCreator<StoreState, [], [], ThemeSlice> = (set) => ({
  theme: "claude",
  mode: "dark",
  resolvedMode: "dark",

  setTheme: (theme) => {
    set({ theme });
  },

  setMode: (mode) => {
    set({ mode });
  },

  setResolvedMode: (resolvedMode) => {
    set({ resolvedMode });
  },

  toggleAppearance: () => {
    set((state) => {
      const newMode: ThemeMode = state.mode === "dark" ? "light" : "dark";
      applyToDOM(state.theme, newMode);
      return { mode: newMode, resolvedMode: newMode };
    });
  },
});
