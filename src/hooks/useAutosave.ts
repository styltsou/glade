import { useCallback, useEffect, useRef } from "react";
import { useVaultStore } from "@/stores/useVaultStore";

const DEBOUNCE_MS = 1500;

/**
 * Hook that auto-saves note content after a debounce period.
 * Returns { onContentChange, saveStatus }.
 */
export function useAutosave() {
  const { activeNote, saveNote } = useVaultStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statusRef = useRef<"idle" | "saving" | "saved">("idle");

  const onContentChange = useCallback(
    (content: string) => {
      if (!activeNote) return;

      // Clear existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set new debounced save
      timerRef.current = setTimeout(async () => {
        statusRef.current = "saving";
        try {
          await saveNote(activeNote.path, content);
          statusRef.current = "saved";
          // Reset to idle after 2s
          setTimeout(() => {
            statusRef.current = "idle";
          }, 2000);
        } catch {
          statusRef.current = "idle";
        }
      }, DEBOUNCE_MS);
    },
    [activeNote, saveNote],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { onContentChange };
}
