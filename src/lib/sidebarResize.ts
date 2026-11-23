/** Preview widths without store updates or persistence on every pointer move. */
export function startSidebarResize(
  handle: HTMLElement,
  event: { pointerId: number; clientX: number },
  width: number,
  commit: (width: number) => void,
  onEnd: () => void,
) {
  const root = document.documentElement;
  const grab = event.clientX - width;
  const previousCursor = document.body.style.cursor;
  let nextWidth = width;
  let frame = 0;
  let ended = false;
  root.dataset.resizing = "sidebar";
  document.body.style.cursor = "col-resize";
  handle.setPointerCapture(event.pointerId);

  const preview = () => {
    frame = 0;
    root.style.setProperty("--sidebar-live-width", `${nextWidth}px`);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return;
    nextWidth = Math.max(200, Math.min(600, Math.round(e.clientX - grab)));
    if (!frame) frame = requestAnimationFrame(preview);
  };
  const finish = (save: boolean) => {
    if (ended) return;
    ended = true;
    cancelAnimationFrame(frame);
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", release);
    handle.removeEventListener("pointercancel", cancel);
    handle.removeEventListener("lostpointercapture", cancel);
    window.removeEventListener("blur", cancel);
    if (save) commit(nextWidth);
    root.style.removeProperty("--sidebar-live-width");
    delete root.dataset.resizing;
    document.body.style.cursor = previousCursor;
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    onEnd();
  };
  const release = (e: PointerEvent) => {
    if (e.pointerId !== event.pointerId) return;
    // Include the final pointer position even if its frame hasn't painted yet.
    move(e);
    finish(true);
  };
  const cancel = () => finish(true);
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", release);
  handle.addEventListener("pointercancel", cancel);
  handle.addEventListener("lostpointercapture", cancel);
  window.addEventListener("blur", cancel);
  return () => finish(false);
}
