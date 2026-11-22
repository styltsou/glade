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
  const nextTheme = knownTheme(theme);
  const nextMode = effectiveMode(nextTheme, resolvedMode);
  if (el.getAttribute("data-theme") === nextTheme && el.getAttribute("data-mode") === nextMode) return;

  // Switch colours in one frame: without this, every element with a colour
  // transition (buttons, tabs, tags...) fades to the new theme at its own pace.
  const freeze = document.createElement("style");
  freeze.textContent = "*,*::before,*::after{transition:none!important}";
  document.head.appendChild(freeze);
  el.setAttribute("data-theme", nextTheme);
  el.setAttribute("data-mode", nextMode);
  void document.body.offsetHeight; // apply the new colours everywhere while transitions are off
  setTimeout(() => freeze.remove(), 1);
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
