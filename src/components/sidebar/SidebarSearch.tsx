import { useState, useEffect } from "react";
import { Search as MagnifyingGlassIcon } from "lucide-react";
import { useVaultStore } from "@/stores/useVaultStore";

interface SidebarSearchProps {
  onSearchChange?: (isActive: boolean) => void;
}

export function SidebarSearch({ onSearchChange }: SidebarSearchProps) {
  const { searchNotes } = useVaultStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      searchNotes(searchQuery);
      onSearchChange?.(searchQuery.trim().length > 0);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, searchNotes, onSearchChange]);

  return (
    <div className="px-2 py-2 shrink-0">
      <div className="relative">
        <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full h-8 pl-8 pr-3 text-[13px] bg-sidebar-accent/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
        />
      </div>
    </div>
  );
}
