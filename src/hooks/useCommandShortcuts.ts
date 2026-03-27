import { useEffect } from "react";
import { useStore } from "@/store";

export function useCommandShortcuts(
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void,
) {
  const activeNote = useStore((state) => state.activeNote);
  const createNote = useStore((state) => state.createNote);
  const openDelete = useStore((state) => state.openDelete);
  const openSettings = useStore((state) => state.openSettings);
  const toggleToc = useStore((state) => state.toggleToc);

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
      // Toggle TOC
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "T") {
        e.preventDefault();
        if (activeNote) {
          toggleToc(activeNote.path);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createNote, activeNote, openDelete, openSettings, setOpen, toggleToc]);
}
