import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { FileText, Folder, Plus, X } from "lucide-react";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import { type Group as TabGroup, type Tab, type TabDrop } from "@/lib/tabs";
import { dragGhost, hitTest, sameDrop } from "@/lib/paneDnd";
import { cn } from "@/lib/utils";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { bindingFor, formatShortcut } from "@/lib/keybindings";

/** A tab's width when the bar has room, and the narrowest it shrinks to. */
const TAB_WIDTH = 192;
const TAB_MIN = 44;

/**
 * One tab's slot. While a tab is dragged within its bar, the other slots slide
 * to their new places (short ease-out, no spring); the dragged slot follows
 * the pointer instead. A closing slot (animating out) is never a drop slot.
 */
function TabSlot({ id, transition, reordering, dragged, children }: { id: string; transition: object; reordering: string | false; dragged: boolean; children: React.ReactNode }) {
  const present = useIsPresent();
  return (
    <motion.div
      data-tab-id={id}
      data-exiting={present ? undefined : ""}
      data-dragging={dragged ? "" : undefined}
      layout={dragged ? false : "position"}
      layoutDependency={reordering || "idle"}
      initial={{ width: 0, minWidth: 0, opacity: 0, marginRight: 0 }}
      animate={{ width: TAB_WIDTH, minWidth: TAB_MIN, opacity: 1, marginRight: 4 }}
      exit={{ width: 0, minWidth: 0, opacity: 0, marginRight: 0 }}
      transition={transition}
      // Like a browser's tabs: one width each, shrinking together when the bar
      // runs out of room, down to TAB_MIN; past that the bar scrolls.
      className={cn("@container/tab relative h-8 shrink", dragged ? "z-20 overflow-visible" : "overflow-hidden")}
    >
      {children}
    </motion.div>
  );
}

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
  const dropHere = useStore((s) => (s.tabDropTarget?.kind === "strip" && s.tabDropTarget.group === index ? s.tabDropTarget : null));
  const rootName = useStore((s) => (s.target ? baseName(s.target.path) : "Overview"));
  const viewport = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // After a live reorder re-renders the bar, put the dragged tab back under the pointer.
  const followRef = useRef<(() => void) | null>(null);
  const order = group.tabs.map((t) => t.id).join(",");
  useLayoutEffect(() => { followRef.current?.(); }, [order]);
  // Tabs open and close like a browser's: they grow from and shrink to nothing,
  // and the neighbours follow the width as it changes.
  const tabMotion = reduceMotion
    ? { duration: 0 }
    : { duration: 0.14, ease: [0.23, 1, 0.32, 1] as const, layout: { duration: 0.15, ease: [0.23, 1, 0.32, 1] as const } };
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

  /**
   * Drag a tab. Within its own bar it is reordered live: it follows the
   * pointer and its neighbours slide aside. Elsewhere (the other bar, a pane)
   * a label follows the pointer and an insertion line or pane highlight shows
   * where it will land. No physics anywhere; Esc puts it back.
   */
  const startTabDrag = (e: React.PointerEvent, tab: Tab, label: string) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("[data-tab-close]")) return;
    const slot = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-tab-id]");
    const strip = viewport.current;
    if (!slot || !strip) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const grab = startX - slot.getBoundingClientRect().left;
    const store = useStore.getState;
    const indexOf = () => store().tabsState.groups[index]?.tabs.findIndex((t) => t.id === tab.id) ?? -1;
    const origIndex = indexOf();
    let started = false;
    let live = false;
    let target: TabDrop | null = null;
    let lastX = startX;

    /** Keep the dragged tab under the pointer (x only, clamped to the bar). */
    const follow = () => {
      if (!live) {
        slot.style.transform = "";
        return;
      }
      const rect = strip.getBoundingClientRect();
      const want = lastX - rect.left + strip.scrollLeft - grab;
      const max = strip.scrollWidth - slot.offsetWidth;
      slot.style.transform = `translateX(${Math.round(Math.min(Math.max(want, 0), max) - slot.offsetLeft)}px)`;
    };
    followRef.current = follow;

    /** Settle the dragged tab into its slot (short ease-out). */
    const settle = () => {
      if (!slot.style.transform) return;
      slot.style.transition = "transform 140ms cubic-bezier(0.23, 1, 0.32, 1)";
      slot.style.transform = "";
      setTimeout(() => { slot.style.transition = ""; }, 160);
    };

    const end = (drop: boolean) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey, true);
      followRef.current = null;
      if (!started) return;
      dragGhost.set(null);
      store().setTabDropTarget(null);
      document.documentElement.removeAttribute("data-dragging-tab");
      if (!drop) {
        const now = indexOf();
        if (now >= 0 && now !== origIndex) store().reorderTabs(index, now, origIndex);
        settle();
      } else if (target && !(target.kind === "strip" && target.group === index)) {
        slot.style.transform = "";
        store().dropTabAt(index, tab.id, target);
      } else {
        settle();
        store().activateTab(index, tab.id);
      }
      setDraggingId(null);
    };
    const onMove = (ev: PointerEvent) => {
      lastX = ev.clientX;
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return;
        started = true;
        setDraggingId(tab.id);
        document.documentElement.setAttribute("data-dragging-tab", "");
      }
      const next = hitTest(ev.clientX, ev.clientY, store().tabsState.groups.length);
      live = next?.kind === "strip" && next.group === index;
      if (live && next?.kind === "strip") {
        // In its own bar: reorder as the pointer crosses neighbours.
        dragGhost.set(null);
        const from = indexOf();
        if (from >= 0 && next.index !== from) store().reorderTabs(index, from, next.index);
      } else {
        dragGhost.set({ label, folder: !tab.path, x: ev.clientX, y: ev.clientY });
      }
      const shown = live ? null : next;
      if (!sameDrop(shown, target)) store().setTabDropTarget(shown);
      target = live ? next : shown;
      follow();
    };
    const onUp = () => end(true);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.preventDefault();
        ev.stopPropagation();
        end(false);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey, true);
  };

  const action = "press flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground";
  return <div className="flex h-full min-w-0 items-center gap-0.5 px-1" style={{ paddingLeft: inset || undefined, paddingRight: trailing || undefined }}>
    <div ref={viewport} role="tablist" aria-label={split ? `${index === 0 ? "Left" : "Right"} pane tabs` : "Open files"} data-tab-strip={index} data-no-drag className="overlay-scroll relative flex h-full min-w-0 items-center overflow-x-auto overflow-y-hidden" style={{ flex: "0 1 auto", minWidth: group.tabs.length ? undefined : 48 }}>
      <AnimatePresence initial={false}>
      {group.tabs.map((tab) => {
        const active = tab.id === group.activeId;
        const label = tab.path ? baseName(tab.path) : typeof tab.folder === "string" ? baseName(tab.folder) : rootName;
        return <TabSlot key={tab.id} id={tab.id} transition={tabMotion} reordering={draggingId ? order : false} dragged={draggingId === tab.id}>
          <ContextMenu><ContextMenuTrigger asChild>
            <div onPointerDown={(e) => startTabDrag(e, tab, label)} className={cn("group relative flex h-full w-full items-center rounded-lg transition-colors duration-100 has-[[role=tab]:focus-visible]:ring-1 has-[[role=tab]:focus-visible]:ring-inset has-[[role=tab]:focus-visible]:ring-ring/50", active ? focused ? "bg-[hsl(var(--gray-5))] text-foreground" : "bg-accent text-subtle-foreground" : "bg-muted/50 text-muted-foreground/70 hover:bg-[hsl(var(--gray-5))] hover:text-foreground",
              // The tab being dragged keeps a solid fill; a dashed outline marks where it came from.
              draggingId === tab.id && "text-muted-foreground outline-1 outline-dashed outline-border -outline-offset-1")} onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); close(index, tab.id); } }}>
              <button type="button" role="tab" id={`file-tab-${tab.id}`} aria-label={label} aria-selected={active} aria-controls={`editor-workspace-${group.id}`} data-group-focused={focused} tabIndex={active ? 0 : -1} title={tab.path ?? (typeof tab.folder === "string" ? tab.folder : rootName)} className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-2.5 pr-8 text-[13px] outline-none @max-[100px]/tab:pr-1.5 @max-[60px]/tab:justify-center @max-[60px]/tab:px-0" onPointerDown={(e) => { if (e.button === 0) activate(index, tab.id); }} onClick={() => { if (!focused || !active) activate(index, tab.id); }} onKeyDown={(e) => {
                if (e.altKey || e.ctrlKey || e.metaKey) return;
                const at = group.tabs.findIndex((t) => t.id === tab.id);
                const next = e.key === "ArrowRight" ? group.tabs[(at + 1) % group.tabs.length] : e.key === "ArrowLeft" ? group.tabs[(at - 1 + group.tabs.length) % group.tabs.length] : e.key === "Home" ? group.tabs[0] : e.key === "End" ? group.tabs[group.tabs.length - 1] : null;
                if (e.key === "Delete") { e.preventDefault(); close(index, tab.id); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[role=tab][data-group-focused=true][aria-selected=true]')?.focus()); }
                if (next) { e.preventDefault(); activate(index, next.id); document.getElementById(`file-tab-${next.id}`)?.focus(); }
              }}>{(() => {
                // When the close button shows, it takes the icon's place on a tiny tab.
                const iconClass = cn("size-3.5 shrink-0 opacity-60", active ? "@max-[60px]/tab:hidden" : "@max-[60px]/tab:group-hover:hidden");
                return !tab.path ? <Folder className={iconClass} /> : <FileText className={iconClass} />;
              })()}<span className={cn("min-w-0 flex-1 truncate text-left @max-[60px]/tab:hidden",
                // On a narrow tab the close button sits over the end of the
                // name, which fades out beneath it.
                active ? "@max-[100px]/tab:[mask-image:linear-gradient(to_left,transparent_18px,black_34px)]" : "@max-[100px]/tab:group-hover:[mask-image:linear-gradient(to_left,transparent_18px,black_34px)]")}>{label}</span></button>
              <button type="button" data-tab-close aria-label={`Close ${label}`} tabIndex={-1} onPointerDown={(e) => e.stopPropagation()} onClick={() => close(index, tab.id)} className={cn("absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground/70 transition-[color,opacity] duration-100 hover:bg-foreground/[0.07] hover:text-foreground @max-[60px]/tab:right-1/2 @max-[60px]/tab:translate-x-1/2",
                // Narrow inactive tabs show their close button only on hover, like a browser's.
                active ? "text-foreground/70" : "@max-[100px]/tab:pointer-events-none @max-[100px]/tab:opacity-0 @max-[100px]/tab:group-hover:pointer-events-auto @max-[100px]/tab:group-hover:opacity-100")}><X className="size-3.5" /></button>
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
        </TabSlot>;
      })}
      </AnimatePresence>
      {dropHere && <span aria-hidden className="pointer-events-none absolute top-1.5 bottom-1.5 z-10 w-0.5 -translate-x-[3px] rounded-full bg-primary" style={{ left: dropHere.x }} />}
    </div>
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
