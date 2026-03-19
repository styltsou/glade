import { useEffect, useState } from "react";
import { PanelLeft } from "lucide-react";
import { useStore } from "@/store";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader";
import { SidebarSearch } from "@/components/sidebar/SidebarSearch";
import { PinnedSection } from "@/components/sidebar/PinnedSection";
import { FileTree } from "@/components/sidebar/FileTree";
import { SearchResultsList } from "@/components/sidebar/SearchResultsList";
import { TagsPanel } from "@/components/sidebar/TagsPanel";

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const loadVault = useStore((state) => state.loadVault);
  const loadTags = useStore((state) => state.loadTags);
  const activeVault = useStore((state) => state.activeVault);
  const loadHome = useStore((state) => state.loadAll);
  const loadSidebarState = useStore((state) => state.loadSidebarState);
  const toggleSidebarCollapsed = useStore((state) => state.toggleSidebarCollapsed);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const setSidebarWidth = useStore((state) => state.setSidebarWidth);
  const [isResizing, setIsResizing] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    loadVault();
    loadTags();
    loadSidebarState();
  }, [loadVault, loadTags, loadSidebarState]);

  useEffect(() => {
    if (activeVault) {
      loadVault();
      loadHome();
    }
  }, [activeVault, loadVault, loadHome]);

  // Keyboard shortcut Ctrl+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebarCollapsed();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebarCollapsed]);

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
      useStore.getState().saveSidebarState();
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
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
        transition={{ 
          width: isResizing ? { duration: 0 } : { duration: 0.1, ease: [0.4, 0, 0.2, 1] }
        }}
        className="sidebar flex flex-col h-full bg-sidebar select-none overflow-hidden border-r border-border"
        aria-hidden={sidebarCollapsed}
      >
        <div style={{ width: sidebarWidth }} className="flex flex-col h-full">
          <SidebarHeader />
          <SidebarSearch onSearchChange={setIsSearchActive} />
          {!isSearchActive && <PinnedSection />}
          <div className="flex-1 overflow-hidden flex flex-col">
            {isSearchActive ? <SearchResultsList /> : <FileTree />}
          </div>
          <TagsPanel />
        </div>
      </motion.aside>

      {/* Resize handle */}
      {!sidebarCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-20",
            isResizing && "bg-primary/50"
          )}
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
    <button
      onClick={toggleSidebarCollapsed}
      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-r-lg bg-sidebar border border-border border-l-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all cursor-pointer"
      title="Expand sidebar (Ctrl+B)"
    >
      <PanelLeft className="h-4 w-4" />
    </button>
  );
}
