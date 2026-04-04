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
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommandShortcuts } from "@/hooks/useCommandShortcuts";
import { flattenNotes } from "@/lib/notes";
import { useStore } from "@/store";
import type { NoteData, NoteSearchResult } from "@/types";
import { HighlightedText } from "./command-palette/HighlightedText";

type CommandPaletteNote = NoteSearchResult | NoteData;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
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
  const [selectedValue, setSelectedValue] = useState("");
  const [lastInteraction, setLastInteraction] = useState<"mouse" | "keyboard">(
    "keyboard",
  );

  // Register global shortcuts
  useCommandShortcuts(setOpen);

  const handleSelect = useCallback(
    (action: string) => {
      setOpen(false);
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

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      showCloseButton={false}
      className="max-w-lg"
      commandProps={{
        value: selectedValue,
        onValueChange: (v) => {
          if (lastInteraction === "keyboard") {
            setSelectedValue(v);
          }
        },
        filter: (value: string, search: string) => {
          if (!search) return 1;

          const v = value.toLowerCase();
          const s = search.toLowerCase();

          if (value.startsWith("note:") && searchResults.length > 0) {
            return 1;
          }

          if (v === s) return 2;
          if (v.startsWith(s)) return 1.5;
          if (v.includes(s)) return 1;
          return 0;
        },
      }}
    >
      <CommandInput
        placeholder="Type a command or search…"
        onValueChange={setSearchValue}
        onKeyDown={() => setLastInteraction("keyboard")}
      />
      <CommandList onMouseMove={() => setLastInteraction("mouse")}>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          {!activeNote && (
            <CommandItem
              value="create new folder"
              onSelect={() => handleSelect("new-folder")}
            >
              <FolderPlusIcon />
              <span>Create New Folder</span>
              <CommandShortcut>⌘F</CommandShortcut>
            </CommandItem>
          )}

          <CommandItem
            value="create new note"
            onSelect={() => handleSelect("new-note")}
          >
            <PlusIcon />
            <span>Create New Note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>

          {activeNote && (
            <>
              <CommandItem
                value="duplicate note"
                onSelect={() => handleSelect("duplicate-note")}
              >
                <CopyIcon />
                <span>Duplicate Current Note</span>
              </CommandItem>

              <CommandItem
                value="delete note"
                onSelect={() => handleSelect("delete-note")}
              >
                <TrashIcon />
                <span>Delete Current Note</span>
                <CommandShortcut>⌘D</CommandShortcut>
              </CommandItem>
            </>
          )}

          {(!activeNote && currentFolder) && (
            <CommandItem
              value="delete folder"
              onSelect={() => handleSelect("delete-folder")}
            >
              <TrashIcon />
              <span>Delete Current Folder</span>
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
          )}

          <CommandItem
            value="manage vaults"
            onSelect={() => handleSelect("manage-vaults")}
          >
            <FolderCogIcon />
            <span>Manage Vaults</span>
          </CommandItem>

          <CommandItem
            value="appearance"
            onSelect={() => handleSelect("appearance")}
          >
            <PaletteIcon />
            <span>Appearance</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>

          <CommandItem
            value="import files"
            onSelect={() => handleSelect("import-files")}
          >
            <UploadIcon />
            <span>Import Files</span>
          </CommandItem>

          {activeNote && (
            <CommandItem
              value="toggle table of contents"
              onSelect={() => handleSelect("toggle-toc")}
            >
              <BookOpenIcon />
              <span>Toggle Table of Contents</span>
              <CommandShortcut>⌘⇧T</CommandShortcut>
            </CommandItem>
          )}
        </CommandGroup>

        {allNotes.length > 0 && <CommandSeparator />}

        {(searchResults.length > 0 || allNotes.length > 0) && (
          <CommandGroup
            heading={searchResults.length > 0 ? "Search Results" : "Notes"}
          >
            {(searchResults.length > 0 ? searchResults : allNotes).map(
              (note: CommandPaletteNote) => {
                const matchedTags =
                  searchResults.length > 0 && searchValue.trim()
                    ? note.tags.filter((t: string) =>
                        t.toLowerCase().includes(searchValue.toLowerCase()),
                      )
                    : [];

                return (
                  <CommandItem
                    key={note.path}
                    value={
                      searchResults.length > 0
                        ? `${note.title} ${note.preview} ${note.tags.join(" ")} ${searchValue}`
                        : note.title
                    }
                    onSelect={() => handleSelect(`note:${note.path}`)}
                  >
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="truncate shrink-0">
                          <HighlightedText
                            text={note.title}
                            query={searchValue}
                          />
                        </span>
                        {matchedTags.length > 0 && (
                          <div className="flex gap-1 overflow-hidden">
                            {matchedTags.map((tag: string) => (
                              <span
                                key={tag}
                                className="px-1 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-medium leading-none whitespace-nowrap"
                              >
                                #
                                <HighlightedText
                                  text={tag}
                                  query={searchValue}
                                />
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      {note.preview && (
                        <span className="text-muted-foreground text-xs truncate">
                          <HighlightedText
                            text={note.preview}
                            query={searchValue}
                          />
                        </span>
                      )}
                    </div>
                    {note.path.includes("/") && (
                      <span className="text-muted-foreground text-xs ml-auto shrink-0">
                        {note.path.split("/").slice(0, -1).join("/")}
                      </span>
                    )}
                  </CommandItem>
                );
              },
            )}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
