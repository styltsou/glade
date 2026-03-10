import { useStore } from "@/store";
import type { SortMode, VaultEntry } from "@/types";
import type { NoteCard, NoteData } from "@/types";
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
  const pinnedNotes = useStore((state) => state.pinnedNotes);
  const sidebarSort = useStore((state) => state.sidebarSort);
  const activeTagFilters = useStore((state) => state.activeTagFilters);

  const pinnedPaths = new Set<string>(pinnedNotes.map((n: NoteCard) => n.path));
  const filteredByPinned = filterPinnedEntries(entries, pinnedPaths);
  const filteredByTags = filterByTags(filteredByPinned, activeTagFilters);
  const sortedEntries = sortEntries(filteredByTags, sidebarSort);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {!isVaultLoading && sortedEntries.length > 0 && (
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
          <p className="text-xs text-muted-foreground mb-2">No notes yet</p>
          <button
            onClick={() => createNote()}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
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
    </div>
  );
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

  const pinnedPaths = new Set<string>(pinnedNotes.map((n: NoteCard) => n.path));

  return (
    <div className="space-y-0.5 px-2 py-1 border-t border-border/40">
      {searchResults.map((note: NoteData) => {
        const isPinned = pinnedPaths.has(note.path);
        const isActive = activeNotePath === note.path;

        // Extract folder path (e.g., "Work/Projects/Note.md" -> "Work/Projects")
        const pathParts = note.path.split("/");
        const folderPath = pathParts.slice(0, -1).join("/");

        return (
          <div key={note.path} className="relative group/note">
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
                <div className="flex items-center gap-1.5">
                  {isPinned && (
                    <DrawingPinFilledIcon className="h-3.5 w-3.5 shrink-0 text-primary rotate-45" />
                  )}
                <span className="truncate pr-8">
                  <Highlight text={note.title} query={sidebarQuery} />
                </span>
                </div>
              </div>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="cursor-pointer absolute right-0 top-0 bottom-0 w-7 px-2 flex items-center justify-center rounded-sm text-foreground/70 opacity-0 group-hover/btn:opacity-100 data-[state=open]:opacity-100 hover:text-foreground group-hover/btn:bg-sidebar-accent data-[state=open]:bg-sidebar-accent transition-colors z-10">
                  <MoreHorizontal className="h-4 w-4" strokeWidth={3} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={2}>
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

  const [expanded, setExpanded] = useState(true);
  const [, setMenuOpen] = useState(false);

  if (entry.is_dir) {
    const children = sortEntries(entry.children, sidebarSort);

    return (
      <div>
        {/* Header row — group scoped to just this row */}
        <div className="relative group/folder">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm font-medium transition-colors cursor-pointer text-foreground hover:bg-sidebar-accent"
          >
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 shrink-0" />
            )}
            <span className="truncate pr-8">{entry.name}</span>
          </button>

          <DropdownMenu onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer absolute right-0 top-0 bottom-0 w-7 px-2 flex items-center justify-center rounded-sm text-foreground/70 opacity-0 group-hover/folder:opacity-100 data-[state=open]:opacity-100 hover:text-foreground group-hover/folder:bg-sidebar-accent data-[state=open]:bg-sidebar-accent transition-colors z-10">
                <MoreHorizontal className="h-4 w-4" strokeWidth={3} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={2}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); createNote(entry.path); }}>
                <PlusIcon className="mr-2 h-4 w-4" />
                New note
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openCreateFolder(entry.path); }}>
                <Folder className="mr-2 h-4 w-4" />
                New folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRename(entry.path, entry.name, true); }}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Rename folder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
          <div className="ml-[15px] pl-2 relative">
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

  const isActive = activeNotePath === entry.path;

  return (
    <div className="relative group/note">
      <button
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

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer absolute right-0 top-0 bottom-0 w-7 px-2 flex items-center justify-center rounded-sm text-foreground/70 opacity-0 group-hover/note:opacity-100 data-[state=open]:opacity-100 hover:text-foreground group-hover/note:bg-sidebar-accent active:bg-sidebar-accent data-[state=open]:bg-sidebar-accent transition-colors z-10">
            <MoreHorizontal className="h-4 w-4" strokeWidth={3} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={2}>
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
