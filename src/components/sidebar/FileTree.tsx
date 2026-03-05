import { useVaultStore } from "@/stores/useVaultStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import type { VaultEntry } from "@/types";
import type { SortMode } from "@/types";
import { useState } from "react";
import {
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil as PencilIcon,
  Copy as CopyIcon,
  Pin as DrawingPinFilledIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus as PlusIcon } from "lucide-react";

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

export function filterPinnedEntries(
  entries: VaultEntry[],
  pinnedPaths: Set<string>
): VaultEntry[] {
  return entries
    .map((entry) => {
      if (entry.is_dir) {
        return { ...entry, children: filterPinnedEntries(entry.children, pinnedPaths) };
      }
      return entry;
    })
    .filter((entry) => {
      if (entry.is_dir) return true;
      return !pinnedPaths.has(entry.path);
    });
}

export function countNotes(entries: VaultEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.is_dir) count += countNotes(entry.children);
    else count++;
  }
  return count;
}

// ─── FileTree (exported for use in Sidebar) ───────────────────────────────────

export function FileTree() {
  const { entries, isLoading, createNote } = useVaultStore();
  const { pinnedNotes } = useHomeStore();
  const { sort } = useSidebarStore();

  const pinnedPaths = new Set(pinnedNotes.map((n) => n.path));
  const filteredEntries = filterPinnedEntries(entries, pinnedPaths);
  const sortedEntries = sortEntries(filteredEntries, sort);

  return (
    <div className="flex-1 overflow-auto px-2 py-1">
      {!isLoading && sortedEntries.length > 0 && (
        <div className="flex items-center justify-between pb-1.5 px-2">
          <span className="text-[10px] font-bold text-foreground uppercase tracking-widest pt-[1px]">
            Notes ({countNotes(entries)})
          </span>
          <button
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all cursor-pointer"
            onClick={() => createNote()}
            title="New note"
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="px-2.5 py-4 text-[12px] text-muted-foreground text-center">
          Loading…
        </div>
      ) : sortedEntries.length === 0 ? (
        <div className="px-2.5 py-8 text-center">
          <p className="text-[12px] text-muted-foreground mb-2">No notes yet</p>
          <button
            onClick={() => createNote()}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Create your first note
          </button>
        </div>
      ) : (
        <div className="space-y-0.5">
          {sortedEntries.map((entry) => (
            <FileTreeNode key={entry.path} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Search results panel (used by Sidebar when search is active) ─────────────

export function SearchResultsList() {
  const { searchResults, activeNote, selectNote, sidebarQuery, duplicateNote } = useVaultStore();
  const { pinnedNotes, pinNote } = useHomeStore();
  const { openRename, openDelete } = useDialogStore();
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);

  if (searchResults.length === 0 && sidebarQuery.trim().length > 0) {
    return (
      <div className="px-2.5 py-8 text-center text-[12px] text-muted-foreground">
        No matching notes found
      </div>
    );
  }

  const pinnedPaths = new Set(pinnedNotes.map((n) => n.path));

  return (
    <div className="space-y-0.5 px-2 py-1 border-t border-border/40">
      {searchResults.map((note) => {
        const isPinned = pinnedPaths.has(note.path);
        const isActive = activeNote?.path === note.path;
        const isMenuOpen = menuOpenPath === note.path;

        // Extract folder path (e.g., "Work/Projects/Note.md" -> "Work/Projects")
        const pathParts = note.path.split("/");
        const folderPath = pathParts.slice(0, -1).join("/");

        return (
          <div key={note.path} className="relative group">
            <button
              onClick={() => selectNote(note.path)}
              className={`flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-[13px] text-left transition-all cursor-pointer font-medium ${
                isActive || isMenuOpen
                  ? "bg-sidebar-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
              }`}
            >
                {folderPath && (
                  <div className="flex items-center gap-1 mb-0.5 opacity-60">
                    <Folder className="h-2.5 w-2.5 shrink-0" />
                    <span className="text-[10px] font-normal truncate">
                      {folderPath}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  {isPinned && (
                    <DrawingPinFilledIcon className="h-3.5 w-3.5 shrink-0 text-primary rotate-45" />
                  )}
                  <span className="truncate">
                    <Highlight text={note.title} query={sidebarQuery} />
                  </span>
                </div>
              </div>
            </button>

            <DropdownMenu onOpenChange={(open) => setMenuOpenPath(open ? note.path : null)}>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-foreground/70 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent hover:bg-muted transition-all z-10">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRename(note.path, note.title); }}>
                  <PencilIcon className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateNote(note.path); }}>
                  <CopyIcon className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); pinNote(note.path); }}>
                  <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
                  {isPinned ? "Unpin note" : "Pin note"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={(e) => { e.stopPropagation(); openDelete(note.path, note.title); }}
                >
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
            className="bg-primary/20 text-primary px-[1px] rounded-[2px] font-medium"
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
  const { activeNote, selectNote, duplicateNote } = useVaultStore();
  const { pinNote } = useHomeStore();
  const { sort } = useSidebarStore();
  const { openRename, openDelete } = useDialogStore();

  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  if (entry.is_dir) {
    const children = sortEntries(entry.children, sort);
    if (children.length === 0) return null;

    return (
      <div>
        {/* Header row — group scoped to just this row */}
        <div className="relative group/folder">
          <button
            onClick={() => setExpanded((e) => !e)}
            className={`flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors cursor-pointer ${
              menuOpen
                ? "bg-sidebar-accent text-foreground"
                : "text-foreground hover:bg-sidebar-accent hover:text-foreground"
            }`}
          >
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate pr-1">{entry.name}</span>
          </button>

          <DropdownMenu onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer absolute right-1 top-1.5 p-0.5 rounded-sm text-foreground/70 opacity-0 group-hover/folder:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent hover:bg-muted transition-all z-10">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => { e.stopPropagation(); openDelete(entry.path, entry.name, true); }}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Children rendered inside a margin-left container which doubles as the indent line base */}
        {expanded && (
          <div className="ml-3.5 pl-2 relative">
            {/* Indent guide line — absolutely positioned to not take space, drawn down the left edge */}
            <div className="absolute top-0 bottom-0 left-0 w-[1px] bg-border/80" />
            
            <div className="flex flex-col gap-0.5">
              {children.map((child) => (
                <FileTreeNode key={child.path} entry={child} />
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const isActive = activeNote?.path === entry.path;

  return (
    <div className="relative group/note">
      <button
        onClick={() => selectNote(entry.path)}
        className={`flex items-center w-full rounded-md py-1.5 px-2 text-[13px] text-left transition-colors cursor-pointer font-medium ${
          isActive || menuOpen
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        }`}
      >
        <span className="truncate pr-1">{entry.name}</span>
      </button>

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-foreground/70 opacity-0 group-hover/note:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent hover:bg-muted transition-all z-10">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRename(entry.path, entry.name); }}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateNote(entry.path); }}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); pinNote(entry.path); }}>
            <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
            Pin note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={(e) => { e.stopPropagation(); openDelete(entry.path, entry.name); }}
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
