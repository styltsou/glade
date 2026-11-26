import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import { FileText, Folder, Pin, PinOff, Plus, X } from "lucide-react";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import { useNoteLabel } from "@/lib/noteLabel";
import { NoteTipLabel } from "@/components/sidebar/NoteTipLabel";
import { findEntryByPath } from "@/components/sidebar/file-tree-helpers";
import { canPin, type Group as TabGroup, type Tab, type TabDrop } from "@/lib/tabs";
import { dragGhost, hitTest, sameDrop } from "@/lib/paneDnd";
import { cn } from "@/lib/utils";
import { FRAME_GAP, paneBox, tabsStartFlush, useSidebarVisible } from "@/lib/surfaces";
import { Tip } from "@/components/ui/tooltip";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger } from "@/components/ui/context-menu";
import { bindingFor, formatShortcut } from "@/lib/keybindings";

/** A tab's width when the bar has room, and the narrowest it shrinks to. */
const TAB_WIDTH = 192;
const TAB_MIN = 44;
/** Motion has no default unit for min-width (a bare 44 is dropped as invalid CSS), so it gets px strings. */
const MIN_SHUT = "0px";
const MIN_OPEN = `${TAB_MIN}px`;
/** Room an active tab's curve needs beside it. */
const CURVE = 8;

/**
 * One tab's slot. While a tab is dragged within its bar, the other slots slide
 * to their new places (short ease-out, no spring); the dragged slot follows
 * the pointer instead. A closing slot (animating out) is never a drop slot.
 *
 * The slot doesn't clip: the active tab's shape reaches past it into the page.
 * When the bar scrolls, the active slot pins at either end (`pin` is its left
 * inset, with room for its curve), so a page is never cut off from its tab.
 * Sticky insets count from inside the scroller's padding (4px at the end).
 */
function TabSlot({ id, transition, reordering, dragged, active, pin, flush, children }: { id: string; transition: object; reordering: string | false; dragged: boolean; active: boolean; pin: string; flush: boolean; children: React.ReactNode }) {
  const present = useIsPresent();
  // A closing tab hands its shape over at once.
  const joined = active && present;
  return (
    <motion.div
      data-tab-id={id}
      data-exiting={present ? undefined : ""}
      data-dragging={dragged ? "" : undefined}
      data-active={joined ? "" : undefined}
      layout={dragged ? false : "position"}
      layoutDependency={reordering || "idle"}
      initial={{ width: 0, minWidth: MIN_SHUT, opacity: 0, marginRight: 0 }}
      animate={{ width: TAB_WIDTH, minWidth: MIN_OPEN, opacity: 1, marginRight: 4 }}
      exit={{ width: 0, minWidth: MIN_SHUT, opacity: 0, marginRight: 0 }}
      transition={transition}
      // Like a browser's tabs: one width each, shrinking together when the bar
      // runs out of room, down to TAB_MIN; past that the bar scrolls.
      className={cn("@container/tab relative h-8 shrink", dragged ? "z-20" : joined && cn("sticky right-1 z-10", pin))}
    >
      {joined && <span aria-hidden className="tab-surface" data-flush={flush ? "" : undefined} />}
      {children}
    </motion.div>
  );
}

function GroupTabs({ group, index, lead, trailing }: { group: TabGroup; index: number; lead: number; trailing: number }) {
  const flush = tabsStartFlush(index, useSidebarVisible());
  const focused = useStore((s) => s.tabsState.focused === index);
  const split = useStore((s) => s.tabsState.groups.length > 1);
  const activate = useStore((s) => s.activateTab);
  const close = useStore((s) => s.closeTab);
  const closeOthers = useStore((s) => s.closeOtherTabs);
  const focusGroup = useStore((s) => s.focusGroup);
  const newTab = useStore((s) => s.newTab);
  const splitActive = useStore((s) => s.splitActive);
  const moveToOther = useStore((s) => s.moveTabToOtherGroup);
  const setTabPinned = useStore((s) => s.setTabPinned);
  const tabsState = useStore((s) => s.tabsState);
  const otherGroup = useStore((s) => s.tabsState.groups[index === 0 ? 1 : 0]);
  /** The other pane already shows this note, so there is nothing to move. */
  const otherHas = (path: string) => !!otherGroup?.tabs.some((t) => t.path === path);
  const dropHere = useStore((s) => (s.tabDropTarget?.kind === "strip" && s.tabDropTarget.group === index ? s.tabDropTarget : null));
  const rootName = useStore((s) => (s.target ? baseName(s.target.path) : "Overview"));
  const noteCache = useStore((s) => s.noteCache);
  const entries = useStore((s) => s.entries);
  /** A note's title; its file name until that is known. */
  const labelOf = useNoteLabel();
  const titleOf = (path: string) => noteCache[path]?.title || findEntryByPath(entries, path)?.name;
  const noteLabel = (path: string) => labelOf(path, titleOf(path));
  const viewport = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // After a live reorder re-renders the bar, put the dragged tab back under the pointer.
  const followRef = useRef<(() => void) | null>(null);
  const order = group.tabs.map((t) => t.id).join(",");
  // Also when a drag starts: a pinned tab lets go, which moves its slot.
  useLayoutEffect(() => { followRef.current?.(); }, [order, draggingId]);
  // Tabs open and close like a browser's: they grow from and shrink to nothing,
  // and the neighbours follow the width as it changes.
  const tabMotion = reduceMotion
    ? { duration: 0 }
    : { duration: 0.14, ease: [0.23, 1, 0.32, 1] as const, layout: { duration: 0.15, ease: [0.23, 1, 0.32, 1] as const } };
  // Keep the active tab in view: when it changes, as it grows open, and as the bar resizes.
  useLayoutEffect(() => {
    const strip = viewport.current;
    const button = strip?.querySelector<HTMLElement>('[data-tab-id]:not([data-exiting]) [aria-selected="true"]');
    const slot = button?.closest<HTMLElement>("[data-tab-id]");
    if (!strip || !button || !slot) return;
    const reveal = () => {
      // A pinned tab always counts as in view, so aim at its place in the row.
      slot.style.position = "static";
      button.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      slot.style.position = "";
    };
    reveal();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(reveal);
    observer.observe(strip);
    observer.observe(slot);
    return () => observer.disconnect();
  }, [group.activeId, group.tabs.length]);
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
    // Tabs travel between the strip's padding, which holds the curves.
    const padLeft = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
    const store = useStore.getState;
    const indexOf = () => store().tabsState.groups[index]?.tabs.findIndex((t) => t.id === tab.id) ?? -1;
    const origIndex = indexOf();
    let started = false;
    let live = false;
    let target: TabDrop | null = null;
    let lastX = startX;

    // Pulled away from the page's corner, the tab gets its curve and the page its corner back.
    const page = document.querySelector(`[data-pane-index="${index}"]`);
    const setLifted = (lifted: boolean) => {
      slot.toggleAttribute("data-lifted", lifted);
      page?.toggleAttribute("data-lifted", lifted);
    };

    /** Keep the dragged tab under the pointer (x only, clamped to the bar). */
    const follow = () => {
      if (!live) {
        slot.style.transform = "";
        setLifted(false);
        return;
      }
      const rect = strip.getBoundingClientRect();
      const want = lastX - rect.left + strip.scrollLeft - grab;
      const max = strip.scrollWidth - slot.offsetWidth - CURVE;
      const x = Math.max(Math.min(want, max), padLeft);
      slot.style.transform = `translateX(${Math.round(x - slot.offsetLeft)}px)`;
      setLifted(x - padLeft >= CURVE);
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
      setLifted(false);
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

  const action = "press flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground";
  // Not flush, the tabs start 4px in and the first curve overlaps the empty
  // padding beside the folder name: the scroller reaches back for it. With no
  // tabs it is just that padding, so the + sits where the first tab would.
  return <div className="sidebar-motion pointer-events-auto flex h-full min-w-0 items-center pr-1" style={{ marginLeft: lead, paddingLeft: flush ? 0 : 4, paddingRight: trailing || undefined }}>
    <div ref={viewport} role="tablist" aria-label={split ? `${index === 0 ? "Left" : "Right"} pane tabs` : "Open files"} data-tab-strip={index} data-no-drag className="sidebar-motion overlay-scroll relative flex h-full min-w-0 items-center overflow-x-auto overflow-y-hidden pr-1 scroll-pl-4 scroll-pr-2" style={{ flex: "0 1 auto", marginLeft: flush ? 0 : -CURVE, paddingLeft: flush ? 0 : CURVE }}>
      <AnimatePresence initial={false}>
      {group.tabs.map((tab, position) => {
        const active = tab.id === group.activeId;
        const label = tab.path ? noteLabel(tab.path) : typeof tab.folder === "string" ? baseName(tab.folder) : rootName;
        return <TabSlot key={tab.id} id={tab.id} transition={tabMotion} reordering={draggingId ? order : false} dragged={draggingId === tab.id} active={active} pin={flush && position > 0 ? "left-4" : "left-0"} flush={flush && position === 0}>
          <ContextMenu><ContextMenuTrigger asChild>
            <div onPointerDown={(e) => startTabDrag(e, tab, label)} className={cn("group relative flex h-full w-full items-center overflow-hidden rounded-lg transition-colors duration-100 has-[[role=tab]:focus-visible]:ring-1 has-[[role=tab]:focus-visible]:ring-inset has-[[role=tab]:focus-visible]:ring-ring/50", active
                // The shape behind is the fill. No transition, or the hover fill would fade out over it.
                ? "transition-none text-foreground"
                : "text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
              // The pane without focus dims its labels (not the shapes). By opacity, as
              // in many themes the muted colour is almost the foreground's.
              !focused && "opacity-65 hover:opacity-100",
              // The tab being dragged keeps its shape (which also marks where it came from), with a quieter title.
              draggingId === tab.id && "text-muted-foreground")} onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); close(index, tab.id); } }}>
              <Tip label={draggingId ? null : tab.path ? <NoteTipLabel path={tab.path} title={titleOf(tab.path)} /> : typeof tab.folder === "string" ? tab.folder : rootName} align="start"><button type="button" role="tab" id={`file-tab-${tab.id}`} aria-label={label} aria-selected={active} aria-controls={`editor-workspace-${group.id}`} data-group-focused={focused} tabIndex={active ? 0 : -1} className="flex h-full min-w-0 flex-1 items-center gap-2 rounded-lg pl-2.5 pr-8 text-[13px] outline-none @max-[100px]/tab:pr-1.5 @max-[60px]/tab:justify-center @max-[60px]/tab:px-0" onPointerDown={(e) => { if (e.button === 0) activate(index, tab.id); }} onClick={() => { if (!focused || !active) activate(index, tab.id); }} onKeyDown={(e) => {
                if (e.altKey || e.ctrlKey || e.metaKey) return;
                const at = group.tabs.findIndex((t) => t.id === tab.id);
                const next = e.key === "ArrowRight" ? group.tabs[(at + 1) % group.tabs.length] : e.key === "ArrowLeft" ? group.tabs[(at - 1 + group.tabs.length) % group.tabs.length] : e.key === "Home" ? group.tabs[0] : e.key === "End" ? group.tabs[group.tabs.length - 1] : null;
                if (e.key === "Delete") { e.preventDefault(); close(index, tab.id); requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('[role=tab][data-group-focused=true][aria-selected=true]')?.focus()); }
                if (next) { e.preventDefault(); activate(index, next.id); document.getElementById(`file-tab-${next.id}`)?.focus(); }
              }}>{(() => {
                // When the close button shows, it takes the icon's place on a tiny tab.
                const iconClass = cn("size-3.5 shrink-0 opacity-60", active ? "@max-[60px]/tab:hidden" : "@max-[60px]/tab:group-hover:hidden");
                return !tab.path ? <Folder className={iconClass} /> : <FileText className={iconClass} />;
              })()}<span className={cn("min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left @max-[60px]/tab:hidden",
                // Like Chrome, a long name is clipped and fades out at the end
                // (no ellipsis). On a narrow tab the close button sits over the
                // end of the name, so the fade starts further in.
                "[mask-image:linear-gradient(to_left,transparent,black_20px)]",
                active ? "@max-[100px]/tab:[mask-image:linear-gradient(to_left,transparent_18px,black_34px)]" : "@max-[100px]/tab:group-hover:[mask-image:linear-gradient(to_left,transparent_18px,black_34px)]")}>{label}</span></button></Tip>
              <button type="button" data-tab-close aria-label={tab.pinned ? `Unpin ${label}` : `Close ${label}`} tabIndex={-1} onPointerDown={(e) => e.stopPropagation()} onClick={() => (tab.pinned ? setTabPinned(index, tab.id, false) : close(index, tab.id))} className={cn("group/close","absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/70 transition-[color,background-color,opacity] duration-100 hover:bg-foreground/[0.12] hover:text-foreground @max-[60px]/tab:right-1/2 @max-[60px]/tab:translate-x-1/2",
                // Narrow inactive tabs show their close button only on hover, like a browser's.
                active ? "text-foreground/70" : "@max-[100px]/tab:pointer-events-none @max-[100px]/tab:opacity-0 @max-[100px]/tab:group-hover:pointer-events-auto @max-[100px]/tab:group-hover:opacity-100")}>
                {/* A pinned tab shows its pin in the close button's place; pressing it unpins. */}
                {tab.pinned ? (
                  <>
                    <Pin className="size-3.5 group-hover/close:hidden" />
                    <PinOff className="hidden size-3.5 group-hover/close:block" />
                  </>
                ) : (
                  <X className="size-3.5" />
                )}
              </button>
            </div>
          </ContextMenuTrigger><ContextMenuContent
            className="min-w-48"
            // The menu is portaled, but React still bubbles its events through
            // the tab (a drag handle). Keep presses on menu items to the menu.
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {menuSections([
              // Arranging the tab.
              [
                tab.pinned
                  ? <ContextMenuItem key="pin" onSelect={() => setTabPinned(index, tab.id, false)}>Unpin tab</ContextMenuItem>
                  : canPin(tabsState, tab) && <ContextMenuItem key="pin" onSelect={() => setTabPinned(index, tab.id, true)}>Pin tab</ContextMenuItem>,
                split
                  ? (tab.path === null || !otherHas(tab.path)) && <ContextMenuItem key="move" onSelect={() => moveToOther(index, tab.id)}>Move to {index === 0 ? "right" : "left"} pane</ContextMenuItem>
                  : <ContextMenuItem key="split" onSelect={() => { activate(index, tab.id); splitActive(); }}>Split right<ContextMenuShortcut>{formatShortcut(bindingFor("split-right")!)}</ContextMenuShortcut></ContextMenuItem>,
              ],
              // Closing, last. Pinned tabs stay, so the others show only when they would close something.
              [
                <ContextMenuItem key="close" onSelect={() => close(index, tab.id)}>Close tab<ContextMenuShortcut>{formatShortcut(bindingFor("close-tab")!)}</ContextMenuShortcut></ContextMenuItem>,
                group.tabs.some((t) => t.id !== tab.id && !t.pinned) && <ContextMenuItem key="others" onSelect={() => closeOthers(index, tab.id, "others")}>Close other tabs</ContextMenuItem>,
                group.tabs.slice(group.tabs.findIndex((t) => t.id === tab.id) + 1).some((t) => !t.pinned) && <ContextMenuItem key="right" onSelect={() => closeOthers(index, tab.id, "right")}>Close tabs to the right</ContextMenuItem>,
              ],
            ])}
          </ContextMenuContent></ContextMenu>
        </TabSlot>;
      })}
      </AnimatePresence>
      {dropHere && <span aria-hidden className="pointer-events-none absolute top-1.5 bottom-1.5 z-30 w-0.5 -translate-x-[3px] rounded-full bg-primary" style={{ left: Math.max(dropHere.x, 3) }} />}
    </div>
    {/* The same 4px from the last tab as between tabs and below them: it sits
        over the scroller's end padding, which only holds that tab's curve. */}
    <div className="relative -ml-1 flex shrink-0 items-center" data-no-drag>
      <Tip label="New tab (Ctrl+T)"><button type="button" aria-label="New tab" onClick={() => { focusGroup(index); newTab(); }} className={action}><Plus className="size-4" /></button></Tip>
    </div><div className="h-full min-w-1 flex-1" />
  </div>;
}

/**
 * Tabs for each pane, laid out so each group sits exactly above its pane.
 *
 * `paneOffset` is (left edge of the pane area) − (left edge of this strip), in
 * pixels: 0 when the sidebar is open (the title-bar section is as wide as the
 * sidebar), negative when it is closed. The strip reaches back by that much and
 * ends a gap short of the window, so it spans exactly the page area and splits
 * with the pages' own `paneBox`: nothing is measured and nothing lags. The
 * first group's tabs step forward again past the title-bar section, which
 * stays clickable under the strip. Both margins use the sidebar's transition.
 * `trailingInset` counts from the strip's end.
 */
export function TabStrip({ trailingInset = 0, paneOffset = 0 }: { trailingInset?: number; paneOffset?: number }) {
  const state = useStore((s) => s.tabsState);
  const split = state.groups.length > 1;
  const last = state.groups.length - 1;
  return (
    <div className="sidebar-motion pointer-events-none flex h-full min-w-0 flex-1" style={{ marginLeft: paneOffset, paddingRight: FRAME_GAP }}>
      {state.groups.map((group, index) => (
        <div key={group.id} className="h-full min-w-0 flex-1" style={paneBox(index, split, state.ratio)}>
          <GroupTabs group={group} index={index} lead={index === 0 ? -paneOffset : 0} trailing={index === last ? trailingInset : 0} />
        </div>
      ))}
    </div>
  );
}

/**
 * A menu in groups: only the items that apply now, with a separator between
 * groups that both have some, so no context ends up with a stray line.
 */
function menuSections(sections: (React.ReactElement | false | null | undefined)[][]): React.ReactNode {
  const shown = sections.map((items) => items.filter((item): item is React.ReactElement => !!item)).filter((items) => items.length > 0);
  return shown.flatMap((items, i) => (i === 0 ? items : [<ContextMenuSeparator key={`separator-${i}`} />, ...items]));
}
