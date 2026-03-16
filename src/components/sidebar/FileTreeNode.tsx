import { useStore } from "@/store";
import type { VaultEntry } from "@/types";
import { useEffect } from "react";
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
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "motion/react";
import { sortEntries } from "./file-tree-helpers";
import { cn } from "@/lib/utils";
import { calculateDropPosition, isDropIntoFolder } from "./dropPosition";

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
  const sidebarSort = useStore((state) => state.sidebarSort);
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
    sidebarSort,
    openRename,
    openDelete,
    navigateToFolder,
    expandedFolders,
    toggleFolderExpanded,
  };
}

export function FileTreeNode({ entry }: { entry: VaultEntry }) {
  const {
    activeNotePath,
    selectNote,
    duplicateNote,
    createNote,
    openCreateFolder,
    pinNote,
    prefetchNote,
    sidebarSort,
    openRename,
    openDelete,
    navigateToFolder,
    expandedFolders,
    toggleFolderExpanded,
  } = useFileTreeStore();

  const expanded = expandedFolders.has(entry.path);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    active,
    over,
  } = useSortable({ id: entry.path });

  useEffect(() => {
    if (isOver && entry.is_dir && !expanded) {
      const timer = setTimeout(() => {
        toggleFolderExpanded(entry.path);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isOver, entry.is_dir, expanded, toggleFolderExpanded, entry.path]);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const dropPosition = calculateDropPosition(isOver, active, over, entry.is_dir, expanded);
  const isIntoFolder = isDropIntoFolder(dropPosition, entry.is_dir);

  if (entry.is_dir) {
    const children = sortEntries(entry.children, sidebarSort);

    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes}
        className={cn(
          "relative transition-all duration-100 rounded-md",
          isIntoFolder && "bg-primary/10 ring-1 ring-primary/30"
        )}
      >
        <ContextMenu>
          <ContextMenuTrigger>
            <div className="relative group/folder">
              {dropPosition === "top" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-20 rounded-full" />
              )}
              
              <button
                {...listeners}
                onClick={() => toggleFolderExpanded(entry.path)}
                className={cn(
                  "flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm font-medium transition-colors cursor-pointer text-foreground",
                  isIntoFolder ? "bg-primary/5" : "hover:bg-sidebar-accent"
                )}
              >
                {expanded ? (
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Folder className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate pr-1">{entry.name}</span>
              </button>

              {dropPosition === "bottom" && !expanded && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-20 rounded-full" />
              )}
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
              <div className="ml-[15px] pl-2 relative pb-0.5 mt-0.5">
                <div className={cn(
                  "absolute top-0 bottom-1 left-0 w-[1px] transition-colors",
                  isIntoFolder ? "bg-primary/40" : "bg-border/80"
                )} />
                
                <div className="flex flex-col gap-0.5">
                  <SortableContext items={children.map(c => c.path)} strategy={verticalListSortingStrategy}>
                    {children.map((child) => (
                      <FileTreeNode key={child.path} entry={child} />
                    ))}
                  </SortableContext>
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
        <div ref={setNodeRef} style={style} {...attributes} className="relative group/note">
          {dropPosition === "top" && (
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-20 rounded-full" />
          )}
          <button
            {...listeners}
            onClick={() => { 
              selectNote(entry.path, { 
                path: entry.path, 
                title: entry.name,
                tags: entry.tags,
                updated: entry.modified
              }); 
            }}
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

          {dropPosition === "bottom" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-20 rounded-full" />
          )}
        </div>
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
