import { useEffect, useState } from "react";
import { PanelLeft } from "lucide-react";
import { useStore } from "@/store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PinnedSection } from "@/components/sidebar/PinnedSection";
import { FileTree } from "@/components/sidebar/FileTree";

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
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(600, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <div className="relative h-full flex shrink-0">
      <aside
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        className={`flex flex-col h-full bg-sidebar select-none border-r border-sidebar-border/70 overflow-hidden ${isResizing ? "" : "transition-[width] duration-[180ms] ease-[var(--ease-ui)]"} ${sidebarCollapsed ? "border-r-0" : ""}`}
        aria-hidden={sidebarCollapsed}
      >
        <div style={{ width: sidebarWidth }} className="flex flex-col h-full">
          <PinnedSection />
          <div className="flex-1 overflow-hidden flex flex-col">
            <FileTree />
          </div>
        </div>
      </aside>

      {/* Resize handle */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className="absolute right-0 top-2 bottom-2 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-20"
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
        <p>Expand sidebar (Ctrl+B)</p>
      </TooltipContent>
    </Tooltip>
  );
}
