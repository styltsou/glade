import { useSidebarStore } from "@/stores/useSidebarStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { ChevronLeft as ChevronLeftIcon } from "lucide-react";

export function SidebarHeader() {
  const { toggleCollapsed } = useSidebarStore();
  const { goHome } = useVaultStore();

  return (
    <div className="flex items-center justify-between px-2 pt-3 pb-1 shrink-0">
      <button
        onClick={goHome}
        className="px-2 py-1 text-[13px] font-semibold text-foreground hover:opacity-70 transition-opacity cursor-pointer active:scale-95"
      >
        Glade
      </button>
      <div className="flex items-center gap-0.5">
        <button
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all"
          onClick={toggleCollapsed}
          title="Collapse sidebar (Ctrl+B)"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
