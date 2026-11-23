import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { constrainImagePan } from "@/lib/lightboxPan";

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
  return createPortal(
    <AnimatePresence>{image && <LightboxView key={image.src} {...image} />}</AnimatePresence>,
    document.body,
  );
}

function LightboxView({ src, alt }: { src: string; alt: string }) {
  const isPresent = useIsPresent();
  const reduceMotion = useReducedMotion();
  const [scale, setScale] = useState(1);
  const [panning, setPanning] = useState(false);
  const pos = useRef({ x: 0, y: 0 });
  const currentScale = useRef(1);
  const dialog = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; px: number; py: number; moved: boolean; onImage: boolean } | null>(null);

  // Direct transform writes keep pointer tracking out of React's render cycle.
  const positionImage = useCallback((next: { x: number; y: number }, zoom: number, smooth = false) => {
    const img = image.current;
    const frame = viewport.current;
    if (!img || !frame) return;
    pos.current = constrainImagePan(next, zoom,
      { width: img.offsetWidth, height: img.offsetHeight },
      { width: frame.clientWidth, height: frame.clientHeight });
    img.style.transition = smooth ? "transform 120ms var(--ease-ui)" : "none";
    img.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) scale(${zoom})`;
  }, []);

  /** Zoom around the cursor, then constrain the result to the image frame. */
  const zoomTo = useCallback((next: number, cx = 0, cy = 0) => {
    const s = clamp(next, MIN, MAX);
    const k = s / currentScale.current;
    const p = pos.current;
    positionImage({ x: cx - (cx - p.x) * k, y: cy - (cy - p.y) * k }, s, !reduceMotion);
    currentScale.current = s;
    setScale(s);
  }, [positionImage, reduceMotion]);

  useEffect(() => {
    const frame = viewport.current;
    const img = image.current;
    if (!frame || !img) return;
    const observer = new ResizeObserver(() => {
      positionImage(pos.current, currentScale.current);
      drag.current = null;
      setPanning(false);
    });
    observer.observe(frame);
    observer.observe(img);
    return () => observer.disconnect();
  }, [positionImage]);

  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!isPresent) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeLightbox(); }
      else if (e.key === "+" || e.key === "=") zoomTo(scale * 1.5);
      else if (e.key === "-") zoomTo(scale / 1.5);
      else if (e.key === "0") zoomTo(1);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [isPresent, scale, zoomTo]);

  // Non-passive wheel listener so the page behind never scrolls.
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(currentScale.current * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.002)), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo]);

  const control = "lightbox-control flex h-8 items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring";
  const btn = `${control} w-8`;

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Image preview"}
      tabIndex={-1}
      className="fixed inset-0 z-[100] outline-none"
      initial="hidden"
      animate="visible"
      exit="closed"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-background/75 backdrop-blur-[2px]"
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 }, closed: { opacity: 0 } }}
        transition={{ duration: 0.06, ease: [0.23, 1, 0.32, 1] }}
      />
      <motion.div
        ref={stage}
        className="absolute inset-0 flex touch-none items-center justify-center overflow-hidden select-none"
        style={{ cursor: scale > 1 ? (panning ? "grabbing" : "grab") : "zoom-in" }}
        onPointerDown={(e) => {
          if (e.button !== 0 || drag.current) return;
          const onImage = e.target instanceof HTMLImageElement;
          drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, px: pos.current.x, py: pos.current.y, moved: false, onImage };
          setPanning(onImage && scale > 1);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.pointerId !== e.pointerId) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (Math.hypot(dx, dy) > 4) d.moved = true;
          if (scale > 1 && d.onImage && d.moved) positionImage({ x: d.px + dx, y: d.py + dy }, currentScale.current);
        }}
        onPointerUp={(e) => {
          const d = drag.current;
          if (!d || d.pointerId !== e.pointerId) return;
          drag.current = null;
          setPanning(false);
          if (d.moved) return;
          // A plain click: on the backdrop it closes, on the image it toggles zoom.
          if (!d.onImage) return closeLightbox();
          if (scale > 1) zoomTo(1);
          else {
            const r = stage.current!.getBoundingClientRect();
            zoomTo(2.5, e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
          }
        }}
        onPointerCancel={() => {
          drag.current = null;
          setPanning(false);
        }}
        onDoubleClick={(e) => e.preventDefault()}
      >
        <motion.div
          ref={viewport}
          className="shrink-0 overflow-hidden rounded-md shadow-2xl"
          variants={{
            hidden: { opacity: 0, transform: reduceMotion ? "none" : "scale(0.96)" },
            visible: { opacity: 1, transform: reduceMotion ? "none" : "scale(1)", transition: { duration: 0.15, ease: [0.23, 1, 0.32, 1] } },
            closed: { opacity: 0, transform: reduceMotion ? "none" : "scale(0.98)", transition: { duration: 0.1, ease: [0.23, 1, 0.32, 1] } },
          }}
          transition={{ ease: [0.23, 1, 0.32, 1] }}
        >
          <img
            ref={image}
            src={src}
            alt={alt}
            draggable={false}
            className="block max-h-[92vh] max-w-[94vw] object-contain"
            onLoad={() => positionImage(pos.current, currentScale.current)}
          />
        </motion.div>
      </motion.div>
      <motion.div role="group" aria-label="Image controls" className="absolute top-3 right-3 flex items-center gap-0.5 rounded-lg p-1 text-popover-foreground" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 }, closed: { opacity: 0, transition: { duration: 0.08 } } }} transition={{ duration: 0.1, ease: [0.23, 1, 0.32, 1] }}>
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => zoomTo(scale / 1.5)}><Minus className="size-4" /></button>
        <button type="button" aria-label="Reset zoom" className={`${control} min-w-12 px-1.5 text-xs tabular-nums`} onClick={() => zoomTo(1)}>{Math.round(scale * 100)}%</button>
        <button type="button" aria-label="Zoom in" className={btn} onClick={() => zoomTo(scale * 1.5)}><Plus className="size-4" /></button>
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
        <button type="button" aria-label="Close" className={btn} onClick={closeLightbox}><X className="size-4" /></button>
      </motion.div>
    </motion.div>
  );
}
