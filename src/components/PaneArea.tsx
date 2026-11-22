import { lazy, Suspense, useRef } from "react";
import { useStore } from "@/store";
import { activeTabOf } from "@/lib/tabs";
import { HomeView } from "@/components/HomeView";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { cn } from "@/lib/utils";
import { ResizeGrip } from "@/components/ResizeGrip";
import { SPLIT_GAP, pageCorner, paneBox, tabsStartFlush, useSidebarVisible } from "@/lib/surfaces";
import { bindingFor, formatShortcut } from "@/lib/keybindings";

const Editor = lazy(() => import("@/components/Editor").then((m) => ({ default: m.Editor })));

/** One page per editor group, with a draggable gap of frame between two. */
export function PaneArea() {
  const state = useStore((s) => s.tabsState);
  const targetKind = useStore((s) => s.target?.kind);
  const focusGroup = useStore((s) => s.focusGroup);
  const setTabRatio = useStore((s) => s.setTabRatio);
  const containerRef = useRef<HTMLDivElement>(null);
  const drop = useStore((s) => (s.tabDropTarget?.kind === "pane" ? s.tabDropTarget : null));
  const split = state.groups.length > 1;
  const sidebarVisible = useSidebarVisible();

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    event.preventDefault();
    const handle = event.currentTarget;
    handle.setPointerCapture(event.pointerId);
    handle.dataset.dragging = "true";
    // Tabs above the panes follow the divider directly while dragging.
    document.documentElement.dataset.resizing = "pane";
    const rect = container.getBoundingClientRect();
    // The gap stays under the point it was grabbed at.
    const grab = event.clientX - handle.getBoundingClientRect().left;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setTabRatio((e.clientX - grab - rect.left) / (rect.width - SPLIT_GAP)));
    };
    const onUp = () => {
      delete handle.dataset.dragging;
      delete document.documentElement.dataset.resizing;
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
        <div
          key={group.id}
          className="relative flex min-w-0 flex-1"
          style={paneBox(index, split, state.ratio)}
        >
          {index === 1 && (
            // 2px of the grab area over the left page, short of its scrollbar's thumb.
            <ResizeGrip
              before={2}
              aria-label="Resize panes"
              onPointerDown={startDrag}
              className="inset-y-0"
              style={{ left: -SPLIT_GAP }}
            />
          )}
          <div
            id={`editor-workspace-${group.id}`} role="tabpanel" aria-labelledby={`file-tab-${pane.id}`}
            data-pane-index={index}
            {...pageCorner(tabsStartFlush(index, sidebarVisible), group)}
            // Never dimmed: the page must stay exactly the colour of its tab.
            className="surface-page relative flex min-w-0 flex-1 flex-col overflow-hidden"
            onMouseDownCapture={() => split && state.focused !== index && focusGroup(index)}
          >
            {drop && drop.group === index && (
              // Where a dragged tab or note would land: the whole pane, or the half it would split into.
              <div
                aria-hidden
                className={cn(
                  "pointer-events-none absolute inset-y-2 z-30 rounded-lg border-2 border-primary/50 bg-primary/10",
                  drop.zone === "center" && "inset-x-2",
                  drop.zone === "left" && "left-2 right-1/2",
                  drop.zone === "right" && "left-1/2 right-2",
                )}
              />
            )}
            {pane.id === "" ? (
              <EmptyPane />
            ) : pane.path ? (
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

/** Every tab is closed: point at the sidebar and the shortcuts that open something. */
function EmptyPane() {
  const openRoot = useStore((s) => s.openFolderTab);
  const hints = [
    { label: "Open a note", command: "toggle-command-palette" },
    { label: "New note", command: "new-note" },
  ] as const;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
      <p className="text-sm">Open a note or folder from the sidebar</p>
      <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-xs">
        {hints.map((h) => {
          const binding = bindingFor(h.command);
          return (
            <div key={h.command} className="contents">
              <dt className="text-right">{h.label}</dt>
              <dd className="text-left font-mono opacity-70">{binding ? formatShortcut(binding) : ""}</dd>
            </div>
          );
        })}
      </dl>
      <button type="button" onClick={() => openRoot(null)} className="text-xs text-primary hover:underline">
        Show folder overview
      </button>
    </div>
  );
}
