import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export const PANEL_MIN_WIDTH = 200;
export const PANEL_MAX_WIDTH = 500;

/**
 * Dragging the left edge of a panel pinned to the right: moving left widens it.
 *
 * The width is written to the panel's element once per frame while dragging, and
 * saved once at the end, as the sidebar does: nothing else re-renders or
 * persists on every pointer move. `gutter` is what the panel is wider than its card.
 */
export function usePanelResize(
  width: number,
  setWidth: (width: number) => void,
  panelRef: RefObject<HTMLElement | null>,
  gutter: number,
) {
  const [isResizing, setIsResizing] = useState(false);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0 || stop.current) return;
      e.preventDefault();
      e.stopPropagation();
      const handle = e.currentTarget;
      const { pointerId, clientX: startX } = e;
      const root = document.documentElement;
      let next = width;
      let frame = 0;

      const show = () => {
        frame = 0;
        if (panelRef.current) panelRef.current.style.width = `${next + gutter}px`;
      };
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== pointerId) return;
        next = Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_MAX_WIDTH, Math.round(width + startX - ev.clientX)));
        if (!frame) frame = requestAnimationFrame(show);
      };
      const end = (ev?: PointerEvent) => {
        if (ev) move(ev);
        cancelAnimationFrame(frame);
        show();
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
        handle.removeEventListener("lostpointercapture", end as () => void);
        delete root.dataset.resizing;
        if (handle.hasPointerCapture(pointerId)) handle.releasePointerCapture(pointerId);
        stop.current = null;
        if (next !== width) setWidth(next);
        setIsResizing(false);
      };

      root.dataset.resizing = "panel";
      handle.setPointerCapture(pointerId);
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
      handle.addEventListener("lostpointercapture", end as () => void);
      stop.current = () => end();
      setIsResizing(true);
    },
    [width, setWidth, panelRef, gutter],
  );

  return { isResizing, onPointerDown };
}
