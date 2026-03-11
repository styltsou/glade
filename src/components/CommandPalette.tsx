import { useState, useCallback, useEffect, useMemo } from "react";
import {
  Plus as PlusIcon,
  Trash2 as TrashIcon,
  Palette as PaletteIcon,
  FolderCog as FolderCogIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "@/components/ui/command";
import { useStore } from "@/store";
import { useCommandShortcuts } from "@/hooks/useCommandShortcuts";
import { HighlightedText } from "./command-palette/HighlightedText";
import { flattenNotes } from "@/lib/notes";
import type { NoteSearchResult, NoteData } from "@/types";

type CommandPaletteNote = NoteSearchResult | NoteData;

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const entries = useStore((state) => state.entries);
  const activeNote = useStore((state) => state.activeNote);
  const selectNote = useStore((state) => state.selectNote);
  const createNote = useStore((state) => state.createNote);
  const searchNotes = useStore((state) => state.searchNotes);
  const searchResults = useStore((state) => state.searchResults);
  const clearSearch = useStore((state) => state.clearSearch);

  const openDelete = useStore((state) => state.openDelete);
  const openSettingsPage = useStore((state) => state.openSettingsPage);

  // Register global shortcuts
  useCommandShortcuts(setOpen);

  const handleSelect = useCallback(
    (action: string) => {
      setOpen(false);
      clearSearch();

      switch (action) {
        case "new-note":
          createNote();
          break;
        case "delete-note":
          if (activeNote) {
            openDelete(activeNote.path, activeNote.title);
          }
          break;
        case "manage-vaults":
          openSettingsPage("vaults");
          break;
        case "appearance":
          openSettingsPage("appearance");
          break;
        default:
          if (action.startsWith("note:")) {
            selectNote(action.slice(5));
          }
          break;
      }
    },
    [activeNote, createNote, openDelete, openSettingsPage, selectNote, clearSearch],
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
        }
      }}
    >
      <CommandInput
        placeholder="Type a command or search…"
        onValueChange={setSearchValue}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem
            value="new note"
            onSelect={() => handleSelect("new-note")}
          >
            <PlusIcon />
            <span>New Note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>

          {activeNote && (
            <CommandItem
              value="delete note"
              onSelect={() => handleSelect("delete-note")}
            >
              <TrashIcon />
              <span>Delete Current Note</span>
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
                      <span className="truncate flex-shrink-0">
                        <HighlightedText text={note.title} query={searchValue} />
                      </span>
                      {matchedTags.length > 0 && (
                        <div className="flex gap-1 overflow-hidden">
                          {matchedTags.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-1 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-medium leading-none whitespace-nowrap"
                            >
                              #<HighlightedText text={tag} query={searchValue} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {note.preview && (
                      <span className="text-muted-foreground text-xs truncate">
                        <HighlightedText text={note.preview} query={searchValue} />
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
