import { StateCreator } from "zustand";
import { effectiveMode, knownTheme, type ThemeId, type ThemeMode } from "@/themes";

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
  el.setAttribute("data-theme", knownTheme(theme));
  el.setAttribute("data-mode", effectiveMode(knownTheme(theme), resolvedMode));
}

import type { StoreState } from "../index";

export const createThemeSlice: StateCreator<StoreState, [], [], ThemeSlice> = (set) => ({
  theme: "glade",
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
      return { mode: newMode, resolvedMode: effectiveMode(state.theme, newMode) };
    });
  },
});
