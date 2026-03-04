import {
  Type as LetterCaseCapitalizeIcon,
  Clock as ClockIcon,
} from "lucide-react";
import { useSidebarStore } from "@/stores/useSidebarStore";

const SORT_LABELS = {
  "name-asc": "A → Z",
  "name-desc": "Z → A",
  modified: "Recent",
} as const;

export function SidebarFooter() {
  const { sort, cycleSort } = useSidebarStore();

  return (
    <div className="shrink-0 border-t border-border px-2 py-2">
      <div className="flex items-center justify-between w-full pr-0.5">
        <button
          onClick={cycleSort}
          className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground transition-colors cursor-default"
          title="Cycle sort order"
        >
          {sort === "modified" ? (
            <ClockIcon className="h-3 w-3" />
          ) : (
            <LetterCaseCapitalizeIcon className="h-3 w-3" />
          )}
          <span className="pt-[0.5px] uppercase tracking-wider text-[10px] font-bold">
            {SORT_LABELS[sort]}
          </span>
        </button>
      </div>
    </div>
  );
}
