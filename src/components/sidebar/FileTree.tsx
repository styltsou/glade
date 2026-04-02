import { useStore } from "@/store";
import { useState, useRef, useCallback, useEffect } from "react";
import { Folder, Plus as PlusIcon, FileText, FolderOpen } from "lucide-react";
import { sortEntries, filterByTags } from "./file-tree-helpers";
import { FileTreeNode } from "./FileTreeNode";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { VaultEntry } from "@/types";

function isDescendant(ancestorPath: string, nodePath: string): boolean {
  const ancestorParts = ancestorPath.split("/");
  const nodeParts = nodePath.split("/");
  
  if (ancestorParts.length >= nodeParts.length) return false;
  
  for (let i = 0; i < ancestorParts.length; i++) {
    if (ancestorParts[i] !== nodeParts[i]) return false;
  }
  return true;
}

function FileTreeSkeleton() {
  const rows = [
    { indent: 0, width: "w-6/12" },
    { indent: 1, width: "w-full" },
    { indent: 1, width: "w-6/12" },
    { indent: 2, width: "w-8/12" },
    { indent: 3, width: "w-full" },
    { indent: 3, width: "w-full" },
    { indent: 2, width: "w-full" },
    { indent: 1, width: "w-full" },
    { indent: 0, width: "w-8/12" },
    { indent: 1, width: "w-full" },
    { indent: 0, width: "w-full" },
    { indent: 0, width: "w-full" },
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

function DragGhost({ label, type, pos }: { label: string; type: string; pos: { x: number; y: number } | null }) {
  if (!pos) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: pos.x + 14,
        top: pos.y - 14,
        pointerEvents: "none",
        zIndex: 9999,
        background: "hsl(var(--background))",
        border: "1px solid hsl(var(--primary))",
        borderRadius: 6,
        padding: "4px 10px 4px 8px",
        fontSize: 13,
        color: "hsl(var(--foreground))",
        display: "flex",
        alignItems: "center",
        gap: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        whiteSpace: "nowrap",
      }}
    >
      {type === "folder" ? <FolderOpen className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
      {label}
    </div>
  );
}

export function FileTree() {
  const entries = useStore((state) => state.entries);
  const isVaultsLoading = useStore((state) => state.isVaultsLoading);
  const createNote = useStore((state) => state.createNote);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const activeTagFilters = useStore((state) => state.activeTagFilters);
  const moveEntry = useStore((state) => state.moveEntry);
  const expandedFolders = useStore((state) => state.expandedFolders);
  const toggleFolderExpanded = useStore((state) => state.toggleFolderExpanded);

  const filteredByTags = filterByTags(entries, activeTagFilters);
  const sortedEntries = sortEntries(filteredByTags);

  const [dragState, setDragState] = useState<{ id: string; name: string; type: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);

  const dragRef = useRef<{ id: string; name: string; type: string } | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const expandTimerRef = useRef<NodeJS.Timeout | null>(null);

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, []);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    dropTargetRef.current = null;
    lastMouseRef.current = null;
    clearExpandTimer();
    setDragState(null);
    setDropTarget(null);
    setGhostPos(null);
  }, [clearExpandTimer]);

  useEffect(() => {
    if (!dragState) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelDrag();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dragState, cancelDrag]);

  const getFolderDropTarget = useCallback((ev: MouseEvent): string | null => {
    if (!dragRef.current) return null;
    
    const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
    for (const el of elements) {
      if (el.getAttribute?.("data-slot")?.startsWith("context-menu")) continue;
      const id = el.getAttribute?.("data-folder-id");
      if (!id) continue;
      if (id === dragRef.current.id) continue;
      if (dragRef.current.type === "folder" && isDescendant(dragRef.current.id, id)) continue;
      return id;
    }
    return null;
  }, [sortedEntries]);

  const handleMouseDown = useCallback((e: React.MouseEvent, item: VaultEntry) => {
    if (e.button !== 0) return;
    const hasOpenContextMenu = document.querySelector('[data-radix-collection-item]') !== null;
    if (hasOpenContextMenu) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;

    function onMove(ev: MouseEvent) {
      lastMouseRef.current = { x: ev.clientX, y: ev.clientY };
      
      if (!started && Math.hypot(ev.clientX - startX, ev.clientY - startY) > 5) {
        started = true;
        dragRef.current = { id: item.path, name: item.name, type: item.is_dir ? "folder" : "note" };
        setDragState({ id: item.path, name: item.name, type: item.is_dir ? "folder" : "note" });
      }
      
      if (!started) return;
      
      setGhostPos({ x: ev.clientX, y: ev.clientY });

      const target = getFolderDropTarget(ev);
      if (target) {
        if (dropTargetRef.current !== target) {
          dropTargetRef.current = target;
          setDropTarget(target);

          if (!expandedFolders.has(target)) {
            if (!expandTimerRef.current) {
              expandTimerRef.current = setTimeout(() => {
                toggleFolderExpanded(target);
              }, 400);
            }
          }
        }
        return;
      }

      const elements = document.elementsFromPoint(ev.clientX, ev.clientY);
      const isOverContextMenu = elements.some(el => el.getAttribute?.("data-slot")?.startsWith("context-menu"));
      if (isOverContextMenu) {
        if (dropTargetRef.current !== null) {
          dropTargetRef.current = null;
          setDropTarget(null);
          clearExpandTimer();
        }
        return;
      }

      const rd = document.getElementById("root-drop");
      const rdRect = rd?.getBoundingClientRect();
      if (rdRect && ev.clientX >= rdRect.left && ev.clientX <= rdRect.right && ev.clientY >= rdRect.top && ev.clientY <= rdRect.bottom) {
        if (dropTargetRef.current !== "__root__") {
          dropTargetRef.current = "__root__";
          setDropTarget("__root__");
        }
        return;
      }

      if (dropTargetRef.current !== null && dropTargetRef.current !== "__root__") {
        dropTargetRef.current = null;
        setDropTarget(null);
        clearExpandTimer();
      }
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      clearExpandTimer();

      const target = dropTargetRef.current;
      
      if (started && dragRef.current && target) {
        const fromPath = dragRef.current.id;
        let toPath: string;

        if (target === "__root__") {
          const fileName = fromPath.split("/").pop()!;
          toPath = fileName;
        } else {
          toPath = `${target}/${fromPath.split("/").pop()}`;
        }

        if (fromPath !== toPath) {
          moveEntry(fromPath, toPath);
        }
      }

      dragRef.current = null;
      dropTargetRef.current = null;
      lastMouseRef.current = null;
      setDragState(null);
      setDropTarget(null);
      setGhostPos(null);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [moveEntry, getFolderDropTarget, clearExpandTimer, expandedFolders, toggleFolderExpanded]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-2 pl-4 py-2 shrink-0">
        <span className="text-xs font-bold text-foreground uppercase tracking-widest">
          Notes
        </span>
        <div className="flex items-center gap-0.5">
          {!isVaultsLoading && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all cursor-pointer"
                    onClick={() => openCreateFolder()}
                  >
                    <Folder className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>New folder</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all cursor-pointer"
                    onClick={() => createNote()}
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>New note</p>
                </TooltipContent>
              </Tooltip>
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
          <>
            <div className="flex flex-col gap-0.5">
              {sortedEntries.map((entry) => (
                <FileTreeNode
                  key={entry.path}
                  entry={entry}
                  isDraggingId={dragState?.id ?? null}
                  dropTarget={dropTarget}
                  onMouseDown={handleMouseDown}
                />
              ))}
            </div>

            {dragState && (
              <div
                id="root-drop"
                className={cn(
                  "min-h-[32px] rounded-md transition-all duration-150 mt-1 flex items-center justify-center",
                  dropTarget === "__root__" 
                    ? "bg-primary/10 ring-2 ring-primary/50" 
                    : "bg-transparent"
                )}
                style={{
                  border: dropTarget === "__root__" 
                    ? "1px dashed hsl(var(--primary))"
                    : "1px dashed transparent",
                }}
              >
                <span className={cn(
                  "text-xs",
                  dropTarget === "__root__" ? "text-primary" : "text-muted-foreground"
                )}>
                  {dragState ? "Move to root level" : ""}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      <DragGhost
        label={dragState?.name ?? ""}
        type={dragState?.type ?? "note"}
        pos={ghostPos}
      />
    </div>
  );
}
