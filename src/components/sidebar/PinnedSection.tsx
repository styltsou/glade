import { useState, useEffect, useRef } from "react";
import { IconSwap } from "@/components/ui/icon-swap";
import { Tip } from "@/components/ui/tooltip";
import { MarqueeText } from "@/components/ui/marquee-text";
import {
  Pencil as PencilIcon,
  Copy as CopyIcon,
  PinOff as PinOffIcon,
  Trash2 as TrashIcon,
  ChevronRight,
  ChevronDown,
  Plus as PlusIcon,
  Columns2 as ColumnsIcon,
  FolderSearch as FolderSearchIcon,
  ClipboardCopy as ClipboardCopyIcon,
} from "lucide-react";
import { useStore } from "@/store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { NoteTipLabel } from "./NoteTipLabel";
import { useNoteLabel } from "@/lib/noteLabel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, SIDEBAR_COLLAPSE } from "@/lib/utils";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { copyPath, revealInFileManager } from "@/lib/fileActions";
import type { NoteCard } from "@/types";

const PINNED_MIN_HEIGHT = 40;
const PINNED_MAX_HEIGHT = 400;

export function PinnedSection() {
  const activeNote = useStore((state) => state.activeNote);
  const selectNote = useStore((state) => state.selectNote);
  const pinnedNotes = useStore((state) => state.pinnedNotes);
  const unpinNote = useStore((state) => state.unpinNote);
  const isVaultsLoading = useStore((state) => state.isVaultLoading);
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
    <div className="shrink-0 mb-1 border-b border-border/60 bg-sidebar relative">
      <div className="flex items-center">
        <button
          onClick={() => togglePinnedNotesCollapsed()}
          className="flex-1 flex items-center gap-1.5 group text-left transition-colors hover:bg-sidebar-accent/60 px-2 py-2 cursor-pointer"
        >
          <IconSwap
            show={pinnedNotesCollapsed ? "collapsed" : "expanded"}
            icons={{
              collapsed: <ChevronRight className="size-3 text-muted-foreground/60 group-hover:text-foreground" />,
              expanded: <ChevronDown className="size-3 text-muted-foreground/60 group-hover:text-foreground" />,
            }}
          />
          <span className="text-[13px] font-medium text-muted-foreground group-hover:text-foreground">
            Pinned
          </span>
        </button>
      </div>

      <div
        className={cn(
          SIDEBAR_COLLAPSE,
          !pinnedNotesCollapsed ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div
            style={{ height: pinnedHeight }}
            className={cn(
              "px-2 overflow-y-auto flex flex-col min-h-0 w-full",
              pinnedNotes.length === 0 && isVaultsLoading
                ? "pb-0 pt-0 overflow-hidden"
                : "pb-3 pt-0.5"
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
  const openNote = useStore((state) => state.openNote);
  const openDelete = useStore((state) => state.openDelete);
  const label = useNoteLabel()(path, name);

  return (
    <ContextMenu>
      <ContextMenuTrigger className="group/menu">
        <div className="relative group/note">
          <Tip label={<NoteTipLabel path={path} title={name} />} side="right">
            <button
              onClick={onClick}
              className={cn(
                "flex items-center w-full rounded-lg py-[7px] px-2.5 text-sm text-left transition-colors cursor-pointer",
                active
                  ? "bg-sidebar-accent text-foreground font-medium"
                  : "text-sidebar-foreground font-normal hover:text-foreground hover:bg-sidebar-accent/60 group-data-[state=open]/menu:bg-sidebar-accent group-data-[state=open]/menu:text-foreground"
              )}
            >
              <MarqueeText>{label}</MarqueeText>
            </button>
          </Tip>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-48">
        <ContextMenuItem onClick={() => openNote(path, "tab")}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Open in new tab
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openNote(path, "side")}>
          <ColumnsIcon className="mr-2 h-4 w-4" />
          Open to the side
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onUnpin()}>
          <PinOffIcon className="mr-2 h-4 w-4" />
          Unpin note
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => openRename(path)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename file
          <ContextMenuShortcut>{formatShortcut(bindingFor("rename-file")!)}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(path)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => revealInFileManager(path)}>
          <FolderSearchIcon className="mr-2 h-4 w-4" />
          Reveal in file manager
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void copyPath(path)}>
          <ClipboardCopyIcon className="mr-2 h-4 w-4" />
          Copy path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => openDelete(path, label)}>
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete note
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
