import { useStore } from "@/store";

const SORT_LABELS = {
  "name-asc": "A → Z",
  "name-desc": "Z → A",
  modified: "Most Recent",
} as const;

export function SidebarFooter() {
  const sidebarSort = useStore((state) => state.sidebarSort);
  const cycleSidebarSort = useStore((state) => state.cycleSidebarSort);

  return (
    <div className="shrink-0 border-t border-border bg-sidebar/50 mt-auto">
      <button
        onClick={cycleSidebarSort}
        className="flex items-center w-full gap-2 px-2 py-2 text-xs font-bold text-muted-foreground/80 hover:text-foreground hover:bg-sidebar-accent/50 transition-all group uppercase tracking-widest cursor-pointer"
        title="Cycle sort order"
      >
        <span className="text-muted-foreground/50">Sort:</span>
        <span>
          {SORT_LABELS[sidebarSort as keyof typeof SORT_LABELS]}
        </span>
      </button>
    </div>
  );
}
