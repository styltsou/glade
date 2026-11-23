import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { PanelLeft } from "lucide-react";
import { useStore } from "@/store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PinnedSection } from "@/components/sidebar/PinnedSection";
import { FileTree } from "@/components/sidebar/FileTree";
import { ResizeGrip } from "@/components/ResizeGrip";
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
          onPointerLeave={sidebarPreview.leave}
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
        </div>
      </aside>

      {/* Resize handle: the same as between panes, spanning the pages' height. It starts 1px
          inside the strip, so the file tree's scrollbar thumb stays as reachable as before. */}
      {!sidebarCollapsed && (
        <ResizeGrip
          before={-1}
          dragging={isResizing}
          aria-label="Resize sidebar"
          onPointerDown={handlePointerDown}
          className="top-0 z-20 touch-none"
          style={{ right: 0, bottom: FRAME_GAP }}
        />
      )}
    </div>
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
          <PanelLeft className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p className="flex items-center gap-2">Expand sidebar<span className="opacity-60">{formatShortcut(bindingFor("toggle-sidebar")!)}</span></p>
      </TooltipContent>
    </Tooltip>
  );
}
