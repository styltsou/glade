export type ThemeId = "glade" | "claude" | "everforest" | "rose-pine";
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
}

export const themes: ThemeMeta[] = [
  {
    id: "glade",
    label: "Glade",
  },
  {
    id: "claude",
    label: "Claude",
  },
  {
    id: "everforest",
    label: "Everforest",
  },
  {
    id: "rose-pine",
    label: "Rosé Pine",
  },
];

/** Themes that no longer exist fall back to the default. */
export function knownTheme(id: string | undefined | null): ThemeId {
  return themes.some((t) => t.id === id) ? (id as ThemeId) : "glade";
}
