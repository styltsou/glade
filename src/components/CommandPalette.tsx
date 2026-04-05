import {
  FolderCog as FolderCogIcon,
  Palette as PaletteIcon,
  Plus as PlusIcon,
  FolderPlus as FolderPlusIcon,
  Trash2 as TrashIcon,
  Upload as UploadIcon,
  BookOpen as BookOpenIcon,
  Copy as CopyIcon,
  Search as SearchIcon,
} from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import {
  CommandDialog,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommandShortcuts } from "@/hooks/useCommandShortcuts";
import { flattenNotes } from "@/lib/notes";
import { useStore } from "@/store";
import type { NoteData, NoteSearchResult } from "@/types";
import { HighlightedText } from "./command-palette/HighlightedText";
import { cn } from "@/lib/utils";

type CommandPaletteNote = NoteSearchResult | NoteData;

type PaletteMode = "notes" | "actions";

interface BaseItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  shortcut?: string;
  type: "action" | "note";
  action: string;
}

interface ActionItem extends BaseItem {
  type: "action";
}

interface NoteItem extends BaseItem {
  type: "note";
  note: CommandPaletteNote;
  preview?: string;
  tags: string[];
}

type PaletteItem = ActionItem | NoteItem;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<PaletteMode>("notes");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const entries = useStore((state) => state.entries);
  const activeNote = useStore((state) => state.activeNote);
  const selectNote = useStore((state) => state.selectNote);
  const createNote = useStore((state) => state.createNote);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const currentFolder = useStore((state) => state.currentFolder);
  const searchNotes = useStore((state) => state.searchNotes);
  const searchResults = useStore((state) => state.searchResults);
  const clearSearch = useStore((state) => state.clearSearch);

  const openDelete = useStore((state) => state.openDelete);
  const openSettingsPage = useStore((state) => state.openSettingsPage);
  const openImport = useStore((state) => state.openImport);
  const toggleToc = useStore((state) => state.toggleToc);

  // Register global shortcuts
  useCommandShortcuts(setOpen);

  // Reset state when palette closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setSearchValue("");
        setMode("notes");
        setSelectedIndex(0);
        clearSearch();
      }
    },
    [clearSearch],
  );

  const handleSelectAction = useCallback(
    (action: string) => {
      handleOpenChange(false);

      switch (action) {
        case "new-note":
          createNote(currentFolder || undefined);
          break;
        case "new-folder":
          openCreateFolder(currentFolder || undefined);
          break;
        case "duplicate-note":
          if (activeNote) {
            duplicateNote(activeNote.path);
          }
          break;
        case "delete-note":
          if (activeNote) {
            openDelete(activeNote.path, activeNote.title);
          }
          break;
        case "delete-folder":
          if (currentFolder) {
            const folderName = currentFolder.split("/").pop() || currentFolder;
            openDelete(currentFolder, folderName, true);
          }
          break;
        case "toggle-toc":
          if (activeNote) {
            toggleToc(activeNote.path);
          }
          break;
        case "manage-vaults":
          openSettingsPage("vaults");
          break;
        case "appearance":
          openSettingsPage("appearance");
          break;
        case "import-files":
          openImport();
          break;
        default:
          if (action.startsWith("note:")) {
            selectNote(action.slice(5));
          }
          break;
      }
    },
    [
      activeNote,
      createNote,
      duplicateNote,
      openCreateFolder,
      currentFolder,
      openDelete,
      openSettingsPage,
      openImport,
      selectNote,
      handleOpenChange,
      toggleToc,
    ],
  );

  // Debounced search — only search notes in notes mode
  useEffect(() => {
    if (mode !== "notes") return;
    const timer = setTimeout(() => {
      const query = searchValue.trim();
      if (query.length >= 3) {
        searchNotes(query);
      } else {
        clearSearch();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchValue, searchNotes, clearSearch, mode]);

  const allNotes = useMemo(() => {
    if (!entries) return [];
    return flattenNotes(entries).slice(0, 100);
  }, [entries]);

  // Build filtered action and note lists separately
  const { filteredActions, filteredNotes } = useMemo(() => {
    const s = searchValue.toLowerCase().trim();

    const allActionItems: ActionItem[] = [
      {
        id: "new-folder",
        title: "Create New Folder",
        icon: <FolderPlusIcon />,
        shortcut: "⌘F",
        type: "action",
        action: "new-folder",
        hidden: !!activeNote,
      },
      {
        id: "new-note",
        title: "Create New Note",
        icon: <PlusIcon />,
        shortcut: "⌘N",
        type: "action",
        action: "new-note",
      },
      {
        id: "duplicate-note",
        title: "Duplicate Current Note",
        icon: <CopyIcon />,
        type: "action",
        action: "duplicate-note",
        hidden: !activeNote,
      },
      {
        id: "delete-note",
        title: "Delete Current Note",
        icon: <TrashIcon />,
        shortcut: "⌘D",
        type: "action",
        action: "delete-note",
        hidden: !activeNote,
      },
      {
        id: "delete-folder",
        title: "Delete Current Folder",
        icon: <TrashIcon />,
        shortcut: "⌘D",
        type: "action",
        action: "delete-folder",
        hidden: !!activeNote || !currentFolder,
      },
      {
        id: "manage-vaults",
        title: "Manage Vaults",
        icon: <FolderCogIcon />,
        type: "action",
        action: "manage-vaults",
      },
      {
        id: "appearance",
        title: "Appearance",
        icon: <PaletteIcon />,
        shortcut: "⌘,",
        type: "action",
        action: "appearance",
      },
      {
        id: "import-files",
        title: "Import Files",
        icon: <UploadIcon />,
        type: "action",
        action: "import-files",
      },
      {
        id: "toggle-toc",
        title: "Toggle Table of Contents",
        icon: <BookOpenIcon />,
        shortcut: "⌘⇧T",
        type: "action",
        action: "toggle-toc",
        hidden: !activeNote,
      },
    ].filter((item) => !item.hidden) as ActionItem[];

    const actions = s
      ? allActionItems.filter((item) => item.title.toLowerCase().includes(s))
      : allActionItems;

    const notesToSearch = searchResults.length > 0 ? searchResults : allNotes;
    const notes: NoteItem[] = notesToSearch
      .map((note) => ({
        id: `note:${note.path}`,
        title: note.title,
        type: "note" as const,
        action: `note:${note.path}`,
        note,
        preview: note.preview,
        tags: note.tags,
      }))
      .filter((item) => {
        if (!s) return true;
        return (
          item.title.toLowerCase().includes(s) ||
          item.preview?.toLowerCase().includes(s) ||
          item.tags.some((t) => t.toLowerCase().includes(s))
        );
      });

    return {
      filteredActions: actions,
      filteredNotes: notes,
    };
  }, [searchValue, activeNote, currentFolder, allNotes, searchResults]);

  // Derive the visible list based on current mode
  const visibleItems: PaletteItem[] = useMemo(() => {
    return mode === "actions" ? filteredActions : filteredNotes;
  }, [mode, filteredActions, filteredNotes]);

  // Reset selectedIndex on search change or list change
  useEffect(() => {
    setSelectedIndex(0);
  }, [visibleItems.length, searchValue, mode]);

  // Handle navigation and mode switching
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isEmpty = searchValue.length === 0;

      // --- Mode switching logic ---
      // Empty search + Tab in notes mode → switch to actions
      if (e.key === "Tab" && !e.shiftKey && isEmpty && mode === "notes") {
        e.preventDefault();
        setMode("actions");
        setSelectedIndex(0);
        return;
      }

      // Backspace on empty search in actions mode → back to notes
      if (e.key === "Backspace" && isEmpty && mode === "actions") {
        e.preventDefault();
        setMode("notes");
        setSelectedIndex(0);
        return;
      }

      // --- List navigation ---
      if (visibleItems.length === 0) return;

      if (e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % visibleItems.length);
      } else if (e.key === "ArrowUp" || (e.key === "Tab" && e.shiftKey)) {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + visibleItems.length) % visibleItems.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = visibleItems[selectedIndex];
        if (selected) {
          handleSelectAction(selected.action);
        }
      }
    },
    [visibleItems, selectedIndex, handleSelectAction, searchValue, mode],
  );

  // Scroll active item into view
  useLayoutEffect(() => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const selectedItem = container.querySelector(
      "[data-active='true']",
    ) as HTMLElement | null;
    if (selectedItem) {
      const containerRect = container.getBoundingClientRect();
      const itemRect = selectedItem.getBoundingClientRect();

      const relativeTop = itemRect.top - containerRect.top;
      const relativeBottom = itemRect.bottom - containerRect.top;

      if (relativeBottom > containerRect.height - 4) {
        container.scrollTop += relativeBottom - (containerRect.height - 4);
      } else if (relativeTop < 4) {
        container.scrollTop += relativeTop - 4;
      }
    }
  }, [selectedIndex]);

  const placeholder = mode === "actions" ? "Search actions…" : "Search notes…";

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      showCloseButton={false}
      className="max-w-lg"
    >
      <div
        data-slot="command-input-wrapper"
        className="flex h-12 items-center gap-2 border-b px-3"
      >
        {mode === "actions" ? (
          <span className="flex items-center shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground leading-none">
            Actions
          </span>
        ) : (
          <SearchIcon className="size-4 shrink-0 opacity-50" />
        )}
        <input
          type="text"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={onKeyDown}
          className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:hidden"
          autoFocus
        />
      </div>
      <CommandList ref={scrollContainerRef} className="[&::-webkit-scrollbar]:hidden">
        {visibleItems.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {mode === "actions" && searchValue
              ? "No actions found."
              : mode === "notes" && searchValue
                ? "No notes found."
                : mode === "actions"
                  ? "No actions available."
                  : "No notes yet."}
          </div>
        ) : (
          <div className="flex flex-col p-1.5 gap-0.5">
            {visibleItems.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                active={selectedIndex === index}
                onClick={() => handleSelectAction(item.action)}
                searchValue={searchValue}
              />
            ))}
          </div>
        )}
      </CommandList>
      {/* Hint for mode switching */}
      <div className="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground/60">
        {mode === "notes" && !searchValue ? (
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Tab</kbd> actions
          </span>
        ) : mode === "actions" && !searchValue ? (
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">⌫</kbd> back
          </span>
        ) : (
          <span>
            <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">Tab</kbd> navigate
          </span>
        )}
        <span className="flex items-center gap-2">
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↑↓</kbd> navigate
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">↵</kbd> select
        </span>
      </div>
    </CommandDialog>
  );
}

function ItemRow({
  item,
  active,
  onClick,
  searchValue,
}: {
  item: PaletteItem;
  active: boolean;
  onClick: () => void;
  searchValue?: string;
}) {
  return (
    <div
      role="option"
      aria-selected={active}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-hidden select-none",
        "text-muted-foreground",
        "hover:text-foreground hover:bg-accent/50",
        "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
      )}
    >
      {item.icon && (
        <span className="flex items-center justify-center w-4 h-4">
          {item.icon}
        </span>
      )}
      <span className="truncate font-medium min-w-0 flex-1">
        {searchValue ? (
          <HighlightedText text={item.title} query={searchValue} />
        ) : (
          item.title
        )}
      </span>
      {item.shortcut && (
        <CommandShortcut className="text-inherit opacity-60">{item.shortcut}</CommandShortcut>
      )}
      {item.type === "note" && item.note.path.includes("/") && (
        <span className="text-inherit text-[10px] ml-auto shrink-0 font-medium opacity-60">
          {item.note.path.split("/").slice(0, -1).join("/")}
        </span>
      )}
    </div>
  );
}
