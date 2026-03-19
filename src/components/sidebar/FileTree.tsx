import { useStore } from "@/store";
import { useState } from "react";
import {
  Folder,
  Plus as PlusIcon,
} from "lucide-react";
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
} from "@dnd-kit/sortable";
import { createPortal } from "react-dom";
import { sortEntries, filterByTags, findEntryByPath } from "./file-tree-helpers";
import { FileTreeNode, FileTreeNodeStatic } from "./FileTreeNode";
import { Skeleton } from "@/components/ui/skeleton";

function FileTreeSkeleton() {
  const rows = [
    { indent: 0, width: "w-6/12" }, // folder
    { indent: 1, width: "w-full" },   // note
    { indent: 1, width: "w-6/12" },  // subfolder
    { indent: 2, width: "w-8/12" },   // note
    { indent: 3, width: "w-full" },   // note
    { indent: 3, width: "w-full" },   // note
    { indent: 2, width: "w-full" },   // note
    { indent: 1, width: "w-full" },   // note
    { indent: 0, width: "w-8/12" },  // folder
    { indent: 1, width: "w-full" },   // note
    { indent: 0, width: "w-full" },   // note
    { indent: 0, width: "w-full" },   // note
  ];

  return (
    <div className="space-y-4 px-0 pt-2">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center w-full px-2"
          style={{ paddingLeft: `${8 + row.indent * 17}px` }}
        >
          <Skeleton className={`h-4 rounded-md ${row.width} bg-foreground/10`} />
        </div>
      ))}
    </div>
  );
}

// ─── FileTree (exported for use in Sidebar) ───────────────────────────────────

export function FileTree() {
  const entries = useStore((state) => state.entries);
  const isVaultsLoading = useStore((state) => state.isVaultsLoading);
  const createNote = useStore((state) => state.createNote);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const activeTagFilters = useStore((state) => state.activeTagFilters);
  const moveEntry = useStore((state) => state.moveEntry);

  const filteredByTags = filterByTags(entries, activeTagFilters);
  const sortedEntries = sortEntries(filteredByTags);

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
        <div className="flex items-center justify-between px-2 pl-4 pt-3 pb-2 shrink-0">
          <span className="text-xs font-bold text-foreground uppercase tracking-widest">
            Notes
          </span>
          <div className="flex items-center gap-0.5">
            {!isVaultsLoading && (
              <>
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
              </>
            )}
          </div>
        </div>

      <div className="flex-1 overflow-auto px-2 pb-1 [scrollbar-gutter:stable]">
        {isVaultsLoading ? (
          <FileTreeSkeleton />
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
