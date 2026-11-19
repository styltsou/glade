import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { FileText, Folder } from "lucide-react";
import { dragGhost } from "@/lib/paneDnd";

/** Label that follows the pointer while a tab is being dragged. */
export function DragGhost() {
  const g = useSyncExternalStore(dragGhost.subscribe, dragGhost.get);
  if (!g) return null;
  return createPortal(
    <div
      className="pointer-events-none fixed z-[9999] flex max-w-64 items-center gap-1.5 rounded-lg bg-popover px-2.5 py-1.5 text-[13px] text-popover-foreground shadow-[var(--elev-pop)]"
      style={{ left: g.x + 12, top: g.y + 10 }}
    >
      {g.folder ? <Folder className="size-3.5 shrink-0 opacity-60" /> : <FileText className="size-3.5 shrink-0 opacity-60" />}
      <span className="truncate">{g.label}</span>
    </div>,
    document.body,
  );
}
