import { useStore } from "@/store";
import { ChevronDown, ChevronRight, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TagCount } from "@/types";

export function TagsPanel() {
  const tags = useStore((state) => state.tags);
  const activeTagFilters = useStore((state) => state.activeTagFilters);
  const toggleTagFilter = useStore((state) => state.toggleTagFilter);
  const clearTagFilters = useStore((state) => state.clearTagFilters);

  const tagsCollapsed = useStore((state) => state.tagsCollapsed);
  const toggleTagsCollapsed = useStore((state) => state.toggleTagsCollapsed);
  const isOpen = !tagsCollapsed;

  return (
    <div className="shrink-0 border-t border-border bg-sidebar/50">
      <div className={cn("flex items-center", isOpen && "pb-1")}>
        <button 
          onClick={() => toggleTagsCollapsed()}
          className="flex flex-1 items-center gap-1.5 group text-left transition-all hover:bg-sidebar-accent/50 px-2 py-2 cursor-pointer"
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
          )}
          <span className="text-[10px] font-bold text-foreground uppercase tracking-widest group-hover:text-foreground">
            Tags
          </span>
        </button>
        {activeTagFilters.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearTagFilters();
            }}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors mr-3 px-1 py-0.5 rounded hover:bg-sidebar-accent cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
      
      <div 
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-2 pb-3 space-y-0.5 pt-0.5 max-h-[200px] overflow-y-auto pr-1">
            {tags.length === 0 ? (
              <div className="px-2.5 py-1 text-[12px] text-muted-foreground italic">
                No tags yet
              </div>
            ) : (
              tags.map((tag: TagCount) => (
                <button
                  key={tag.name}
                  onClick={() => toggleTagFilter(tag.name)}
                  className={`group flex items-center justify-between w-full rounded-md pr-2 pl-2 py-[5.5px] text-[13px] transition-all cursor-pointer font-medium ${
                    activeTagFilters.includes(tag.name)
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    <Hash className="h-3 w-3 text-muted-foreground/40" />
                    {tag.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70 tabular-nums group-hover:text-foreground transition-colors">
                    {tag.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
