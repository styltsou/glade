import { useState, useEffect } from "react";
import { Search as MagnifyingGlassIcon } from "lucide-react";
import { useStore } from "@/store";

interface SidebarSearchProps {
  onSearchChange?: (isActive: boolean) => void;
}

export function SidebarSearch({ onSearchChange }: SidebarSearchProps) {
  const searchNotes = useStore((state) => state.searchNotes);
  const setSidebarQuery = useStore((state) => state.setSidebarQuery);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      searchNotes(searchQuery, true);
      setSidebarQuery(searchQuery);
      onSearchChange?.(searchQuery.trim().length > 0);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, searchNotes, setSidebarQuery, onSearchChange]);

  return (
    <div className="px-2 pt-2 pb-4 shrink-0">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-sm bg-sidebar-accent/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
        />
      </div>
    </div>
  );
}
