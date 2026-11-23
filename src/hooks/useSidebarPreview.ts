import { useCallback, useEffect, useRef, useState } from "react";

/** A hover preview never changes the persisted, pinned sidebar state. */
export function useSidebarPreview(enabled: boolean) {
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const enter = useCallback((event: React.PointerEvent) => {
    if (!enabled || event.pointerType !== "mouse") return;
    clear();
    if (!open) timer.current = setTimeout(() => setOpen(true), 350);
  }, [clear, enabled, open]);
  const leave = useCallback((event: React.PointerEvent) => {
    if (event.relatedTarget instanceof Element && event.relatedTarget.closest("[data-sidebar-preview-zone]")) return;
    clear();
    setOpen(false);
  }, [clear]);
  const dismiss = useCallback(() => { clear(); setOpen(false); }, [clear]);
  useEffect(() => { if (!enabled) dismiss(); }, [enabled, dismiss]);
  useEffect(() => () => clear(), [clear]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") dismiss(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);
  return { open: enabled && open, enter, leave, dismiss };
}
export type SidebarPreview = ReturnType<typeof useSidebarPreview>;
