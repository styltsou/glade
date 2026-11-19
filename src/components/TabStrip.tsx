import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, useReducedMotion } from "motion/react";
import { FileText, Folder, Plus, X } from "lucide-react";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import { type Group as TabGroup, type Tab } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { bindingFor, formatShortcut } from "@/lib/keybindings";

function GroupTabs({ group, index, inset, trailing }: { group: TabGroup; index: number; inset: number; trailing: number }) {
  const focused = useStore((s) => s.tabsState.focused === index);
  const split = useStore((s) => s.tabsState.groups.length > 1);
  const activate = useStore((s) => s.activateTab);
  const close = useStore((s) => s.closeTab);
  const focusGroup = useStore((s) => s.focusGroup);
  const newTab = useStore((s) => s.newTab);
  const splitActive = useStore((s) => s.splitActive);
  const moveToOther = useStore((s) => s.moveTabToOtherGroup);
  const otherGroup = useStore((s) => s.tabsState.groups[index === 0 ? 1 : 0]);
  /** The other pane already shows this note, so there is nothing to move. */
  const otherHas = (path: string) => !!otherGroup?.tabs.some((t) => t.path === path);
  const reorder = useStore((s) => s.reorderTabs);
  const rootName = useStore((s) => (s.target ? baseName(s.target.path) : "Overview"));
  const viewport = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  // Siblings only animate their position while a tab is being dragged. At any
  // other time a layout animation would fight the open/close width animation.
  const [dragging, setDragging] = useState(false);
  const dragEndTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Tabs open and close like a browser's: they grow from and shrink to nothing,
  // and the neighbours follow the width as it changes.
  const tabMotion = reduceMotion ? { duration: 0 } : { duration: 0.14, ease: [0.23, 1, 0.32, 1] as const };
  useLayoutEffect(() => { viewport.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" }); }, [group.activeId, group.tabs.length]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || element.scrollWidth <= element.clientWidth) return;
      e.preventDefault(); element.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 24 : e.deltaMode === 2 ? element.clientWidth : 1);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);
  const action = "press flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground";
  return <div className="flex h-full min-w-0 items-center gap-0.5 px-1" style={{ paddingLeft: inset || undefined, paddingRight: trailing || undefined }}>
    <Reorder.Group ref={viewport} as="div" role="tablist" aria-label={split ? `${index === 0 ? "Left" : "Right"} pane tabs` : "Open files"} axis="x" values={group.tabs} layoutScroll data-no-drag className="overlay-scroll flex h-full min-w-0 items-center overflow-x-auto overflow-y-hidden" style={{ flex: "0 1 auto" }}
      onReorder={(next: Tab[]) => { const from = group.tabs.findIndex((t, i) => next[i]?.id !== t.id); if (from >= 0) reorder(index, from, next.findIndex((t) => t.id === group.tabs[from].id)); }}>
      <AnimatePresence initial={false}>
      {group.tabs.map((tab) => {
        const active = tab.id === group.activeId;
        const label = tab.path ? baseName(tab.path) : typeof tab.folder === "string" ? baseName(tab.folder) : tab.folder === null ? rootName : "New tab";
        return <Reorder.Item
          key={tab.id}
          value={tab}
          as="div"
          layout="position"
          layoutDependency={dragging ? group.tabs : "idle"}
          initial={{ width: 0, opacity: 0, marginRight: 0 }}
          animate={{ width: "auto", opacity: 1, marginRight: 4 }}
          exit={{ width: 0, opacity: 0, marginRight: 0 }}
          transition={tabMotion}
          onDragStart={() => { clearTimeout(dragEndTimer.current); setDragging(true); }}
          onDragEnd={() => { dragEndTimer.current = setTimeout(() => setDragging(false), 250); }}
          className="h-8 shrink-0 overflow-hidden"
          whileDrag={{ zIndex: 20 }}
        >
          <ContextMenu><ContextMenuTrigger asChild>
            <div className={cn("group flex h-full w-max min-w-28 max-w-56 items-center rounded-lg transition-colors duration-100", active ? focused ? "bg-foreground/[0.10] text-foreground" : "bg-foreground/[0.07] text-foreground/80" : "bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.10] hover:text-foreground")} onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); close(index, tab.id); } }}>
              <button type="button" role="tab" id={`file-tab-${tab.id}`} aria-label={label} aria-selected={active} aria-controls={`editor-workspace-${group.id}`} data-group-focused={focused} tabIndex={active ? 0 : -1} title={tab.path ?? (typeof tab.folder === "string" ? tab.folder : tab.folder === null ? rootName : "New tab")} className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-2.5 pr-1.5 text-[13px] outline-none focus-visible:ring-1 focus-visible:ring-ring/50" onPointerDown={(e) => { if (e.button === 0) activate(index, tab.id); }} onClick={() => { if (!focused || !active) activate(index, tab.id); }} onKeyDown={(e) => {
                if (e.altKey || e.ctrlKey || e.metaKey) return;
                const at = group.tabs.findIndex((t) => t.id === tab.id);
                const next = e.key === "ArrowRight" ? group.tabs[(at + 1) % group.tabs.length] : e.key === "ArrowLeft" ? group.tabs[(at - 1 + group.tabs.length) % group.tabs.length] : e.key === "Home" ? group.tabs[0] : e.key === "End" ? group.tabs[group.tabs.length - 1] : null;
                if (e.key === "Delete") { e.preventDefault(); close(index, tab.id); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[role=tab][data-group-focused=true][aria-selected=true]')?.focus()); }
                if (next) { e.preventDefault(); activate(index, next.id); document.getElementById(`file-tab-${next.id}`)?.focus(); }
              }}>{!tab.path && tab.folder !== undefined ? <Folder className="size-3.5 shrink-0 opacity-60" /> : <FileText className="size-3.5 shrink-0 opacity-60" />}<span className="truncate">{label}</span></button>
              <button type="button" aria-label={`Close ${label}`} tabIndex={-1} onPointerDown={(e) => e.stopPropagation()} onClick={() => close(index, tab.id)} className={cn("mr-1.5 flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground", active && "text-foreground/70")}><X className="size-3.5" /></button>
            </div>
          </ContextMenuTrigger><ContextMenuContent
            className="min-w-48"
            // The menu is portaled, but React still bubbles its events through
            // the tab (a drag handle). Keep presses on menu items to the menu.
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <ContextMenuItem onSelect={() => close(index, tab.id)}>Close tab<ContextMenuShortcut>{formatShortcut(bindingFor("close-tab")!)}</ContextMenuShortcut></ContextMenuItem>
            {group.tabs.length > 1 && <ContextMenuItem onSelect={() => group.tabs.filter((t) => t.id !== tab.id).forEach((t) => close(index, t.id))}>Close other tabs</ContextMenuItem>}
            <ContextMenuSeparator />
            {split
              ? (tab.path === null || !otherHas(tab.path)) && <ContextMenuItem onSelect={() => moveToOther(index, tab.id)}>Move to {index === 0 ? "right" : "left"} pane</ContextMenuItem>
              : <ContextMenuItem onSelect={() => { activate(index, tab.id); splitActive(); }}>Split right<ContextMenuShortcut>{formatShortcut(bindingFor("split-right")!)}</ContextMenuShortcut></ContextMenuItem>}
          </ContextMenuContent></ContextMenu>
        </Reorder.Item>;
      })}
      </AnimatePresence>
    </Reorder.Group>
    <div className="flex shrink-0 items-center" data-no-drag>
      <button type="button" aria-label="New tab" title="New tab (Ctrl+T)" onClick={() => { focusGroup(index); newTab(); }} className={action}><Plus className="size-4" /></button>
    </div><div className="h-full min-w-1 flex-1" />
  </div>;
}

/**
 * Tabs for each pane, laid out so each group sits exactly above its pane.
 *
 * `paneOffset` is (left edge of the pane area) − (left edge of this strip), in
 * pixels: 0 when the sidebar is open (the title-bar section is as wide as the
 * sidebar), negative when it is closed. The divider is then at
 * `ratio × stripWidth + (1 − ratio) × paneOffset`, which CSS computes in the
 * same frame as the panes, so nothing is measured and nothing lags. While the
 * sidebar opens or closes, the width uses the sidebar's own transition, so the
 * boundary moves in step with it.
 */
export function TabStrip({ trailingInset = 0, paneOffset = 0 }: { trailingInset?: number; paneOffset?: number }) {
  const state = useStore((s) => s.tabsState);
  const split = state.groups.length > 1;
  const last = state.groups.length - 1;
  return (
    <div className="flex h-full min-w-0 flex-1">
      {state.groups.map((group, index) => {
        const style: React.CSSProperties =
          split && index === 0
            ? { width: `calc(${state.ratio * 100}% + ${(1 - state.ratio) * paneOffset}px)`, flex: "none" }
            : { flex: "1 1 0%" };
        return (
          <div
            key={group.id}
            className={cn("h-full min-w-0", split && index === 0 && "sidebar-motion", index > 0 && "border-l border-border/60")}
            style={style}
          >
            <GroupTabs group={group} index={index} inset={0} trailing={index === last ? trailingInset : 0} />
          </div>
        );
      })}
    </div>
  );
}
