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
  Sidebar as SidebarIcon,
  Sun as SunIcon,
  Pencil as PencilIcon,
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type InteractionMethod = "click" | "enter" | "keybind";

interface PendingConfirmation {
  actionId: "delete-note" | "delete-folder";
  method: InteractionMethod;
  keybind?: string;
}

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
  const [pendingDeleteConfirmation, setPendingDeleteConfirmation] = useState<PendingConfirmation | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

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

  const openSettingsPage = useStore((state) => state.openSettingsPage);
  const openImport = useStore((state) => state.openImport);
  const toggleToc = useStore((state) => state.toggleToc);
  const toggleSidebarCollapsed = useStore((state) => state.toggleSidebarCollapsed);
  const toggleAppearance = useStore((state) => state.toggleAppearance);
  const setNoteEditMode = useStore((state) => state.setNoteEditMode);
  const noteEditMode = useStore((state) => state.noteEditMode);
  const toggleRawModeFromStore = useStore((state) => state.toggleRawMode);

  // Register global shortcuts
  useCommandShortcuts(setOpen, openRef, (action) => {
    handleSelectAction(action, "keyboard");
  });

  const deleteEntry = useStore((state) => state.deleteEntry);

  // Reset state when palette closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        setSearchValue("");
        setMode("notes");
        setSelectedIndex(0);
        clearSearch();
        setPendingDeleteConfirmation(null);
      }
    },
    [clearSearch],
  );

  const handleSelectAction = useCallback(
    (action: string, source: "click" | "keyboard" = "click") => {
      // Map source to interaction method
      const method: InteractionMethod = source === "click" ? "click" : "enter";

      // Handle delete actions with inline confirmation
      if (action === "delete-note" || action === "delete-folder") {
        const pending = pendingDeleteConfirmation;

        // Check if we should confirm based on method
        let shouldConfirm = false;
        if (pending && pending.actionId === action) {
          // Click confirms if pending was triggered by click
          if (source === "click" && pending.method === "click") {
            shouldConfirm = true;
          }
          // Keyboard (Enter or Ctrl+D) confirms if pending was triggered by keyboard
          if (source === "keyboard" && (pending.method === "enter" || pending.method === "keybind")) {
            shouldConfirm = true;
          }
        }

        if (shouldConfirm) {
          handleOpenChange(false);
          if (action === "delete-note" && activeNote) {
            deleteEntry(activeNote.path);
            toast.success(`Deleted ${activeNote.title}`, {
              duration: 5000,
            });
          } else if (action === "delete-folder" && currentFolder) {
            const folderName = currentFolder.split("/").pop() || currentFolder;
            deleteEntry(currentFolder);
            toast.success(`Deleted ${folderName}`, {
              duration: 5000,
            });
          }
          setPendingDeleteConfirmation(null);
          return;
        }

        // Otherwise set/update pending confirmation
        setPendingDeleteConfirmation({
          actionId: action,
          method: method,
          keybind: source === "keyboard" ? "⌘D" : undefined,
        });
        return;
      }

      // Non-delete actions: execute directly
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
        case "toggle-toc":
          if (activeNote) {
            toggleToc(activeNote.path);
          }
          break;
        case "toggle-sidebar":
          toggleSidebarCollapsed();
          break;
        case "manage-vaults":
          openSettingsPage("vaults");
          break;
        case "appearance":
          openSettingsPage("appearance");
          break;
        case "toggle-appearance":
          toggleAppearance();
          break;
        case "import-files":
          openImport();
          break;
        case "toggle-read-edit-mode":
          if (activeNote) {
            const currentMode = noteEditMode[activeNote.path] ?? false;
            setNoteEditMode(activeNote.path, !currentMode);
          }
          break;
        case "toggle-raw-mode":
          if (activeNote) {
            toggleRawModeFromStore(activeNote.path);
          }
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
      deleteEntry,
      openSettingsPage,
      openImport,
      selectNote,
      handleOpenChange,
      toggleToc,
      toggleSidebarCollapsed,
      toggleAppearance,
      setNoteEditMode,
      noteEditMode,
      pendingDeleteConfirmation,
      toggleRawModeFromStore,
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
        id: "new-note",
        title: "Create New Note",
        icon: <PlusIcon />,
        shortcut: "⌘N",
        type: "action",
        action: "new-note",
      },
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
        id: "duplicate-note",
        title: "Duplicate Current Note",
        icon: <CopyIcon />,
        type: "action",
        action: "duplicate-note",
        hidden: !activeNote,
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
      {
        id: "toggle-read-edit-mode",
        title: "Toggle Read/Edit Mode",
        icon: <PencilIcon />,
        shortcut: "⌘E",
        type: "action",
        action: "toggle-read-edit-mode",
        hidden: !activeNote,
      },
      {
        id: "toggle-raw-mode",
        title: "Toggle Raw/Rich View",
        icon: <PencilIcon />,
        shortcut: "⌘⇧R",
        type: "action",
        action: "toggle-raw-mode",
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
        id: "import-files",
        title: "Import Files",
        icon: <UploadIcon />,
        type: "action",
        action: "import-files",
      },
      {
        id: "toggle-sidebar",
        title: "Toggle Sidebar",
        icon: <SidebarIcon />,
        shortcut: "⌘B",
        type: "action",
        action: "toggle-sidebar",
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
        title: "Switch Theme",
        icon: <PaletteIcon />,
        shortcut: "⌘,",
        type: "action",
        action: "appearance",
      },
      {
        id: "toggle-appearance",
        title: "Toggle Appearance",
        icon: <SunIcon />,
        type: "action",
        action: "toggle-appearance",
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
        setPendingDeleteConfirmation(null);
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
          handleSelectAction(selected.action, "keyboard");
        }
      } else if (e.key === "Escape") {
        if (pendingDeleteConfirmation) {
          e.preventDefault();
          setPendingDeleteConfirmation(null);
        }
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab") {
        if (pendingDeleteConfirmation) {
          setPendingDeleteConfirmation(null);
        }
      }
    },
    [visibleItems, selectedIndex, handleSelectAction, searchValue, mode, pendingDeleteConfirmation, setPendingDeleteConfirmation],
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
                onClick={() => handleSelectAction(item.action, "click")}
                searchValue={searchValue}
                pendingConfirmation={
                  pendingDeleteConfirmation?.actionId === item.action
                    ? pendingDeleteConfirmation
                    : null
                }
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
  pendingConfirmation,
}: {
  item: PaletteItem;
  active: boolean;
  onClick: () => void;
  searchValue?: string;
  pendingConfirmation: PendingConfirmation | null;
}) {
  const isPending = pendingConfirmation !== null;
  const isDanger = isPending && (item.action === "delete-note" || item.action === "delete-folder");

  const getConfirmationText = () => {
    if (!pendingConfirmation) return null;
    switch (pendingConfirmation.method) {
      case "click":
        return "Click again to confirm";
      case "enter":
        return "Press Enter or Ctrl+D to confirm";
      case "keybind":
        return "Press Enter or Ctrl+D to confirm";
      default:
        return null;
    }
  };

  const confirmationText = getConfirmationText();

  return (
    <div
      role="option"
      aria-selected={active}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm outline-hidden select-none",
        isDanger ? "text-destructive" : "text-muted-foreground",
        isDanger 
          ? "bg-destructive/10 hover:bg-destructive/20" 
          : "hover:bg-accent/50",
        isDanger && active ? "bg-destructive/20" : "data-[active=true]:bg-accent",
        !isDanger && "hover:text-foreground",
        isDanger && active ? "text-destructive" : "data-[active=true]:text-accent-foreground",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
      )}
    >
      {item.icon && (
        <span className="flex items-center justify-center w-4 h-4">
          {item.icon}
        </span>
      )}
      <span className="truncate font-medium min-w-0 flex-1">
        {isPending && confirmationText ? (
          confirmationText
        ) : searchValue ? (
          <HighlightedText text={item.title} query={searchValue} />
        ) : (
          item.title
        )}
      </span>
      {item.shortcut && !isPending && (
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
