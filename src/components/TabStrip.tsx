import { AnimatePresence, Reorder, motion, useReducedMotion } from "motion/react";
import { Columns2, Plus, X } from "lucide-react";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import type { Tab } from "@/lib/tabs";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const EASE = [0.23, 1, 0.32, 1] as const;

function useTabTitle() {
  const noteCache = useStore((s) => s.noteCache);
  const folder = useStore((s) => (s.target ? baseName(s.target.path) : "Overview"));
  return (path: string | null) => {
    if (!path) return folder;
    return noteCache[path]?.title || baseName(path).replace(/\.(md|markdown|mdx)$/i, "");
  };
}

function TabItem({ tab, active, onlyTab }: { tab: Tab; active: boolean; onlyTab: boolean }) {
  const activateTab = useStore((s) => s.activateTab);
  const closeTab = useStore((s) => s.closeTab);
  const splitActive = useStore((s) => s.splitActive);
  const closePane = useStore((s) => s.closePane);
  const focusPane = useStore((s) => s.focusPane);
  const titleOf = useTabTitle();
  const reduce = useReducedMotion();
  const isSplit = tab.panes.length > 1;

  const select = () => {
    activateTab(tab.id);
  };

  return (
    <Reorder.Item
      value={tab}
      as="div"
      layout="position"
      initial={reduce ? false : { opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, transition: { duration: 0.12, ease: EASE } }}
      transition={{ duration: 0.18, ease: EASE }}
      whileDrag={{ scale: 1.03, zIndex: 20 }}
      className="relative min-w-[84px] max-w-[200px] flex-1 basis-0"
      data-no-drag
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            role="tab"
            aria-selected={active}
            tabIndex={0}
            onPointerDown={(e) => e.button === 0 && select()}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault();
                closeTab(tab.id);
              }
            }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && select()}
            className={cn(
              "group press flex h-7 w-full cursor-default items-center gap-1.5 rounded-lg px-2 text-[12.5px] tracking-[-0.005em] transition-colors",
              active
                ? "bg-foreground/[0.09] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.05)]"
                : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground",
            )}
          >
            {isSplit && <Columns2 className="size-3 shrink-0 opacity-70" />}
            <div className="flex min-w-0 flex-1 items-center gap-1">
              {tab.panes.map((pane, i) => (
                <span key={i} className="flex min-w-0 items-center gap-1">
                  {i > 0 && <span className="h-3 w-px shrink-0 bg-foreground/15" />}
                  <span
                    className={cn("truncate", isSplit && active && tab.focused !== i && "opacity-60")}
                    onPointerDown={() => isSplit && active && focusPane(i)}
                  >
                    {titleOf(pane.path)}
                  </span>
                </span>
              ))}
            </div>
            <button
              type="button"
              aria-label="Close tab"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-[opacity,background-color] hover:bg-foreground/[0.12] hover:text-foreground",
                active ? "opacity-70" : "opacity-0 group-hover:opacity-70",
                onlyTab && "hidden",
              )}
            >
              <X className="size-3" />
            </button>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={() => closeTab(tab.id)}>Close tab</ContextMenuItem>
          <ContextMenuSeparator />
          {isSplit ? (
            <>
              <ContextMenuItem
                onClick={() => {
                  activateTab(tab.id);
                  closePane(1);
                }}
              >
                Close right pane
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  activateTab(tab.id);
                  closePane(0);
                }}
              >
                Close left pane
              </ContextMenuItem>
            </>
          ) : (
            <ContextMenuItem
              onClick={() => {
                activateTab(tab.id);
                splitActive();
              }}
            >
              Split right
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>
    </Reorder.Item>
  );
}

/** Tabs (and split tabs) live in the title bar, between the sidebar toggle and the window controls. */
export function TabStrip() {
  const hasTarget = useStore((s) => !!s.target);
  const tabs = useStore((s) => s.tabsState.tabs);
  const activeId = useStore((s) => s.tabsState.activeId);
  const newTab = useStore((s) => s.newTab);
  const reorderTabs = useStore((s) => s.reorderTabs);

  // On Home there is nothing to tab between; the space just drags the window.
  if (!hasTarget) return <div className="h-full flex-1" />;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 px-1" data-no-drag>
      <Reorder.Group
        as="div"
        axis="x"
        values={tabs}
        onReorder={(next: Tab[]) => {
          // Only one tab moves per drag step; find it and apply the move.
          const from = tabs.findIndex((t, i) => next[i]?.id !== t.id);
          if (from === -1) return;
          const to = next.findIndex((t) => t.id === tabs[from].id);
          reorderTabs(from, to);
        }}
        className="flex min-w-0 items-center gap-1"
        style={{ flex: "0 1 auto", maxWidth: "calc(100% - 32px)" }}
      >
        <AnimatePresence initial={false}>
          {tabs.map((tab) => (
            <TabItem key={tab.id} tab={tab} active={tab.id === activeId} onlyTab={tabs.length === 1} />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <motion.button
        layout="position"
        type="button"
        title="New tab (Ctrl+T)"
        aria-label="New tab"
        onClick={newTab}
        className="press flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <Plus className="size-4" />
      </motion.button>
      {/* Empty space stays draggable */}
      <div className="h-full min-w-4 flex-1" data-drag-spacer />
    </div>
  );
}
