import { lazy, Suspense, useLayoutEffect, useRef } from "react";
import { useStore } from "@/store";
import { activeTabOf } from "@/lib/tabs";
import { HomeView } from "@/components/HomeView";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { cn } from "@/lib/utils";

const Editor = lazy(() => import("@/components/Editor").then((m) => ({ default: m.Editor })));

/** Independent editor groups with a shared draggable divider. */
export function PaneArea() {
  const state = useStore((s) => s.tabsState);
  const targetKind = useStore((s) => s.target?.kind);
  const focusGroup = useStore((s) => s.focusGroup);
  const setTabRatio = useStore((s) => s.setTabRatio);
  const setPaneBoxes = useStore((s) => s.setPaneBoxes);
  const containerRef = useRef<HTMLDivElement>(null);
  const split = state.groups.length > 1;

  // Report where each pane is, so its tabs in the title bar sit right above it.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const panes = [...container.querySelectorAll<HTMLElement>(":scope > [data-pane]")];
      setPaneBoxes(panes.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right) };
      }));
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(container);
    container.querySelectorAll<HTMLElement>(":scope > [data-pane]").forEach((el) => ro?.observe(el));
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      setPaneBoxes([]);
    };
  }, [state.groups.length, setPaneBoxes]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.dataset.dragging = "true";
    const rect = container.getBoundingClientRect();
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTabRatio((e.clientX - rect.left) / rect.width));
    };
    const onUp = () => {
      delete handle.dataset.dragging;
      cancelAnimationFrame(frame);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  return (
    <div ref={containerRef}  className="flex min-h-0 flex-1 overflow-hidden">
      {state.groups.map((group, index) => {
        const pane = activeTabOf(group);
        return (
        <div key={group.id} data-pane className="flex min-w-0 flex-1" style={split ? { flex: `${index === 0 ? state.ratio : 1 - state.ratio} 1 0%` } : undefined}>
          {index === 1 && (
            <div
              role="separator"
              aria-orientation="vertical"
              onPointerDown={startDrag}
              className="group relative z-10 -mx-px w-[3px] shrink-0 cursor-col-resize bg-border/60 transition-colors hover:bg-primary/50 data-[dragging=true]:bg-primary/70"
            >
              <span className="absolute inset-y-0 -inset-x-1.5" />
            </div>
          )}
          <div
            id={`editor-workspace-${group.id}`} role="tabpanel" aria-labelledby={`file-tab-${pane.id}`}
            className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", split && state.focused !== index && "opacity-[0.97]")}
            onMouseDownCapture={() => split && state.focused !== index && focusGroup(index)}
          >
            {pane.path ? (
              <Suspense fallback={<EditorSkeleton />}>
                <Editor
                  path={pane.path}
                  paneIndex={index}
                  split={split}
                  focused={state.focused === index}
                  onFocus={() => state.focused !== index && focusGroup(index)}
                />
              </Suspense>
            ) : targetKind === "file" ? (
              <EditorSkeleton />
            ) : (
              <HomeView />
            )}
          </div>
        </div>
      ); })}
    </div>
  );
}
