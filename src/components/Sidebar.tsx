import { useEffect, useRef, useState } from "react";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { PanelLeft } from "lucide-react";
import { useStore } from "@/store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PinnedSection } from "@/components/sidebar/PinnedSection";
import { FileTree } from "@/components/sidebar/FileTree";
import { ResizeGrip } from "@/components/ResizeGrip";
import { FRAME_GAP } from "@/lib/surfaces";

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const loadVault = useStore((state) => state.loadVault);
  const loadTags = useStore((state) => state.loadTags);
  const rootPath = useStore((state) => state.target?.path);
  const loadHome = useStore((state) => state.loadAll);
  const loadSidebarState = useStore((state) => state.loadSidebarState);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  /** Where in the grab area the press landed, so the width follows the pointer without jumping. */
  const grab = useRef(0);

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


  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    grab.current = e.clientX - sidebarWidth;
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX - grab.current));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    // Width follows the pointer directly while dragging (see .sidebar-motion).
    document.documentElement.dataset.resizing = "sidebar";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      delete document.documentElement.dataset.resizing;
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="relative h-full flex shrink-0">
      <aside
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        // No border: the page's own edge divides them. pt-px offsets the content row's 1px pull-up.
        className="flex flex-col h-full bg-sidebar select-none pt-px overflow-hidden sidebar-motion"
        aria-hidden={sidebarCollapsed}
      >
        <div style={{ width: sidebarWidth }} className="flex flex-col h-full">
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
          onMouseDown={handleMouseDown}
          className="top-0 z-20"
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
        <p>Expand sidebar ({formatShortcut(bindingFor("toggle-sidebar")!)})</p>
      </TooltipContent>
    </Tooltip>
  );
}
