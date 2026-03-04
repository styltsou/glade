import { useVaultStore } from "@/stores/useVaultStore";

export function TagsPanel() {
  const { tags, activeTagFilters, toggleTagFilter, clearTagFilters } = useVaultStore();

  return (
    <div className="shrink-0 overflow-auto border-t border-border px-2 py-3">
      <div className="flex items-center justify-between pb-2">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">
          Tags
        </span>
        {activeTagFilters.length > 0 && (
          <button
            onClick={clearTagFilters}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="space-y-0.5">
        {tags.length === 0 ? (
          <div className="px-2.5 py-1 text-[12px] text-muted-foreground italic">
            No tags yet
          </div>
        ) : (
          tags.map((tag) => (
            <button
              key={tag.name}
              onClick={() => toggleTagFilter(tag.name)}
              className={`group flex items-center justify-between w-full rounded-md pr-2 pl-2 py-[5.5px] text-[13px] transition-all cursor-default font-medium ${
                activeTagFilters.includes(tag.name)
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              }`}
            >
              <span className="truncate flex items-center gap-2">
                <span className="text-muted-foreground/60">#</span>
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
  );
}
