export type ThemeId =
  | "glade"
  | "vercel"
  | "linear"
  | "raycast"
  | "claude"
  | "vesper"
  | "monokai"
  | "dracula"
  | "nord"
  | "solarized"
  | "one"
  | "github"
  | "tokyo-night"
  | "catppuccin"
  | "gruvbox"
  | "everforest"
  | "kanagawa"
  | "rose-pine";
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  /** The theme only exists in dark; the app shows it dark in either mode. */
  darkOnly?: boolean;
}

export const themes: ThemeMeta[] = [
  { id: "glade", label: "Glade" },
  { id: "vercel", label: "Vercel" },
  { id: "linear", label: "Linear" },
  { id: "raycast", label: "Raycast" },
  { id: "claude", label: "Claude" },
  { id: "vesper", label: "Vesper", darkOnly: true },
  { id: "monokai", label: "Monokai", darkOnly: true },
  { id: "dracula", label: "Dracula" },
  { id: "nord", label: "Nord" },
  { id: "solarized", label: "Solarized" },
  { id: "one", label: "One Dark / Light" },
  { id: "github", label: "GitHub" },
  { id: "tokyo-night", label: "Tokyo Night" },
  { id: "catppuccin", label: "Catppuccin" },
  { id: "gruvbox", label: "Gruvbox" },
  { id: "everforest", label: "Everforest" },
  { id: "kanagawa", label: "Kanagawa" },
  { id: "rose-pine", label: "Rosé Pine" },
];

/** Themes that no longer exist fall back to the default. */
export function knownTheme(id: string | undefined | null): ThemeId {
  return themes.some((t) => t.id === id) ? (id as ThemeId) : "glade";
}

/** The mode a theme is actually shown in: dark-only themes ignore light. */
export function effectiveMode(theme: ThemeId, mode: "light" | "dark"): "light" | "dark" {
  return themes.find((t) => t.id === theme)?.darkOnly ? "dark" : mode;
}
