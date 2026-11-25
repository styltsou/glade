import { useCallback } from "react";
import { useStore } from "@/store";
import type { NoteLabel } from "@/store/slices/settingsSlice";
import { splitExtension } from "@/lib/paths";

/** A note's name as the app shows it: its title, or its file name without the extension. */
export function noteLabel(mode: NoteLabel, path: string, title?: string | null): string {
  const stem = splitExtension(path).stem;
  if (mode === "filename") return stem;
  return title?.trim() || stem;
}

/** `noteLabel` bound to the current setting. */
export function useNoteLabel() {
  const mode = useStore((s) => s.noteLabel);
  return useCallback((path: string, title?: string | null) => noteLabel(mode, path, title), [mode]);
}
