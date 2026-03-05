import { useSidebarStore } from "@/stores/useSidebarStore";

const SORT_LABELS = {
  "name-asc": "A → Z",
  "name-desc": "Z → A",
  modified: "Most Recent",
} as const;

export function SidebarFooter() {
  const { sort, cycleSort } = useSidebarStore();

  return (
    <div className="shrink-0 border-t border-border bg-sidebar/50 mt-auto">
      <button
        onClick={cycleSort}
        className="flex items-center w-full gap-2 px-2 py-2 text-[10px] font-bold text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50 transition-all group uppercase tracking-widest cursor-pointer"
        title="Cycle sort order"
      >
        <span className="text-muted-foreground/50">Sort:</span>
        <span className="pt-[0.5px]">
          {SORT_LABELS[sort]}
        </span>
      </button>
    </div>
  );
}
