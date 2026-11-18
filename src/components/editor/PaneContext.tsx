import { createContext, useContext } from "react";
import { useStore } from "@/store";
import type { NoteData } from "@/types";

/**
 * Which note an editor pane is showing. Everything inside a pane (properties,
 * tags, backlinks, breadcrumbs...) reads it from here instead of the global
 * "active note", so two panes can show two notes at once.
 */
const PaneContext = createContext<{ path: string | null } | null>(null);

export const PaneProvider = PaneContext.Provider;

/** Path of the note in this pane (falls back to the focused note outside a pane). */
export function usePanePath(): string | null {
  const ctx = useContext(PaneContext);
  const fallback = useStore((s) => s.activeNote?.path ?? null);
  return ctx ? ctx.path : fallback;
}

export function usePaneNote(): NoteData | null {
  const path = usePanePath();
  return useStore((s) => {
    if (!path) return null;
    return s.noteCache[path] ?? (s.activeNote?.path === path ? s.activeNote : null);
  });
}
