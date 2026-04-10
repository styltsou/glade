import { useEffect } from "react";
import { useStore } from "@/store";

export function useCommandShortcuts(
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void,
  isOpenRef?: React.RefObject<boolean>,
  onDeleteWhenOpen?: (action: "delete-note" | "delete-folder") => void,
) {
  const activeNote = useStore((state) => state.activeNote);
  const createNote = useStore((state) => state.createNote);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const currentFolder = useStore((state) => state.currentFolder);
  const openDelete = useStore((state) => state.openDelete);
  const openSettings = useStore((state) => state.openSettings);
  const toggleToc = useStore((state) => state.toggleToc);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      const paletteOpen = isOpenRef?.current ?? false;

      // Open palette
      if (isMeta && (e.key === "p" || e.key === "k")) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // New note
      if (isMeta && e.key === "n") {
        e.preventDefault();
        createNote(currentFolder || undefined);
      }
      // New folder
      if (isMeta && e.key === "f" && !activeNote) {
        e.preventDefault();
        openCreateFolder(currentFolder || undefined);
      }
      // Settings
      if (isMeta && e.key === ",") {
        e.preventDefault();
        openSettings();
      }
      // Delete
      if (isMeta && e.key === "d" && !e.shiftKey) {
        e.preventDefault();
        if (paletteOpen && onDeleteWhenOpen) {
          if (activeNote) {
            onDeleteWhenOpen("delete-note");
          } else if (currentFolder) {
            onDeleteWhenOpen("delete-folder");
          }
        } else {
          if (activeNote) {
            openDelete(activeNote.path, activeNote.title);
          } else if (currentFolder) {
            const folderName = currentFolder.split('/').pop() || currentFolder;
            openDelete(currentFolder, folderName, true);
          }
        }
      }
      // Toggle TOC
      if (isMeta && e.shiftKey && e.key === "T") {
        e.preventDefault();
        if (activeNote) {
          toggleToc(activeNote.path);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createNote, activeNote, openDelete, openSettings, setOpen, toggleToc, openCreateFolder, currentFolder, isOpenRef, onDeleteWhenOpen]);
}
