import { useEffect, useState } from "react";
import { PanelLeft } from "lucide-react";
import { useStore } from "@/store";
import { motion } from "framer-motion";
import { SidebarHeader } from "@/components/sidebar/SidebarHeader";
import { SidebarSearch } from "@/components/sidebar/SidebarSearch";
import { PinnedSection } from "@/components/sidebar/PinnedSection";
import { FileTree, SearchResultsList } from "@/components/sidebar/FileTree";
import { TagsPanel } from "@/components/sidebar/TagsPanel";
import { SidebarFooter } from "@/components/sidebar/SidebarFooter";

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const loadVault = useStore((state) => state.loadVault);
  const loadTags = useStore((state) => state.loadTags);
  const activeVault = useStore((state) => state.activeVault);
  const loadHome = useStore((state) => state.loadAll);
  const loadSidebarState = useStore((state) => state.loadSidebarState);
  const toggleSidebarCollapsed = useStore((state) => state.toggleSidebarCollapsed);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
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

  // Removed redundant const { collapsed } = useSidebarStore() here

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarCollapsed ? 0 : 260 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="sidebar flex flex-col h-full bg-sidebar select-none overflow-hidden shrink-0 border-r border-border"
      aria-hidden={sidebarCollapsed}
    >
      <div className="w-[260px] flex flex-col h-full">
        <SidebarHeader />
        <SidebarSearch onSearchChange={setIsSearchActive} />
        {!isSearchActive && <PinnedSection />}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isSearchActive ? <SearchResultsList /> : <FileTree />}
        </div>
        <TagsPanel />
        <SidebarFooter />
      </div>
    </motion.aside>
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
