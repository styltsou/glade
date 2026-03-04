import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ThemeId, ThemeMode } from "@/themes";

interface ThemeState {
  /** Active theme id */
  theme: ThemeId;
  /** User-chosen mode preference (includes "system") */
  mode: ThemeMode;
  /** Resolved mode after evaluating "system" against OS preference */
  resolvedMode: "light" | "dark";

  setTheme: (theme: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
}

/** Resolve "system" to actual light/dark based on OS preference */
function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return mode;
}

/** Apply theme/mode attributes to <html> */
function applyToDOM(theme: ThemeId, resolvedMode: "light" | "dark") {
  const el = document.documentElement;
  el.setAttribute("data-theme", theme);
  el.setAttribute("data-mode", resolvedMode);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "claude",
      mode: "dark",
      resolvedMode: "dark",

      setTheme: (theme) => {
        set({ theme });
        applyToDOM(theme, get().resolvedMode);
      },

      setMode: (mode) => {
        const resolvedMode = resolveMode(mode);
        set({ mode, resolvedMode });
        applyToDOM(get().theme, resolvedMode);
      },
    }),
    {
      name: "glade-theme",
      // Only persist theme and mode, not resolvedMode
      partialize: (state) => ({ theme: state.theme, mode: state.mode }),
      onRehydrateStorage: () => {
        return (state: ThemeState | undefined) => {
          if (!state) return;
          // After rehydration, resolve the mode and apply to DOM
          const resolvedMode = resolveMode(state.mode);
          state.resolvedMode = resolvedMode;
          applyToDOM(state.theme, resolvedMode);
        };
      },
    },
  ),
);

// Listen for OS color scheme changes when mode is "system"
const mql = window.matchMedia("(prefers-color-scheme: dark)");
mql.addEventListener("change", () => {
  const { mode, theme } = useThemeStore.getState();
  if (mode === "system") {
    const resolvedMode = resolveMode("system");
    useThemeStore.setState({ resolvedMode });
    applyToDOM(theme, resolvedMode);
  }
});

// Apply theme immediately on module load (before React renders)
const { theme, mode } = useThemeStore.getState();
const initialResolved = resolveMode(mode);
applyToDOM(theme, initialResolved);
useThemeStore.setState({ resolvedMode: initialResolved });
