import { lazy, Suspense, useRef } from "react";
import { useStore } from "@/store";
import { activeTab } from "@/lib/tabs";
import { HomeView } from "@/components/HomeView";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { cn } from "@/lib/utils";

const Editor = lazy(() => import("@/components/Editor").then((m) => ({ default: m.Editor })));

/** The active tab's one or two panes, with a draggable divider between them. */
export function PaneArea() {
  const tab = useStore((s) => activeTab(s.tabsState));
  const targetKind = useStore((s) => s.target?.kind);
  const focusPane = useStore((s) => s.focusPane);
  const setTabRatio = useStore((s) => s.setTabRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const split = tab.panes.length > 1;

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
      frame = requestAnimationFrame(() => setTabRatio(tab.id, (e.clientX - rect.left) / rect.width));
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
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      {tab.panes.map((pane, index) => (
        <div key={index} className="flex min-w-0 flex-1" style={split ? { flex: `${index === 0 ? tab.ratio : 1 - tab.ratio} 1 0%` } : undefined}>
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
            className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", split && tab.focused !== index && "opacity-[0.97]")}
            onMouseDownCapture={() => split && tab.focused !== index && focusPane(index)}
          >
            {pane.path ? (
              <Suspense fallback={<EditorSkeleton />}>
                <Editor
                  path={pane.path}
                  paneIndex={index}
                  split={split}
                  focused={tab.focused === index}
                  onFocus={() => tab.focused !== index && focusPane(index)}
                />
              </Suspense>
            ) : targetKind === "file" ? (
              <EditorSkeleton />
            ) : (
              <HomeView />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
