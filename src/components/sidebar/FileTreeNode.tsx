import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import type { VaultEntry } from "@/types";
import {
  Folder,
  FolderOpen,
  Pencil as PencilIcon,
  Copy as CopyIcon,
  Pin as DrawingPinFilledIcon,
  PinOff as PinOffIcon,
  Trash2 as TrashIcon,
  Plus as PlusIcon,
  Columns2 as ColumnsIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { sortEntries } from "./file-tree-helpers";
import { cn } from "@/lib/utils";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { Tip } from "@/components/ui/tooltip";
import { NoteTipLabel } from "./NoteTipLabel";
import { MarqueeText } from "@/components/ui/marquee-text";

export function FileTreeNodeStatic({ entry }: { entry: VaultEntry }) {
  if (entry.is_dir) {
    return (
      <div className="flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm font-medium bg-sidebar-accent text-foreground shadow-lg">
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{entry.name}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center w-full rounded-md py-1.5 px-2 text-sm text-left bg-sidebar-accent text-foreground shadow-lg">
      <span className="truncate">{entry.name}</span>
    </div>
  );
}

function useFileTreeStore() {
  const activeNotePath = useStore((state) => state.activeNote?.path);
  const openNote = useStore((state) => state.openNote);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const createNote = useStore((state) => state.createNote);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const pinNote = useStore((state) => state.pinNote);
  const unpinNote = useStore((state) => state.unpinNote);
  const prefetchNote = useStore((state) => state.prefetchNote);
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);
  const navigateToFolder = useStore((state) => state.navigateToFolder);
  const expandedFolders = useStore((state) => state.expandedFolders);
  const pinnedNotePaths = useStore((state) => state.pinnedNotePaths);
  const toggleFolderExpanded = useStore((state) => state.toggleFolderExpanded);

  return {
    activeNotePath,
    openNote,
    duplicateNote,
    createNote,
    openCreateFolder,
    pinNote,
    unpinNote,
    prefetchNote,
    openRename,
    openDelete,
    navigateToFolder,
    expandedFolders,
    pinnedNotePaths,
    toggleFolderExpanded,
  };
}

interface FileTreeNodeProps {
  entry: VaultEntry;
  isDraggingId?: string | null;
  dropTarget?: string | null;
  onMouseDown?: (e: React.MouseEvent, entry: VaultEntry) => void;
  onToggleFolder?: (path: string) => void;
}

export function FileTreeNode({ entry, isDraggingId, dropTarget, onMouseDown, onToggleFolder }: FileTreeNodeProps) {
  const {
    activeNotePath,
    openNote,
    duplicateNote,
    createNote,
    openCreateFolder,
    pinNote,
    unpinNote,
    prefetchNote,
    openRename,
    openDelete,
    navigateToFolder,
    expandedFolders,
    pinnedNotePaths,
    toggleFolderExpanded,
  } = useFileTreeStore();

  const expanded = expandedFolders.includes(entry.path);
  const isDraggingThis = isDraggingId === entry.path;
  const isOverFolder = dropTarget === entry.path;
  const isPinned = !entry.is_dir && pinnedNotePaths.includes(entry.path);

  // A note made from this menu takes the keyboard (its title field).
  const madeNote = useRef(false);

  // Children stay mounted while they animate closed, and mount one frame
  // before they animate open, so the transition has a start and an end.
  const [childrenMounted, setChildrenMounted] = useState(expanded);
  const [childrenOpen, setChildrenOpen] = useState(expanded);
  const unmountTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    clearTimeout(unmountTimer.current);
    if (expanded) {
      setChildrenMounted(true);
      const frame = requestAnimationFrame(() => requestAnimationFrame(() => setChildrenOpen(true)));
      return () => cancelAnimationFrame(frame);
    }
    setChildrenOpen(false);
    // Fallback in case transitionend never fires (reduced motion, no support).
    unmountTimer.current = setTimeout(() => setChildrenMounted(false), 200);
    return () => clearTimeout(unmountTimer.current);
  }, [expanded]);

  const handleClick = (e?: React.MouseEvent) => {
    if (entry.is_dir) {
      toggleFolderExpanded(entry.path);
    } else {
      // Ctrl/Cmd-click: new tab. Alt-click: beside the current note.
      const mode = e && (e.ctrlKey || e.metaKey) ? "tab" : e?.altKey ? "side" : "active";
      openNote(entry.path, mode, {
        path: entry.path,
        title: entry.name,
        tags: entry.tags,
        updated: entry.modified,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (onMouseDown) {
      onMouseDown(e, entry);
    }
  };

  if (entry.is_dir) {
    const children = sortEntries(entry.children);

    return (
      <div
        data-folder-id={entry.path}
        className="relative transition-colors duration-100 rounded-md folder-drop-zone"
        style={{
          background: isOverFolder ? "hsl(var(--primary) / 0.1)" : "transparent",
          outline: isOverFolder ? "1px solid hsl(var(--primary))" : "1px solid transparent",
          outlineOffset: -1,
          zIndex: isOverFolder ? 10 : "auto",
        }}
      >
        <ContextMenu>
          <ContextMenuTrigger>
            <div className="relative group/folder">
              <Tip label={entry.name} side="right">
                <button
                  onClick={handleClick}
                  onMouseDown={handleMouseDown}
                  className={cn(
                    "flex items-center gap-1.5 w-full rounded-lg px-2.5 py-[7px] text-sm font-medium tracking-[-0.005em] transition-colors cursor-pointer text-sidebar-foreground hover:text-foreground hover:bg-foreground/[0.06] active:bg-foreground/[0.09]"
                  )}
                >
                  {expanded ? (
                    <FolderOpen className="size-4 shrink-0" />
                  ) : (
                    <Folder className="size-4 shrink-0" />
                  )}
                  <MarqueeText disabled={!!isDraggingId}>{entry.name}</MarqueeText>
                </button>
              </Tip>
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent
            className="w-48"
            onCloseAutoFocus={(e) => {
              if (!madeNote.current) return;
              madeNote.current = false;
              e.preventDefault();
            }}
          >
            <ContextMenuItem onClick={() => navigateToFolder(entry.path)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open folder
            </ContextMenuItem>
            <ContextMenuItem onClick={() => useStore.getState().openFolderToSide(entry.path)}>
              <ColumnsIcon className="mr-2 h-4 w-4" />
              Open to the side
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                madeNote.current = true;
                void createNote(entry.path);
              }}
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              New note
            </ContextMenuItem>
            <ContextMenuItem onClick={() => openCreateFolder(entry.path)}>
              <Folder className="mr-2 h-4 w-4" />
              New folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => openRename(entry.path, true)}>
              <PencilIcon className="mr-2 h-4 w-4" />
              Rename folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => openDelete(entry.path, entry.name, true)}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {/* Expanding a folder is frequent, so it is quick: 110ms, ease-out,
            on grid rows and opacity (no per-frame measuring). */}
        {childrenMounted && children.length > 0 && (
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-[110ms] ease-[var(--ease-ui)]",
                childrenOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
              onTransitionEnd={(e) => {
                if (e.target === e.currentTarget && !expanded) setChildrenMounted(false);
              }}
            >
              <div className="min-h-0 overflow-hidden">
              <div className="ml-[17px] pl-2 relative pb-0.5 mt-0.5 rounded-md">
                <div className="absolute top-0 bottom-1 left-0 w-px bg-sidebar-foreground/15" />
                
                <div className="flex flex-col gap-0.5">
                  {children.map((child) => (
                    <FileTreeNode 
                      key={child.path} 
                      entry={child} 
                      isDraggingId={isDraggingId}
                      dropTarget={dropTarget}
                      onMouseDown={onMouseDown}
                      onToggleFolder={onToggleFolder}
                    />
                  ))}
                </div>
              </div>
              </div>
            </div>
          )}
      </div>
    );
  }

  const isActive = activeNotePath === entry.path;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className={cn("relative group/note", isDraggingThis && "opacity-35")}>
          <Tip label={<NoteTipLabel title={entry.name} path={entry.path} />} side="right">
            <button
              onClick={handleClick}
              onAuxClick={(e) => e.button === 1 && (e.preventDefault(), openNote(entry.path, "tab"))}
              onMouseDown={handleMouseDown}
              onMouseEnter={() => prefetchNote(entry.path)}
              className={cn(
                "flex items-center w-full rounded-lg py-[7px] px-2.5 text-sm tracking-[-0.005em] text-left transition-colors cursor-pointer",
                isActive
                  ? "bg-foreground/[0.09] text-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)]"
                  : "text-sidebar-foreground font-normal hover:text-foreground hover:bg-foreground/[0.06] active:bg-foreground/[0.09]"
              )}
            >
              <MarqueeText disabled={!!isDraggingId}>{entry.name}</MarqueeText>
            </button>
          </Tip>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openNote(entry.path, "tab")}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Open in new tab
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openNote(entry.path, "side")}>
          <ColumnsIcon className="mr-2 h-4 w-4" />
          Open to the side
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => openRename(entry.path)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename file
          <ContextMenuShortcut>{formatShortcut(bindingFor("rename-file")!)}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(entry.path)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        {isPinned ? (
          <ContextMenuItem onClick={() => unpinNote(entry.path)}>
            <PinOffIcon className="mr-2 h-4 w-4" />
            Unpin note
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => pinNote(entry.path)}>
            <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
            Pin note
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => openDelete(entry.path, entry.name)}
        >
          <TrashIcon className="h-4 w-4 mr-2" />
          Delete note
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
