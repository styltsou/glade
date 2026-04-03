import { useState, useEffect, useRef } from "react";
import { useStore } from "@/store";
import { ChevronDown, ChevronRight, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TagCount } from "@/types";

const TAGS_MIN_HEIGHT = 40;
const TAGS_MAX_HEIGHT = 600;

export function TagsPanel() {
  const tags = useStore((state) => state.tags);
  const activeTagFilters = useStore((state) => state.activeTagFilters);
  const toggleTagFilter = useStore((state) => state.toggleTagFilter);
  const clearTagFilters = useStore((state) => state.clearTagFilters);

  const tagsCollapsed = useStore((state) => state.tagsCollapsed);
  const toggleTagsCollapsed = useStore((state) => state.toggleTagsCollapsed);
  const tagsHeight = useStore((state) => state.tagsHeight);
  const setTagsHeight = useStore((state) => state.setTagsHeight);

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ mouseY: number; height: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartRef.current = { mouseY: e.clientY, height: tagsHeight };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing || !resizeStartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = resizeStartRef.current!.mouseY - e.clientY;
      const newHeight = Math.max(TAGS_MIN_HEIGHT, Math.min(TAGS_MAX_HEIGHT, resizeStartRef.current!.height + delta));
      setTagsHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      useStore.getState().saveSidebarState();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "row-resize";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
    };
  }, [isResizing, setTagsHeight]);

  return (
    <div className="shrink-0 mt-1 border-t border-border bg-sidebar/50 relative">
      {/* Resize handle */}
      {!tagsCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary/30 transition-colors z-20",
            isResizing && "bg-primary/50"
          )}
        />
      )}

      <div className="flex items-center">
        <button 
          onClick={() => toggleTagsCollapsed()}
          className="flex-1 flex items-center gap-1.5 group text-left transition-all hover:bg-sidebar-accent/60 px-2 py-2 cursor-pointer"
        >
          {tagsCollapsed  ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
          )}
          <span className="text-xs font-bold text-foreground uppercase tracking-widest group-hover:text-foreground">
            Tags
          </span>
        </button>
        {activeTagFilters.length > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearTagFilters();
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-2 cursor-pointer hover:bg-sidebar-accent/60 whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>
      
      <div 
        className={cn(
          "grid transition-all duration-100 ease-in-out",
          !tagsCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div 
            style={{ height: tagsHeight }}
            className={cn(
              "px-2 overflow-y-auto pr-1 flex flex-col min-h-0",
              tags.length === 0 ? "pb-0 pt-0 overflow-hidden" : "pb-3 pt-0.5 [scrollbar-gutter:stable]"
            )}
          >
            {tags.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-2">
                <p className="text-xs text-muted-foreground">No tags yet</p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {tags.map((tag: TagCount) => (
                  <button
                    key={tag.name}
                    onClick={() => toggleTagFilter(tag.name)}
                    className={`group flex items-center justify-between w-full rounded-md px-2 py-1.5 text-sm transition-all cursor-pointer font-medium ${
                      activeTagFilters.includes(tag.name)
                        ? "bg-sidebar-accent text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                    }`}
                  >
                    <span className="truncate flex items-center gap-2">
                      <Hash className="h-3 w-3 text-muted-foreground/40" />
                      {tag.name}
                    </span>
                    <span className="text-xs text-muted-foreground/70 tabular-nums group-hover:text-foreground transition-colors">
                      {tag.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
