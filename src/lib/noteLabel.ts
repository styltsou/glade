import { useCallback } from "react";
import { useStore } from "@/store";
import type { NoteLabel } from "@/store/slices/settingsSlice";
import { baseName, splitExtension } from "@/lib/paths";

/**
 * A note's name as the app shows it: its title, or its file name. Shown as file
 * names they are the whole name, extension too (`plan.md`). A note with no title
 * falls back to the name without it.
 */
export function noteLabel(mode: NoteLabel, path: string, title?: string | null): string {
  if (mode === "filename") return baseName(path);
  return title?.trim() || splitExtension(path).stem;
}

/** `noteLabel` bound to the current setting. */
export function useNoteLabel() {
  const mode = useStore((s) => s.noteLabel);
  return useCallback((path: string, title?: string | null) => noteLabel(mode, path, title), [mode]);
}
