import { useState, useEffect, useRef } from "react";
import {
  Pencil as PencilIcon,
  Copy as CopyIcon,
  PinOff as PinOffIcon,
  Trash2 as TrashIcon,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { useStore } from "@/store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NoteCard } from "@/types";

const PINNED_MIN_HEIGHT = 40;
const PINNED_MAX_HEIGHT = 400;

export function PinnedSection() {
  const activeNote = useStore((state) => state.activeNote);
  const selectNote = useStore((state) => state.selectNote);
  const pinnedNotes = useStore((state) => state.pinnedNotes);
  const unpinNote = useStore((state) => state.unpinNote);
  const isVaultsLoading = useStore((state) => state.isVaultsLoading);
  const pinnedNotesCollapsed = useStore((state) => state.pinnedNotesCollapsed);
  const togglePinnedNotesCollapsed = useStore((state) => state.togglePinnedNotesCollapsed);
  const pinnedHeight = useStore((state) => state.pinnedHeight);
  const setPinnedHeight = useStore((state) => state.setPinnedHeight);

  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ mouseY: number; height: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeStartRef.current = { mouseY: e.clientY, height: pinnedHeight };
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing || !resizeStartRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientY - resizeStartRef.current!.mouseY;
      const newHeight = Math.max(PINNED_MIN_HEIGHT, Math.min(PINNED_MAX_HEIGHT, resizeStartRef.current!.height + delta));
      setPinnedHeight(newHeight);
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
  }, [isResizing, setPinnedHeight]);

  if (pinnedNotes.length === 0 && !isVaultsLoading) return null;

  return (
    <div className="shrink-0 mb-1 border-b border-border bg-sidebar/50 relative">
      <div className="flex items-center">
        <button
          onClick={() => togglePinnedNotesCollapsed()}
          className="flex-1 flex items-center gap-1.5 group text-left transition-all hover:bg-sidebar-accent/50 px-2 py-2 cursor-pointer"
        >
          {pinnedNotesCollapsed ? (
            <ChevronRight className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" />
          )}
          <span className="text-xs font-bold text-foreground uppercase tracking-widest group-hover:text-foreground">
            Pinned
          </span>
        </button>
      </div>

      <div
        className={cn(
          "grid transition-all duration-100 ease-in-out",
          !pinnedNotesCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div
            style={{ height: pinnedHeight }}
            className={cn(
              "px-2 overflow-y-auto pr-1 flex flex-col min-h-0",
              pinnedNotes.length === 0 && isVaultsLoading
                ? "pb-0 pt-0 overflow-hidden"
                : "pb-3 pt-0.5 [scrollbar-gutter:stable]"
            )}
          >
            {isVaultsLoading ? (
              <div className="space-y-4 px-0">
                <div className="flex items-center w-full px-2">
                  <Skeleton className="h-4 w-full rounded-md" />
                </div>
                <div className="flex items-center w-full px-2">
                  <Skeleton className="h-4 w-full rounded-md" />
                </div>
              </div>
            ) : (
              <div className="space-y-0.5">
                {pinnedNotes.map((note: NoteCard) => (
                  <PinnedItem
                    key={note.path}
                    path={note.path}
                    name={note.title}
                    active={activeNote?.path === note.path}
                    onClick={() => selectNote(note.path)}
                    onUnpin={() => unpinNote(note.path)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resize handle */}
      {!pinnedNotesCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1 cursor-row-resize hover:bg-primary/30 transition-colors z-20",
            isResizing && "bg-primary/50"
          )}
        />
      )}
    </div>
  );
}

function PinnedItem({
  path,
  name,
  active,
  onClick,
  onUnpin,
}: {
  path: string;
  name: string;
  active: boolean;
  onClick: () => void;
  onUnpin: () => void;
}) {
  const duplicateNote = useStore((state) => state.duplicateNote);
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="relative group/note">
          <button
            onClick={onClick}
            className={cn(
              "flex items-center w-full rounded-md py-1.5 px-2 text-sm text-left transition-colors cursor-pointer",
              active
                ? "bg-sidebar-accent text-foreground font-medium"
                : "text-muted-foreground font-normal hover:text-foreground hover:bg-sidebar-accent"
            )}
          >
            <span className="truncate">{name}</span>
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openRename(path, name)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(path)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onUnpin()}>
          <PinOffIcon className="mr-2 h-4 w-4" />
          Unpin note
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => openDelete(path, name)}>
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
