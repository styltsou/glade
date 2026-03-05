export type ThemeId = "monochrome" | "claude" | "everforest" | "rose-pine";
export type ThemeMode = "light" | "dark" | "system";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  /** Representative colors shown in the settings card (background, accent, foreground) */
  previewColors: string[];
}

export const themes: ThemeMeta[] = [
  {
    id: "monochrome",
    label: "Monochrome",
    previewColors: ["#ffffff", "#111111"],
  },
  {
    id: "claude",
    label: "Claude",
    previewColors: ["#f9f6f2", "#c96442", "#1e1c19"],
  },
  {
    id: "everforest",
    label: "Everforest",
    previewColors: ["#fdf6e3", "#a7c080", "#2d353b"],
  },
  {
    id: "rose-pine",
    label: "Rosé Pine",
    previewColors: ["#faf4ed", "#c4a7e7", "#191724"],
  },
];
