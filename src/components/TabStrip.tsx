import { useEffect, useLayoutEffect, useRef } from "react";
import { Reorder } from "motion/react";
import { Columns2, FileText, Plus, X } from "lucide-react";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import { type TabGroup, type Tab } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";

function GroupTabs({ group, index, inset, trailing }: { group: TabGroup; index: number; inset: number; trailing: number }) {
  const focused = useStore((s) => s.tabsState.focused === index);
  const split = useStore((s) => s.tabsState.groups.length > 1);
  const activate = useStore((s) => s.activateTab);
  const close = useStore((s) => s.closeTab);
  const focusPane = useStore((s) => s.focusPane);
  const newTab = useStore((s) => s.newTab);
  const closePane = useStore((s) => s.closePane);
  const splitActive = useStore((s) => s.splitActive);
  const reorder = useStore((s) => s.reorderTabs);
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
      onReorder={(next: Tab[]) => { const from = group.tabs.findIndex((t, i) => next[i]?.id !== t.id); if (from >= 0) reorder(from, next.findIndex((t) => t.id === group.tabs[from].id), index); }}>
      {group.tabs.map((tab) => {
        const active = tab.id === group.activeId;
        const label = tab.path ? baseName(tab.path) : "Overview";
        return <Reorder.Item key={tab.id} value={tab} as="div" initial={false} className="h-7 min-w-24 max-w-48 shrink-0" whileDrag={{ zIndex: 20 }}>
          <ContextMenu><ContextMenuTrigger asChild>
            <div className={cn("group flex h-full items-center rounded-lg transition-colors duration-100", active ? focused ? "bg-foreground/[0.10] text-foreground" : "bg-foreground/[0.05] text-foreground/80" : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground")} onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); close(tab.id); } }}>
              <button type="button" role="tab" id={`file-tab-${tab.id}`} aria-label={label} aria-selected={active} aria-controls={`editor-workspace-${group.id}`} data-group-focused={focused} tabIndex={active ? 0 : -1} title={tab.path ?? "Folder overview"} className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring/50" onPointerDown={(e) => { if (e.button === 0) activate(tab.id); }} onClick={() => { if (!focused || !active) activate(tab.id); }} onKeyDown={(e) => {
                if (e.altKey || e.ctrlKey || e.metaKey) return;
                const at = group.tabs.findIndex((t) => t.id === tab.id);
                const next = e.key === "ArrowRight" ? group.tabs[(at + 1) % group.tabs.length] : e.key === "ArrowLeft" ? group.tabs[(at - 1 + group.tabs.length) % group.tabs.length] : e.key === "Home" ? group.tabs[0] : e.key === "End" ? group.tabs[group.tabs.length - 1] : null;
                if (e.key === "Delete") { e.preventDefault(); close(tab.id); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[role=tab][data-group-focused=true][aria-selected=true]')?.focus()); }
                if (next) { e.preventDefault(); activate(next.id); document.getElementById(`file-tab-${next.id}`)?.focus(); }
              }}><FileText className="size-3 shrink-0 opacity-60" /><span className="truncate">{label}</span></button>
              <button type="button" aria-label={`Close ${label}`} tabIndex={-1} onPointerDown={(e) => e.stopPropagation()} onClick={() => close(tab.id)} className={cn("mr-1 flex size-4 shrink-0 items-center justify-center rounded-sm hover:bg-foreground/10 group-hover:opacity-100 group-focus-within:opacity-100", active ? "opacity-70" : "opacity-0")}><X className="size-3" /></button>
            </div>
          </ContextMenuTrigger><ContextMenuContent><ContextMenuItem onSelect={() => close(tab.id)}>Close tab</ContextMenuItem>{split && <ContextMenuItem onSelect={() => closePane(index)}>Close pane</ContextMenuItem>}</ContextMenuContent></ContextMenu>
        </Reorder.Item>;
      })}
    </Reorder.Group>
    <div className="flex shrink-0 items-center" data-no-drag>
      <button type="button" aria-label="New tab" title="New tab (Ctrl+T)" onClick={() => newTab(index)} className={action}><Plus className="size-3.5" /></button>
      <button type="button" aria-label={split ? "Close pane" : "Split editor right"} title={split ? "Close pane" : "Split editor right"} onClick={() => { if (split) closePane(index); else { focusPane(index); splitActive(); } }} className={action}>{split ? <X className="size-3" /> : <Columns2 className="size-3.5" />}</button>
    </div><div className="h-full min-w-1 flex-1" />
  </div>;
}

export function TabStrip({ leadingInset = 0, trailingInset = 0 }: { leadingInset?: number; trailingInset?: number }) {
  const state = useStore((s) => s.tabsState);
  return <div className="flex h-full min-w-0 flex-1">{state.groups.map((group, index) => <div key={group.id} className={cn("h-full min-w-0", index > 0 && "border-l border-border/60")} style={{ flex: `${state.groups.length > 1 ? index === 0 ? state.ratio : 1 - state.ratio : 1} 1 0%` }}><GroupTabs group={group} index={index} inset={index === 0 ? leadingInset : 0} trailing={index === state.groups.length - 1 ? trailingInset : 0} /></div>)}</div>;
}
