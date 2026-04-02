import { useStore } from "@/store";
import type { VaultEntry } from "@/types";
import {
  Folder,
  FolderOpen,
  Pencil as PencilIcon,
  Copy as CopyIcon,
  Pin as DrawingPinFilledIcon,
  Trash2 as TrashIcon,
  Plus as PlusIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "motion/react";
import { sortEntries } from "./file-tree-helpers";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/dates";

export function FileTreeNodeStatic({ entry }: { entry: VaultEntry }) {
  if (entry.is_dir) {
    return (
      <div className="flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm font-medium bg-sidebar-accent text-foreground border border-border/50 shadow-lg">
        <Folder className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{entry.name}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center w-full rounded-md py-1.5 px-2 text-sm text-left bg-sidebar-accent text-foreground border border-border/50 shadow-lg">
      <span className="truncate">{entry.name}</span>
    </div>
  );
}

function useFileTreeStore() {
  const activeNotePath = useStore((state) => state.activeNote?.path);
  const selectNote = useStore((state) => state.selectNote);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const createNote = useStore((state) => state.createNote);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const pinNote = useStore((state) => state.pinNote);
  const prefetchNote = useStore((state) => state.prefetchNote);
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);
  const navigateToFolder = useStore((state) => state.navigateToFolder);
  const expandedFolders = useStore((state) => state.expandedFolders);
  const toggleFolderExpanded = useStore((state) => state.toggleFolderExpanded);

  return {
    activeNotePath,
    selectNote,
    duplicateNote,
    createNote,
    openCreateFolder,
    pinNote,
    prefetchNote,
    openRename,
    openDelete,
    navigateToFolder,
    expandedFolders,
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
    selectNote,
    duplicateNote,
    createNote,
    openCreateFolder,
    pinNote,
    prefetchNote,
    openRename,
    openDelete,
    navigateToFolder,
    expandedFolders,
    toggleFolderExpanded,
  } = useFileTreeStore();

  const expanded = expandedFolders.has(entry.path);
  const isDraggingThis = isDraggingId === entry.path;
  const isOverFolder = dropTarget === entry.path;

  const handleClick = () => {
    if (entry.is_dir) {
      toggleFolderExpanded(entry.path);
    } else {
      selectNote(entry.path, {
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
        className="relative transition-all duration-100 rounded-md folder-drop-zone"
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
              <button
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                className={cn(
                  "flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm font-medium transition-colors cursor-pointer text-foreground hover:bg-sidebar-accent"
                )}
              >
                {expanded ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate pr-1">{entry.name}</span>
              </button>
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-48">
            <ContextMenuItem onClick={() => navigateToFolder(entry.path)}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Open folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => createNote(entry.path)}>
              <PlusIcon className="mr-2 h-4 w-4" />
              New note
            </ContextMenuItem>
            <ContextMenuItem onClick={() => openCreateFolder(entry.path)}>
              <Folder className="mr-2 h-4 w-4" />
              New folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => openRename(entry.path, entry.name, true)}>
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

        <AnimatePresence initial={false}>
          {expanded && children.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
              className="overflow-hidden"
            >
              <div className="ml-[15px] pl-2 relative pb-0.5 mt-0.5 rounded-md">
                <div className="absolute top-0 bottom-1 left-0 w-[1px] bg-border/80" />
                
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const isActive = activeNotePath === entry.path;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn("relative group/note", isDraggingThis && "opacity-35")}>
              <button
                onClick={handleClick}
                onMouseDown={handleMouseDown}
                onMouseEnter={() => prefetchNote(entry.path)}
                className={cn(
                  "flex items-center w-full rounded-md py-1.5 px-2 text-sm text-left transition-colors cursor-pointer font-medium",
                  isActive
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-muted-foreground font-normal hover:text-foreground hover:bg-sidebar-accent"
                )}
              >
                <span className="truncate pr-1">{entry.name}</span>
              </button>
            </div>
          </TooltipTrigger>
          {entry.created_at && (
            <TooltipContent>
              Created {formatRelativeDate(entry.created_at)}
            </TooltipContent>
          )}
        </Tooltip>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openRename(entry.path, entry.name)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(entry.path)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => pinNote(entry.path)}>
          <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
          Pin note
        </ContextMenuItem>
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
