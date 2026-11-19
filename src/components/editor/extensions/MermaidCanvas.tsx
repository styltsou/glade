import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Maximize, ZoomIn, ZoomOut } from "lucide-react";
import { Tip } from "@/components/ui/tooltip";

const MIN_SCALE = 0.1;
const MAX_SCALE = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Pan and zoom for a rendered Mermaid SVG that stays sharp at any zoom.
 *
 * Instead of scaling a layer with a CSS transform (which stretches a bitmap
 * and goes blurry), zooming sets the SVG's real width and height, so the
 * browser redraws the vector at that size. Panning moves it by whole pixels.
 */
export function MermaidCanvas({ svg, empty }: { svg: string | null; empty: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const viewRef = useRef(view);
  viewRef.current = view;
  const fitted = useRef(false);

  /** Scale and center the diagram so it fits the viewport (at most 2x). */
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const n = natural.current;
    if (!vp || !n) return;
    const w = vp.clientWidth;
    const h = vp.clientHeight;
    const scale = clamp(Math.min((w * 0.88) / n.w, (h * 0.85) / n.h, 2), MIN_SCALE, MAX_SCALE);
    setView({ scale, x: Math.round((w - n.w * scale) / 2), y: Math.round((h - n.h * scale) / 2) });
  }, []);

  // Read the diagram's natural size from its viewBox whenever the SVG changes.
  useLayoutEffect(() => {
    const el = contentRef.current?.querySelector("svg");
    if (!el) {
      natural.current = null;
      return;
    }
    const vb = el.viewBox?.baseVal;
    const w = vb && vb.width ? vb.width : el.getBoundingClientRect().width;
    const h = vb && vb.height ? vb.height : el.getBoundingClientRect().height;
    el.removeAttribute("style");
    el.setAttribute("preserveAspectRatio", "xMidYMid meet");
    natural.current = { w, h };
    if (!fitted.current) {
      fitted.current = true;
      fit();
    }
  }, [svg, fit]);

  // Apply the zoom as real dimensions so the vector is redrawn crisply.
  useLayoutEffect(() => {
    const el = contentRef.current?.querySelector("svg");
    const n = natural.current;
    if (!el || !n) return;
    el.setAttribute("width", String(Math.round(n.w * view.scale)));
    el.setAttribute("height", String(Math.round(n.h * view.scale)));
  }, [view.scale, svg]);

  /** Zoom by a factor around a point in viewport coordinates. */
  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const scale = clamp(v.scale * factor, MIN_SCALE, MAX_SCALE);
      const k = scale / v.scale;
      return { scale, x: Math.round(cx - (cx - v.x) * k), y: Math.round(cy - (cy - v.y) * k) };
    });
  }, []);

  const zoomCenter = (factor: number) => {
    const vp = viewportRef.current;
    if (vp) zoomAt(factor, vp.clientWidth / 2, vp.clientHeight / 2);
  };

  // Wheel zooms around the pointer. Non-passive so the page doesn't scroll.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(Math.exp(-delta * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  // Refit when the viewport changes size (e.g. the code pane opens or closes).
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === "undefined") return;
    let first = true;
    const ro = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      fit();
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fit]);

  const drag = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: viewRef.current.x, oy: viewRef.current.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    setView((v) => ({ ...v, x: Math.round(d.ox + e.clientX - d.x), y: Math.round(d.oy + e.clientY - d.y) }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  return (
    <div className="mermaid-full-preview">
      <div
        ref={viewportRef}
        className="absolute inset-0 touch-none overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={fit}
      >
        {svg ? (
          <div
            ref={contentRef}
            className="mermaid-canvas-content absolute left-0 top-0"
            style={{ transform: `translate(${view.x}px, ${view.y}px)` }}
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="mermaid-block-empty flex h-full items-center justify-center">{empty}</div>
        )}
      </div>

      <div className="mermaid-full-zoom-controls">
        <Tip label="Zoom in" side="left" className="z-[110]"><button type="button" aria-label="Zoom in" onClick={() => zoomCenter(1.25)}>
          <ZoomIn className="size-4" />
        </button></Tip>
        <Tip label="Zoom out" side="left" className="z-[110]"><button type="button" aria-label="Zoom out" onClick={() => zoomCenter(0.8)}>
          <ZoomOut className="size-4" />
        </button></Tip>
        <Tip label="Fit to view (double-click)" side="left" className="z-[110]"><button type="button" aria-label="Fit to view" onClick={fit}>
          <Maximize className="size-4" />
        </button></Tip>
        <span className="pt-1 text-center text-[10px] tabular-nums text-muted-foreground">{Math.round(view.scale * 100)}%</span>
      </div>
    </div>
  );
}
