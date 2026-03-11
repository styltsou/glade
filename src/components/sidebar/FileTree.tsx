import { useStore } from "@/store";
import type { SortMode, VaultEntry } from "@/types";
import type { NoteData } from "@/types";
import { useState, useEffect } from "react";
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
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createPortal } from "react-dom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function sortEntries(
  entries: VaultEntry[],
  sort: SortMode
): VaultEntry[] {
  const copy = [...entries];
  if (sort === "name-asc") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "name-desc") {
    return copy.sort((a, b) => b.name.localeCompare(a.name));
  }
  return copy.sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    if (!a.modified || !b.modified) return 0;
    return new Date(b.modified).getTime() - new Date(a.modified).getTime();
  });
}


function filterByTags(
  entries: VaultEntry[],
  tagFilters: string[]
): VaultEntry[] {
  if (tagFilters.length === 0) return entries;
  
  return entries
    .map((entry) => {
      if (entry.is_dir) {
        const filteredChildren = filterByTags(entry.children, tagFilters);
        return { ...entry, children: filteredChildren };
      }
      return entry;
    })
    .filter((entry) => {
      if (entry.is_dir) return entry.children.length > 0;
      // Show note if it has ANY of the selected tags
      return entry.tags.some((tag) => tagFilters.includes(tag));
    });
}

// ─── FileTree (exported for use in Sidebar) ───────────────────────────────────

export function FileTree() {
  const entries = useStore((state) => state.entries);
  const isVaultLoading = useStore((state) => state.isVaultLoading);
  const createNote = useStore((state) => state.createNote);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const activeTagFilters = useStore((state) => state.activeTagFilters);
  const sidebarSort = useStore((state) => state.sidebarSort);
  const moveEntry = useStore((state) => state.moveEntry);

  const filteredByTags = filterByTags(entries, activeTagFilters);
  const sortedEntries = sortEntries(filteredByTags, sidebarSort);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeEntry = activeId ? findEntryByPath(entries, activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const fromPath = active.id as string;
    const overPath = over.id as string;

    const overEntry = findEntryByPath(entries, overPath);
    if (!overEntry) return;

    // Calculate drop position logic (same as in FileTreeNode for consistency)
    const overRect = over.rect;
    const activeRect = active.rect.current.translated;
    let dropPosition: "top" | "bottom" | "into" = "into";
    
    if (overRect && activeRect) {
      const overTop = overRect.top;
      const overHeight = overRect.height;
      const activeCenter = activeRect.top + activeRect.height / 2;

      const HEADER_HEIGHT = 32;
      const threshold = 6;

      if (overEntry.is_dir) {
        const distFromTop = activeCenter - overTop;
        if (distFromTop < threshold) {
          dropPosition = "top";
        } else if (distFromTop > HEADER_HEIGHT - threshold) {
          // If the folder was closed when we started or it's a quick drag, 
          // we treat the bottom of the header as 'into' if it's open, 
          // or 'bottom' (next-to) if it's closed.
          // Note: Finding if it's expanded here is tricky without state, 
          // but we can assume 'into' is the safer/more common intent for folders.
          dropPosition = "into"; 
        } else {
          dropPosition = "into";
        }
      } else {
        const relativePos = (activeCenter - overTop) / overHeight;
        if (relativePos < 0.5) dropPosition = "top";
        else dropPosition = "bottom";
      }
    }

    let toParentPath = "";
    if (dropPosition === "into" && overEntry.is_dir) {
      // Don't move into itself or its own children
      if (fromPath === overPath || fromPath.startsWith(overPath + "/")) {
        return;
      }
      toParentPath = overPath;
    } else {
      // Move next to the item (same parent)
      const parts = overPath.split("/");
      parts.pop();
      toParentPath = parts.join("/");
    }

    const fileName = fromPath.split("/").pop();
    const toPath = toParentPath ? `${toParentPath}/${fileName}` : fileName!;

    if (fromPath !== toPath) {
      console.log(`Moving from ${fromPath} to ${toPath} (Position: ${dropPosition})`);
      await moveEntry(fromPath, toPath);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!isVaultLoading && (
        <div className="flex items-center justify-between px-2 pl-4 pt-3 pb-2 shrink-0">
          <span className="text-xs font-bold text-foreground uppercase tracking-widest">
            Notes
          </span>
          <div className="flex items-center gap-0.5">
            <button
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all cursor-pointer"
              onClick={() => openCreateFolder()}
              title="New folder"
            >
              <Folder className="h-4 w-4" />
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all cursor-pointer"
              onClick={() => createNote()}
              title="New note"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto px-2 pb-1 [scrollbar-gutter:stable]">
        {isVaultLoading ? (
          <div className="px-2.5 py-4 text-xs text-muted-foreground text-center">
            Loading…
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="px-2.5 py-8 text-center">
            <p className="text-xs text-muted-foreground">No notes yet</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedEntries.map(e => e.path)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {sortedEntries.map((entry) => (
                  <FileTreeNode key={entry.path} entry={entry} />
                ))}
              </div>
            </SortableContext>
            {createPortal(
              <DragOverlay dropAnimation={null}>
                {activeEntry ? (
                  <div className="opacity-80 scale-105 pointer-events-none">
                    <FileTreeNodeStatic entry={activeEntry} />
                  </div>
                ) : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
        )}
      </div>
    </div>
  );
}

// ─── Static version of Node for DragOverlay ──────────────────────────────────

function FileTreeNodeStatic({ entry }: { entry: VaultEntry }) {
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

function findEntryByPath(entries: VaultEntry[], path: string): VaultEntry | null {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    if (entry.children) {
      const found = findEntryByPath(entry.children, path);
      if (found) return found;
    }
  }
  return null;
}


// ─── Search results panel (used by Sidebar when search is active) ─────────────

export function SearchResultsList() {
  const searchResults = useStore((state) => state.searchResults);
  const activeNotePath = useStore((state) => state.activeNote?.path);
  const selectNote = useStore((state) => state.selectNote);
  const prefetchNote = useStore((state) => state.prefetchNote);
  const sidebarQuery = useStore((state) => state.sidebarQuery);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const pinnedNotes = useStore((state) => state.pinnedNotes);
  const pinNote = useStore((state) => state.pinNote);
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);

  if (searchResults.length === 0 && sidebarQuery.trim().length > 0) {
    return (
      <div className="px-2.5 py-8 text-center text-xs text-muted-foreground">
        No matching notes found
      </div>
    );
  }

  const pinnedPaths = new Set<string>(pinnedNotes.map((n: any) => n.path));

  return (
    <div className="space-y-0.5 px-2 py-1 border-t border-border/40">
      {searchResults.map((note: NoteData) => {
        const isPinned = pinnedPaths.has(note.path);
        const isActive = activeNotePath === note.path;

        // Extract folder path (e.g., "Work/Projects/Note.md" -> "Work/Projects")
        const pathParts = note.path.split("/");
        const folderPath = pathParts.slice(0, -1).join("/");

        return (
          <ContextMenu key={note.path}>
            <ContextMenuTrigger>
              <button
                onClick={() => { selectNote(note.path, { path: note.path, title: note.title, tags: note.tags, preview: note.preview }); }}
                onMouseEnter={() => prefetchNote(note.path)}
                className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm text-left transition-colors cursor-pointer font-normal ${
                  isActive
                    ? "bg-sidebar-accent text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                }`}
              >
                <div className="flex flex-col min-w-0 flex-1 pr-1">
                  {folderPath && (
                    <div className="flex items-center gap-1 mb-0.5 opacity-60">
                      <Folder className="h-2.5 w-2.5 shrink-0" />
                      <span className="text-xs font-normal truncate">
                        {folderPath}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center">
                    <span className="truncate pr-1">
                      <Highlight text={note.title} query={sidebarQuery} />
                    </span>
                  </div>
                </div>
              </button>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => openRename(note.path, note.title)}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => duplicateNote(note.path)}>
                <CopyIcon className="mr-2 h-4 w-4" />
                Duplicate
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => pinNote(note.path)}>
                <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
                {isPinned ? "Unpin note" : "Pin note"}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => openDelete(note.path, note.title)}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete note
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      })}
    </div>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return <>{text}</>;

  const escapedTerms = terms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span
            key={i}
            className="bg-primary/20 text-primary px-[1px] rounded-xs font-medium"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

// ─── FileTreeNode (recursive, reads from stores) ──────────────────────────────

function FileTreeNode({ entry }: { entry: VaultEntry }) {
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

  const [expanded, setExpanded] = useState(true);

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

  // Auto-expand folder on hover
  useEffect(() => {
    if (isOver && entry.is_dir && !expanded) {
      const timer = setTimeout(() => {
        setExpanded(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isOver, entry.is_dir, expanded]);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  // Calculate drop position (top, bottom, or middle/into)
  let dropPosition: "top" | "bottom" | "into" | null = null;
  if (isOver && active) {
    const overRect = over?.rect;
    const activeRect = active.rect.current.translated;
    
    if (overRect && activeRect) {
      const overTop = overRect.top;
      const overHeight = overRect.height;
      const activeCenter = activeRect.top + activeRect.height / 2;
      
      // For folders, we only want to consider the header row for drop logic
      // The header row is roughly 32px high. 
      const HEADER_HEIGHT = 32;
      const threshold = 6; // pixels

      if (entry.is_dir) {
        const distFromTop = activeCenter - overTop;
        if (distFromTop < threshold) {
          dropPosition = "top";
        } else if (distFromTop > HEADER_HEIGHT - threshold) {
          // If folder is closed, bottom 6px of header is "bottom"
          // If folder is open, we usually want to drop "into" or "top" of first child
          // But for the folder itself, we'll stick to 'into' for most of it.
          if (!expanded) dropPosition = "bottom";
          else dropPosition = "into";
        } else {
          dropPosition = "into";
        }
      } else {
        const relativePos = (activeCenter - overTop) / overHeight;
        if (relativePos < 0.5) dropPosition = "top";
        else dropPosition = "bottom";
      }
    }
  }

  const isIntoFolder = dropPosition === "into" && entry.is_dir;

  if (entry.is_dir) {
    const children = sortEntries(entry.children, sidebarSort);

    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes}
        className={`relative transition-all duration-200 rounded-md ${
          isIntoFolder ? "bg-primary/10 ring-1 ring-primary/30" : ""
        }`}
      >
        <ContextMenu>
          <ContextMenuTrigger>
            <div className="relative group/folder">
              {dropPosition === "top" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-20 rounded-full" />
              )}
              
              <button
                {...listeners}
                onClick={() => setExpanded((e) => !e)}
                className={`flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm font-medium transition-colors cursor-pointer text-foreground ${
                  isIntoFolder ? "bg-primary/5" : "hover:bg-sidebar-accent"
                }`}
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

        {/* Children rendered inside a margin-left container which doubles as the indent line base */}
        {expanded && (
          <div className="ml-[15px] pl-2 relative pb-0.5">
            {/* Indent guide line — absolutely positioned to not take space, drawn down the left edge */}
            <div className={`absolute top-0 bottom-1 left-0 w-[1px] transition-colors ${isIntoFolder ? "bg-primary/40" : "bg-border/80"}`} />
            
            <div className="flex flex-col gap-0.5">
              <SortableContext items={children.map(c => c.path)} strategy={verticalListSortingStrategy}>
                {children.map((child) => (
                  <FileTreeNode key={child.path} entry={child} />
                ))}
              </SortableContext>
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
            className={`flex items-center w-full rounded-md py-1.5 px-2 text-sm text-left transition-colors cursor-pointer font-medium ${
              isActive
                ? "bg-sidebar-accent text-foreground font-medium"
                : "text-muted-foreground font-normal hover:text-foreground hover:bg-sidebar-accent"
            }`}
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
