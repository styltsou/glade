import { useEffect, useState } from "react";
import {
  Plus as PlusIcon,
  Search as MagnifyingGlassIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Type as LetterCaseCapitalizeIcon,
  Clock as ClockIcon,
  Pin as DrawingPinFilledIcon,
  ChevronDown as ChevronDownIcon,
  FileText as FileTextIcon,
  Trash2 as TrashIcon,
  MoreHorizontal,
  Pencil as PencilIcon,
  Copy as CopyIcon,
  PinOff as PinOffIcon,
} from "lucide-react";
import { useVaultStore } from "@/stores/useVaultStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { VaultEntry, NoteData } from "@/types";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

// ─── Sort label helpers ───────────────────────────────────────────────────────

const SORT_LABELS = {
  "name-asc": "A → Z",
  "name-desc": "Z → A",
  modified: "Recent",
} as const;

// ─── Main Sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const {
    entries,
    activeNote,
    isLoading,
    loadVault,
    selectNote,
    createNote,
    deleteEntry,
    tags,
    loadTags,
    activeTagFilters,
    toggleTagFilter,
    clearTagFilters,
    searchNotes,
    searchResults,
    goHome,
  } = useVaultStore();
  const { pinnedNotes, loadAll: loadHome, unpinNote } = useHomeStore();
  const { collapsed, sort, loadState, toggleCollapsed, cycleSort } =
    useSidebarStore();

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      searchNotes(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, searchNotes]);

  useEffect(() => {
    loadVault();
    loadTags();
    loadState();
    loadHome();
  }, [loadVault, loadTags, loadState, loadHome]);

  // Keyboard shortcut Ctrl+B
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleCollapsed]);

  // Filter out pinned notes from the main list
  const pinnedPaths = new Set(pinnedNotes.map((n) => n.path));
  const filteredEntries = filterPinnedEntries(entries, pinnedPaths);
  const sortedEntries = sortEntries(filteredEntries, sort);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 0 : 260 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="sidebar flex flex-col h-full bg-sidebar select-none overflow-hidden shrink-0 border-r border-border"
      aria-hidden={collapsed}
    >
      <div className="w-[260px] flex flex-col h-full">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-2 pt-3 pb-1 shrink-0">
          <button
            onClick={goHome}
            className="px-2 py-1 text-[13px] font-semibold text-foreground hover:opacity-70 transition-opacity cursor-pointer active:scale-95"
          >
            Glade
          </button>
          <div className="flex items-center gap-0.5">
            <button
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all"
              onClick={toggleCollapsed}
              title="Collapse sidebar (Ctrl+B)"
            >
              <ChevronLeftIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* ── Search Bar ─────────────────────────────────────────────────── */}
        <div className="px-2 py-2 shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[13px] bg-sidebar-accent/50 border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </div>
        </div>

        {/* ── Pinned section ─────────────────────────────────────────────── */}
        {pinnedNotes.length > 0 && (
          <div className="px-2 py-1 shrink-0">
            <div className="pb-1.5 flex items-center">
              <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest pt-[1px]">
                Pinned
              </span>
            </div>
            <div className="space-y-0.5">
              {pinnedNotes.map((note) => (
                <PinnedItem
                  key={note.path}
                  name={note.title}
                  path={note.path}
                  active={activeNote?.path === note.path}
                  onClick={() => selectNote(note.path)}
                  onUnpin={() => unpinNote(note.path)}
                />
              ))}
            </div>
            <div className="mt-2 mb-1 border-t border-border" />
          </div>
        )}

        {/* ── File tree ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto px-2 py-1">
          {!isLoading && !searchQuery && sortedEntries.length > 0 && (
            <div className="flex items-center justify-between pb-1.5">
              <div className="flex items-center">
                <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest pt-[1px]">
                  Notes ({countNotes(entries)})
                </span>
              </div>
              <button
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all"
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
          ) : searchQuery ? (
            searchResults.length === 0 ? (
              <div className="px-2.5 py-8 text-center text-[12px] text-muted-foreground">
                No matching notes found
              </div>
            ) : (
              <div className="space-y-0.5">
                {searchResults.map((note) => (
                  <SearchResultItem
                    key={note.path}
                    note={note}
                    active={activeNote?.path === note.path}
                    onClick={() => selectNote(note.path)}
                  />
                ))}
              </div>
            )
          ) : sortedEntries.length === 0 ? (
            <div className="px-2.5 py-8 text-center">
              <p className="text-[12px] text-muted-foreground mb-2">
                No notes yet
              </p>
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
                <FileTreeNode
                  key={entry.path}
                  entry={entry}
                  activeNotePath={activeNote?.path ?? null}
                  onSelectNote={selectNote}
                  onDeleteEntry={deleteEntry}
                  sort={sort}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Tags panel ─────────────────────────────────────────────────── */}
        <div className="shrink-0 overflow-auto border-t border-border px-2 py-3">
          <div className="flex items-center justify-between pb-2">
            <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">
              Tags
            </span>
            {activeTagFilters.length > 0 && (
              <button
                onClick={clearTagFilters}
                className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-0.5">
            {tags.length === 0 ? (
              <div className="px-2.5 py-1 text-[12px] text-muted-foreground italic">
                No tags yet
              </div>
            ) : (
              tags.map((tag) => (
                <button
                  key={tag.name}
                  onClick={() => toggleTagFilter(tag.name)}
                  className={`group flex items-center justify-between w-full rounded-md pr-2 pl-2 py-[5.5px] text-[13px] transition-all cursor-default ${
                    activeTagFilters.includes(tag.name)
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <span className="truncate flex items-center gap-2">
                    <span className="text-muted-foreground/60">#</span>
                    {tag.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70 tabular-nums group-hover:text-foreground transition-colors">
                    {tag.count}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Footer: sort ───────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border px-2 py-2">
          <div className="flex items-center justify-between w-full pr-0.5">
            <button
              onClick={cycleSort}
              className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground transition-colors cursor-default"
              title="Cycle sort order"
            >
              {sort === "modified" ? (
                <ClockIcon className="h-3 w-3" />
              ) : (
                <LetterCaseCapitalizeIcon className="h-3 w-3" />
              )}
              <span className="pt-[0.5px] uppercase tracking-wider text-[10px] font-bold">{SORT_LABELS[sort]}</span>
            </button>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

// ─── Collapse toggle shown when sidebar is collapsed ─────────────────────────

export function SidebarCollapseToggle() {
  const { collapsed, toggleCollapsed } = useSidebarStore();
  if (!collapsed) return null;
  return (
    <button
      onClick={toggleCollapsed}
      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-r-lg bg-sidebar border border-border border-l-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all"
      title="Expand sidebar (Ctrl+B)"
    >
      <ChevronRightIcon className="h-3.5 w-3.5" />
    </button>
  );
}

// ─── Pinned item in sidebar pinned section ───────────────────────────────────

function PinnedItem({
  name,
  path,
  active,
  onClick,
  onUnpin,
}: {
  name: string;
  path: string;
  active: boolean;
  onClick: () => void;
  onUnpin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const { renameNote, duplicateNote, deleteEntry } = useVaultStore();

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`flex items-center w-full rounded-md pr-2 pl-2 py-1.5 text-[13px] text-left transition-all cursor-default ${
          active || menuOpen
            ? "bg-sidebar-accent text-foreground font-medium"
            : "text-muted-foreground group-hover:text-foreground group-hover:bg-sidebar-accent"
        }`}
      >
        <span className="truncate pr-6">{name}</span>
      </button>
      
      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent transition-all">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsRenameOpen(true); }}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateNote(path); }}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnpin(); }}>
            <PinOffIcon className="mr-2 h-4 w-4" />
            Unpin note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); setIsDeleteOpen(true); }}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        name={name}
        onConfirm={() => { deleteEntry(path); setIsDeleteOpen(false); }}
      />

      <RenameDialog
        isOpen={isRenameOpen}
        onOpenChange={setIsRenameOpen}
        initialTitle={name}
        onRename={(newTitle) => renameNote(path, newTitle)}
      />
    </div>
  );
}

// ─── Search result item ───────────────────────────────────────────────────────

function SearchResultItem({
  note,
  active,
  onClick,
}: {
  note: NoteData;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex items-center w-full rounded-md pr-2 pl-2 py-1.5 text-[13px] text-left transition-all cursor-default ${
        active
          ? "bg-sidebar-accent text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
      }`}
    >
      <span className="truncate">{note.title}</span>
    </button>
  );
}

// ─── File tree node (recursive) ───────────────────────────────────────────────

function FileTreeNode({
  entry,
  activeNotePath,
  onSelectNote,
  onDeleteEntry,
  depth = 0,
  sort,
}: {
  entry: VaultEntry;
  activeNotePath: string | null;
  onSelectNote: (path: string) => void;
  onDeleteEntry: (path: string) => void;
  depth?: number;
  sort: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);

  const { renameNote, duplicateNote } = useVaultStore();
  const { pinNote } = useHomeStore();

  if (entry.is_dir) {
    const children = sortEntries(entry.children, sort as "name-asc" | "name-desc" | "modified");
    if (children.length === 0) return null; // Hide empty folders (that might be empty because of pinning)

    return (
      <div className="relative group">
        <button
          onClick={() => setExpanded((e) => !e)}
          className={`flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-[12px] font-medium transition-all cursor-default ${
            menuOpen
              ? "bg-sidebar-accent text-foreground"
              : "text-muted-foreground group-hover:text-foreground group-hover:bg-sidebar-accent"
          }`}
          style={{ paddingLeft: `${8 + depth * 14}px` }}
        >
          <ChevronDownIcon
            className={`h-3 w-3 shrink-0 transition-transform ${
              expanded ? "" : "-rotate-90"
            }`}
          />
          <span className="truncate pr-6">{entry.name}</span>
        </button>
        
        <DropdownMenu onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer absolute right-1 top-1.5 p-0.5 rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent transition-all">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); setPendingDelete(entry.path); }}>
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {expanded && (
          <div>
            {children.map((child) => (
              <FileTreeNode
                key={child.path}
                entry={child}
                activeNotePath={activeNotePath}
                onSelectNote={onSelectNote}
                onDeleteEntry={onDeleteEntry}
                depth={depth + 1}
                sort={sort}
              />
            ))}
          </div>
        )}
        
        <DeleteConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
          name={entry.name}
          isFolder
          onConfirm={() => { if (pendingDelete) { onDeleteEntry(pendingDelete); setPendingDelete(null); } }}
        />
      </div>
    );
  }

  const isActive = activeNotePath === entry.path;
  return (
    <div className="relative group">
      <button
        onClick={() => onSelectNote(entry.path)}
        className={`flex items-center w-full rounded-md py-1.5 text-[13px] text-left transition-all cursor-default ${
          isActive || menuOpen
            ? "bg-sidebar-accent text-foreground font-medium"
            : "text-muted-foreground group-hover:text-foreground group-hover:bg-sidebar-accent"
        }`}
        style={{ paddingLeft: `${8 + depth * 14}px`, paddingRight: "8px" }}
      >
        <span className="truncate pr-6">{entry.name}</span>
      </button>

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent transition-all">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsRenameOpen(true); }}>
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
          <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); setPendingDelete(entry.path); }}>
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null); }}
        name={entry.name}
        onConfirm={() => { if (pendingDelete) { onDeleteEntry(pendingDelete); setPendingDelete(null); } }}
      />

      <RenameDialog
        isOpen={isRenameOpen}
        onOpenChange={setIsRenameOpen}
        initialTitle={entry.name}
        onRename={(newTitle) => renameNote(entry.path, newTitle)}
      />
    </div>
  );
}


// ─── Sorting & Filtering helpers ─────────────────────────────────────────────

function filterPinnedEntries(entries: VaultEntry[], pinnedPaths: Set<string>): VaultEntry[] {
  return entries
    .map((entry) => {
      if (entry.is_dir) {
        return {
          ...entry,
          children: filterPinnedEntries(entry.children, pinnedPaths),
        };
      }
      return entry;
    })
    .filter((entry) => {
      if (entry.is_dir) {
        // If it's a directory, we keep it for now (recursion handles children)
        // We'll hide empty folders in the component rendering logic
        return true;
      }
      return !pinnedPaths.has(entry.path);
    });
}

function sortEntries(
  entries: VaultEntry[],
  sort: "name-asc" | "name-desc" | "modified"
): VaultEntry[] {
  const copy = [...entries];
  if (sort === "name-asc") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "name-desc") {
    return copy.sort((a, b) => b.name.localeCompare(a.name));
  }
  // modified: newest first; directories always come first
  return copy.sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    if (!a.modified || !b.modified) return 0;
    return new Date(b.modified).getTime() - new Date(a.modified).getTime();
  });
}

function countNotes(entries: VaultEntry[]): number {
  let count = 0;
  for (const entry of entries) {
    if (entry.is_dir) {
      count += countNotes(entry.children);
    } else {
      count++;
    }
  }
  return count;
}
