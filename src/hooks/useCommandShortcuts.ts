import { useEffect } from "react";
import { useVaultStore } from "@/stores/useVaultStore";
import { useDialogStore } from "@/stores/useDialogStore";

export function useCommandShortcuts(
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void,
) {
  const { activeNote, createNote } = useVaultStore();
  const { openDelete, openSettings } = useDialogStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Open palette
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // New note
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createNote();
      }
      // Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        openSettings();
      }
      // Delete
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && !e.shiftKey) {
        e.preventDefault();
        if (activeNote) {
          openDelete(activeNote.path, activeNote.title);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createNote, activeNote, openDelete, openSettings, setOpen]);
}
