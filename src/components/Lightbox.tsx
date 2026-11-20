import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";

/** Tiny external store so the editor extension can open the lightbox without React context. */
type Shown = { src: string; alt: string } | null;
let shown: Shown = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openLightbox(src: string, alt = "") {
  shown = { src, alt };
  emit();
}
function closeLightbox() {
  shown = null;
  emit();
}
const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));
const snapshot = () => shown;

const MIN = 1;
const MAX = 12;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export function Lightbox() {
  const image = useSyncExternalStore(subscribe, snapshot);
  if (!image) return null;
  return createPortal(<LightboxView key={image.src} {...image} />, document.body);
}

function LightboxView({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);

  /** Zoom around a point (relative to the stage centre) so the spot under the cursor stays put. */
  const zoomTo = useCallback((next: number, cx = 0, cy = 0) => {
    setScale((prev) => {
      const s = clamp(next, MIN, MAX);
      const k = s / prev;
      setPos((p) => (s === MIN ? { x: 0, y: 0 } : { x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }));
      return s;
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeLightbox(); }
      else if (e.key === "+" || e.key === "=") zoomTo(scale * 1.5);
      else if (e.key === "-") zoomTo(scale / 1.5);
      else if (e.key === "0") zoomTo(1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [scale, zoomTo]);

  // Non-passive wheel listener so the page behind never scrolls.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(scale * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [scale, zoomTo]);

  const btn = "flex size-8 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/15 hover:text-white";

  return (
    <div role="dialog" aria-modal="true" aria-label={alt || "Image preview"} className="fixed inset-0 z-[100] animate-in fade-in-0 duration-150">
      <div
        ref={stage}
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-black/80 backdrop-blur-sm select-none"
        style={{ cursor: scale > 1 ? (panning ? "grabbing" : "grab") : "zoom-in" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y, moved: false };
          setPanning(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.hypot(dx, dy) > 4) d.moved = true;
          if (scale > 1 && d.moved) setPos({ x: d.px + dx, y: d.py + dy });
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          drag.current = null;
          setPanning(false);
          if (!d || d.moved) return;
          // A plain click: on the backdrop it closes, on the image it toggles zoom.
          if ((e.target as HTMLElement).tagName !== "IMG") return closeLightbox();
          if (scale > 1) zoomTo(1);
          else {
            const r = stage.current!.getBoundingClientRect();
            zoomTo(2.5, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
          }
        }}
        onDoubleClick={(e) => e.preventDefault()}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[92vh] max-w-[94vw] rounded-md object-contain shadow-2xl"
          style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`, transition: panning ? "none" : "transform 120ms cubic-bezier(0.23, 1, 0.32, 1)" }}
        />
      </div>
      <div className="absolute top-3 right-3 flex items-center gap-0.5 rounded-lg bg-black/50 p-1 backdrop-blur">
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => zoomTo(scale / 1.5)}><Minus className="size-4" /></button>
        <button type="button" aria-label="Reset zoom" className="h-8 min-w-12 rounded-md px-1.5 text-xs tabular-nums text-white/80 transition-colors hover:bg-white/15 hover:text-white" onClick={() => zoomTo(1)}>{Math.round(scale * 100)}%</button>
        <button type="button" aria-label="Zoom in" className={btn} onClick={() => zoomTo(scale * 1.5)}><Plus className="size-4" /></button>
        <button type="button" aria-label="Close" className={btn} onClick={closeLightbox}><X className="size-4" /></button>
      </div>
    </div>
  );
}
