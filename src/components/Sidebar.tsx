import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { SidebarToggleIcon } from "@/components/SidebarToggleIcon";
import { useStore } from "@/store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PinnedSection } from "@/components/sidebar/PinnedSection";
import { TagsSection } from "@/components/sidebar/TagsSection";
import { FileTree } from "@/components/sidebar/FileTree";
import { GRIP_REACH } from "@/components/ResizeGrip";
import { WorkspaceMenu } from "@/components/WorkspaceMenu";
import { FRAME_GAP } from "@/lib/surfaces";
import { startSidebarResize } from "@/lib/sidebarResize";
import type { SidebarPreview } from "@/hooks/useSidebarPreview";

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar({ sidebarPreview }: { sidebarPreview: SidebarPreview }) {
  const loadVault = useStore((state) => state.loadVault);
  const loadTags = useStore((state) => state.loadTags);
  const rootPath = useStore((state) => state.target?.path);
  const loadHome = useStore((state) => state.loadAll);
  const loadSidebarState = useStore((state) => state.loadSidebarState);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  // The peek stays while its menu is open: the open menu takes the pointer, which
  // would read as leaving the peek.
  const menuOpen = useRef(false);
  const leavePeek = (event: React.PointerEvent) => {
    if (!menuOpen.current) sidebarPreview.leave(event);
  };
  const onMenuOpenChange = (open: boolean) => {
    menuOpen.current = open;
    // Whatever was picked is done, and the pointer is usually elsewhere by now.
    if (!open && sidebarCollapsed) sidebarPreview.dismiss();
  };
  const stopResize = useRef<(() => void) | null>(null);
  useEffect(() => () => stopResize.current?.(), []);

  useEffect(() => {
    loadVault();
    loadTags();
    loadSidebarState();
  }, [loadVault, loadTags, loadSidebarState]);

  useEffect(() => {
    if (rootPath) {
      loadVault();
      loadHome();
    }
  }, [rootPath, loadVault, loadHome]);


  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || stopResize.current) return;
    e.preventDefault();
    setIsResizing(true);
    stopResize.current = startSidebarResize(e.currentTarget, e, sidebarWidth, (width) => {
      // Update both fallback widths before the temporary CSS width is removed.
      flushSync(() => setSidebarWidth(width));
    }, () => {
      stopResize.current = null;
      setIsResizing(false);
    });
  };

  return (
    <div className="relative z-10 h-full flex shrink-0">
      <aside
        style={{ width: sidebarCollapsed ? 0 : `var(--sidebar-live-width, ${sidebarWidth}px)` }}
        className="relative h-full shrink-0 sidebar-motion"
      >
        {sidebarCollapsed && sidebarPreview.open && (
          <div
            data-sidebar-preview-zone
            aria-hidden="true"
            onPointerEnter={sidebarPreview.enter}
            onPointerLeave={sidebarPreview.leave}
            className="absolute left-1.5 top-0 z-30 h-1.5 w-[280px]"
          />
        )}
        <div
          data-sidebar-preview-zone
          onPointerEnter={sidebarPreview.enter}
          onPointerLeave={leavePeek}
          aria-hidden={sidebarCollapsed && !sidebarPreview.open}
          style={{
            width: sidebarCollapsed ? 280 : `var(--sidebar-live-width, ${sidebarWidth}px)`,
            visibility: sidebarCollapsed && !sidebarPreview.open ? "hidden" : "visible",
            opacity: sidebarCollapsed && !sidebarPreview.open ? 0 : 1,
            transform: sidebarCollapsed && !sidebarPreview.open ? "translateX(-8px)" : "translateX(0)",
            transitionDelay: sidebarCollapsed && !sidebarPreview.open ? "0ms, 0ms, 0ms, 150ms" : "0ms",
            pointerEvents: sidebarCollapsed && !sidebarPreview.open ? "none" : undefined,
          }}
          className={`absolute z-30 flex flex-col overflow-hidden bg-sidebar pt-px select-none transition-[width,opacity,transform,visibility] duration-150 ease-out motion-reduce:transition-none [[data-resizing]_&]:transition-none ${sidebarCollapsed ? "left-1.5 top-1.5 bottom-1.5 rounded-lg border border-border/70 shadow-xl" : "left-0 top-0 h-full"}`}
        >
          <PinnedSection />
          <div className="flex-1 overflow-hidden flex flex-col">
            <FileTree />
          </div>
          <TagsSection />
          {/* Here while collapsed too: the peek shows it, and goes once it's used. */}
          <div className="shrink-0 px-1.5 pb-1.5 pt-1">
            <WorkspaceMenu
              folder
              placement="sidebar"
              className="w-full"
              onOpenChange={onMenuOpenChange}
            />
          </div>
        </div>
      </aside>

      {/* The invisible grab area straddles the page's border. */}
      {!sidebarCollapsed && (
        <SidebarResizeHandle dragging={isResizing} onPointerDown={handlePointerDown} />
      )}
    </div>
  );
}

/** Follow the pointer vertically while keeping the tooltip anchored to the seam horizontally. */
function SidebarResizeHandle({ dragging, onPointerDown }: {
  dragging: boolean;
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
}) {
  const reach = GRIP_REACH;
  const [pointerY, setPointerY] = useState(0);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const openTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(openTimer.current), []);

  const closeTooltip = () => {
    window.clearTimeout(openTimer.current);
    setTooltipOpen(false);
  };
  const trackPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragging) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPointerY(event.clientY - rect.top);
  };

  return (
    <Tooltip open={tooltipOpen && !dragging} onOpenChange={setTooltipOpen}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onPointerDown={(event) => {
          closeTooltip();
          onPointerDown(event);
        }}
        onPointerEnter={(event) => {
          if (event.pointerType === "touch" || dragging) return;
          trackPointer(event);
          window.clearTimeout(openTimer.current);
          openTimer.current = window.setTimeout(() => setTooltipOpen(true), 100);
        }}
        onPointerMove={trackPointer}
        onPointerLeave={closeTooltip}
        className="sidebar-resize-handle absolute top-0 z-40 cursor-ew-resize touch-none"
        style={{ right: -reach / 2, bottom: FRAME_GAP, width: reach }}
      >
        <TooltipTrigger asChild>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-px"
            style={{ left: reach / 2, top: pointerY }}
          />
        </TooltipTrigger>
      </div>
      <TooltipContent
        side="right"
        align="center"
        sideOffset={12}
        updatePositionStrategy="always"
        className="block space-y-0.5 text-center"
      >
        <div>
          <span className="font-semibold">Drag</span>
          <span className="text-background/75"> to resize</span>
        </div>
        <div>
          <span className="font-semibold">{formatShortcut(bindingFor("toggle-sidebar")!)}</span>
          <span className="text-background/75"> to collapse</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Collapse toggle shown when sidebar is collapsed ─────────────────────────

export function SidebarCollapseToggle() {
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useStore((state) => state.toggleSidebarCollapsed);
  if (!sidebarCollapsed) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleSidebarCollapsed}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-sidebar border border-border border-l-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors duration-100 cursor-pointer"
        >
          <SidebarToggleIcon expanded={!sidebarCollapsed} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="flex items-center gap-2">Expand sidebar<span className="opacity-60">{formatShortcut(bindingFor("toggle-sidebar")!)}</span></p>
      </TooltipContent>
    </Tooltip>
  );
}
