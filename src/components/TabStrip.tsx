import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Reorder } from "motion/react";
import { Columns2, FileText, Folder, Plus, X } from "lucide-react";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import { type Group as TabGroup, type Tab } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";

function GroupTabs({ group, index, inset, trailing }: { group: TabGroup; index: number; inset: number; trailing: number }) {
  const focused = useStore((s) => s.tabsState.focused === index);
  const split = useStore((s) => s.tabsState.groups.length > 1);
  const activate = useStore((s) => s.activateTab);
  const close = useStore((s) => s.closeTab);
  const focusGroup = useStore((s) => s.focusGroup);
  const newTab = useStore((s) => s.newTab);
  const splitActive = useStore((s) => s.splitActive);
  const reorder = useStore((s) => s.reorderTabs);
  const rootName = useStore((s) => (s.target ? baseName(s.target.path) : "Overview"));
  const viewport = useRef<HTMLDivElement>(null);
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
  const action = "press flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground";
  return <div className="flex h-full min-w-0 items-center gap-0.5 px-1" style={{ paddingLeft: inset || undefined, paddingRight: trailing || undefined }}>
    <Reorder.Group ref={viewport} as="div" role="tablist" aria-label={split ? `${index === 0 ? "Left" : "Right"} pane tabs` : "Open files"} axis="x" values={group.tabs} layoutScroll data-no-drag className="overlay-scroll flex h-full min-w-0 items-center gap-1 overflow-x-auto overflow-y-hidden" style={{ flex: "0 1 auto" }}
      onReorder={(next: Tab[]) => { const from = group.tabs.findIndex((t, i) => next[i]?.id !== t.id); if (from >= 0) reorder(index, from, next.findIndex((t) => t.id === group.tabs[from].id)); }}>
      {group.tabs.map((tab) => {
        const active = tab.id === group.activeId;
        const label = tab.path ? baseName(tab.path) : typeof tab.folder === "string" ? baseName(tab.folder) : tab.folder === null ? rootName : "New tab";
        return <Reorder.Item key={tab.id} value={tab} as="div" initial={false} layout="position" layoutDependency={group.tabs} className="h-7 min-w-24 max-w-48 shrink-0" whileDrag={{ zIndex: 20 }}>
          <ContextMenu><ContextMenuTrigger asChild>
            <div className={cn("group flex h-full items-center rounded-lg transition-colors duration-100", active ? focused ? "bg-foreground/[0.10] text-foreground" : "bg-foreground/[0.07] text-foreground/80" : "bg-foreground/[0.05] text-muted-foreground hover:bg-foreground/[0.10] hover:text-foreground")} onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); close(index, tab.id); } }}>
              <button type="button" role="tab" id={`file-tab-${tab.id}`} aria-label={label} aria-selected={active} aria-controls={`editor-workspace-${group.id}`} data-group-focused={focused} tabIndex={active ? 0 : -1} title={tab.path ?? (typeof tab.folder === "string" ? tab.folder : tab.folder === null ? rootName : "New tab")} className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring/50" onPointerDown={(e) => { if (e.button === 0) activate(index, tab.id); }} onClick={() => { if (!focused || !active) activate(index, tab.id); }} onKeyDown={(e) => {
                if (e.altKey || e.ctrlKey || e.metaKey) return;
                const at = group.tabs.findIndex((t) => t.id === tab.id);
                const next = e.key === "ArrowRight" ? group.tabs[(at + 1) % group.tabs.length] : e.key === "ArrowLeft" ? group.tabs[(at - 1 + group.tabs.length) % group.tabs.length] : e.key === "Home" ? group.tabs[0] : e.key === "End" ? group.tabs[group.tabs.length - 1] : null;
                if (e.key === "Delete") { e.preventDefault(); close(index, tab.id); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[role=tab][data-group-focused=true][aria-selected=true]')?.focus()); }
                if (next) { e.preventDefault(); activate(index, next.id); document.getElementById(`file-tab-${next.id}`)?.focus(); }
              }}>{!tab.path && tab.folder !== undefined ? <Folder className="size-3 shrink-0 opacity-60" /> : <FileText className="size-3 shrink-0 opacity-60" />}<span className="truncate">{label}</span></button>
              <button type="button" aria-label={`Close ${label}`} tabIndex={-1} onPointerDown={(e) => e.stopPropagation()} onClick={() => close(index, tab.id)} className={cn("mr-1 flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/70 transition-colors hover:text-foreground", active && "text-foreground/70")}><X className="size-3" /></button>
            </div>
          </ContextMenuTrigger><ContextMenuContent><ContextMenuItem onSelect={() => close(index, tab.id)}>Close tab</ContextMenuItem></ContextMenuContent></ContextMenu>
        </Reorder.Item>;
      })}
    </Reorder.Group>
    <div className="flex shrink-0 items-center" data-no-drag>
      <button type="button" aria-label="New tab" title="New tab (Ctrl+T)" onClick={() => { focusGroup(index); newTab(); }} className={action}><Plus className="size-3.5" /></button>
      {!split && group.tabs.length > 0 && <button type="button" aria-label="Split editor right" title="Split editor right" onClick={() => splitActive()} className={action}><Columns2 className="size-3.5" /></button>}
    </div><div className="h-full min-w-1 flex-1" />
  </div>;
}

export function TabStrip({ leadingInset = 0, trailingInset = 0 }: { leadingInset?: number; trailingInset?: number }) {
  const state = useStore((s) => s.tabsState);
  const panes = useStore((s) => s.paneBoxes);
  const ref = useRef<HTMLDivElement>(null);
  const [strip, setStrip] = useState<{ left: number; right: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setStrip((cur) => (cur && cur.left === Math.round(r.left) && cur.right === Math.round(r.right) ? cur : { left: Math.round(r.left), right: Math.round(r.right) }));
    };
    measure();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const last = state.groups.length - 1;
  // Place each pane's tabs exactly above that pane when we know where it is.
  const aligned = strip !== null && panes.length === state.groups.length;
  return (
    <div ref={ref} className={cn("h-full min-w-0 flex-1", aligned ? "relative" : "flex")}>
      {state.groups.map((group, index) => {
        let style: React.CSSProperties;
        if (aligned) {
          const left = Math.max(0, panes[index].left - strip.left);
          const right = index === last ? strip.right - strip.left : Math.max(left, panes[index].right - strip.left);
          style = { position: "absolute", top: 0, bottom: 0, left, width: right - left };
        } else {
          style = { flex: `${state.groups.length > 1 ? (index === 0 ? state.ratio : 1 - state.ratio) : 1} 1 0%` };
        }
        return (
          <div key={group.id} className={cn("h-full min-w-0", index > 0 && "border-l border-border/60")} style={style}>
            <GroupTabs group={group} index={index} inset={index === 0 ? leadingInset : 0} trailing={index === last ? trailingInset : 0} />
          </div>
        );
      })}
    </div>
  );
}
