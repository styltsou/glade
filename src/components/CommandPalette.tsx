import {
  FolderCog as FolderCogIcon,
  Palette as PaletteIcon,
  Plus as PlusIcon,
  FolderPlus as FolderPlusIcon,
  Trash2 as TrashIcon,
  Upload as UploadIcon,
  BookOpen as BookOpenIcon,
  Copy as CopyIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommandShortcuts } from "@/hooks/useCommandShortcuts";
import { flattenNotes } from "@/lib/notes";
import { useStore } from "@/store";
import type { NoteData, NoteSearchResult } from "@/types";
import { HighlightedText } from "./command-palette/HighlightedText";
import { cn } from "@/lib/utils";

type CommandPaletteNote = NoteSearchResult | NoteData;

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

  const handleSelectAction = useCallback(
    (action: string) => {
      setOpen(false);
      setSearchValue("");
      clearSearch();

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
      clearSearch,
      toggleToc,
    ],
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      const query = searchValue.trim();
      if (query.length >= 3) {
        searchNotes(query);
      } else {
        clearSearch();
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchValue, searchNotes, clearSearch]);

  const allNotes = useMemo(() => {
    if (!entries) return [];
    return flattenNotes(entries).slice(0, 100);
  }, [entries]);

  // Combined and filtered items
  const { actions, notes, visibleItems } = useMemo(() => {
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

    const filteredActions = s
      ? allActionItems.filter((item) => item.title.toLowerCase().includes(s))
      : allActionItems;

    const notesToSearch = searchResults.length > 0 ? searchResults : allNotes;
    const filteredNotes: NoteItem[] = notesToSearch
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
      actions: filteredActions,
      notes: filteredNotes,
      visibleItems: [...filteredActions, ...filteredNotes],
    };
  }, [searchValue, activeNote, currentFolder, allNotes, searchResults]);

  // Reset selectedIndex on search change or list change
  useEffect(() => {
    setSelectedIndex(0);
  }, [visibleItems.length, searchValue]);

  // Handle navigation
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
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
    [visibleItems, selectedIndex, handleSelectAction],
  );

  // Scroll active item into view
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const activeElement = scrollContainerRef.current.querySelector(
      `[data-active="true"]`,
    ) as HTMLElement;
    if (activeElement) {
      activeElement.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [selectedIndex]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      showCloseButton={false}
      className="max-w-lg"
    >
      <CommandInput
        placeholder="Type a command or search…"
        value={searchValue}
        onValueChange={setSearchValue}
        onKeyDown={onKeyDown}
      />
      <CommandList ref={scrollContainerRef} className="[&::-webkit-scrollbar]:hidden">
        {visibleItems.length === 0 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </div>
        )}

        {actions.length > 0 && (
          <div className="px-2 py-3">
            <h3 className="px-3 mb-2 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              Actions
            </h3>
            <div className="flex flex-col">
              {actions.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  active={selectedIndex === index}
                  onClick={() => handleSelectAction(item.action)}
                />
              ))}
            </div>
          </div>
        )}

        {actions.length > 0 && notes.length > 0 && <CommandSeparator />}

        {notes.length > 0 && (
          <div className="px-2 py-3">
            <h3 className="px-3 mb-2 text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wider">
              {searchResults.length > 0 ? "Search Results" : "Notes"}
            </h3>
            <div className="flex flex-col">
              {notes.map((item, index) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  searchValue={searchValue}
                  active={selectedIndex === index + actions.length}
                  onClick={() => handleSelectAction(item.action)}
                />
              ))}
            </div>
          </div>
        )}
      </CommandList>
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
      data-active={active}
      onClick={onClick}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-hidden select-none transition-colors",
        "hover:bg-accent/50",
        "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4 [&_svg]:text-muted-foreground",
        active && "[&_svg]:text-accent-foreground/70"
      )}
    >
      {item.icon ? (
        <span className="flex items-center justify-center w-4 h-4">
          {item.icon}
        </span>
      ) : (
        <span className="flex items-center justify-center w-4 h-4 text-muted-foreground/40 text-[10px] font-bold">
          #
        </span>
      )}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="truncate shrink-0 font-medium">
            {searchValue ? (
              <HighlightedText text={item.title} query={searchValue} />
            ) : (
              item.title
            )}
          </span>
          {item.type === "note" && item.tags.length > 0 && (
            <div className="flex gap-1 overflow-hidden">
              {item.tags.filter(t => t.toLowerCase().includes((searchValue || "").toLowerCase())).map((tag: string) => (
                <span
                  key={tag}
                  className="px-1 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-medium leading-none whitespace-nowrap"
                >
                  #
                  {searchValue ? (
                    <HighlightedText text={tag} query={searchValue} />
                  ) : (
                    tag
                  )}
                </span>
              ))}
            </div>
          )}
        </div>
        {item.type === "note" && item.preview && (
          <span className="text-muted-foreground/80 text-[11px] truncate leading-tight">
            {searchValue ? (
              <HighlightedText text={item.preview} query={searchValue} />
            ) : (
              item.preview
            )}
          </span>
        )}
      </div>
      {item.shortcut && (
        <CommandShortcut className="opacity-60">{item.shortcut}</CommandShortcut>
      )}
      {item.type === "note" && item.note.path.includes("/") && (
        <span className="text-muted-foreground/60 text-[10px] ml-auto shrink-0 font-medium">
          {item.note.path.split("/").slice(0, -1).join("/")}
        </span>
      )}
    </div>
  );
}
