import { useEffect, useState, useCallback } from "react";
import {
  Plus as PlusIcon,
  Trash2 as TrashIcon,
  Palette as PaletteIcon,
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
import { useVaultStore } from "@/stores/useVaultStore";
import { useDialogStore } from "@/stores/useDialogStore";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const {
    entries,
    activeNote,
    selectNote,
    createNote,
    searchNotes,
    searchResults,
    clearSearch,
  } = useVaultStore();
  const { openDelete, openSettings } = useDialogStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createNote();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        openSettings();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && !e.shiftKey) {
        e.preventDefault();
        if (activeNote) {
          openDelete(activeNote.path, activeNote.title);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createNote, activeNote, openDelete, openSettings]);

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
        case "settings":
          openSettings();
          break;
        default:
          if (action.startsWith("note:")) {
            selectNote(action.slice(5));
          }
          break;
      }
    },
    [activeNote, createNote, openDelete, openSettings, selectNote, clearSearch],
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

  const allNotes = flattenNotes(entries);

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      showCloseButton={false}
      filter={(value, search) => {
        if (!search) return 1;

        const v = value.toLowerCase();
        const s = search.toLowerCase();

        // If it's a note (marked by value prefix), we trust backend results
        if (value.startsWith("note:") && searchResults.length > 0) {
          return 1;
        }

        // Strict substring match for actions and other items
        if (v === s) return 2; // Exact match
        if (v.startsWith(s)) return 1.5; // Prefix match
        if (v.includes(s)) return 1; // Substring match
        return 0; // No match
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
            value="appearance settings"
            onSelect={() => handleSelect("settings")}
          >
            <PaletteIcon />
            <span>Appearance</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup
          heading={searchResults.length > 0 ? "Search Results" : "Notes"}
        >
          {(searchResults.length > 0 ? searchResults : allNotes).map(
            (note: any) => {
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
                        <Highlight text={note.title} query={searchValue} />
                      </span>
                      {matchedTags.length > 0 && (
                        <div className="flex gap-1 overflow-hidden">
                          {matchedTags.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-1 py-0.5 rounded-sm bg-primary/10 text-primary text-[10px] font-medium leading-none whitespace-nowrap"
                            >
                              #<Highlight text={tag} query={searchValue} />
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {note.preview && (
                      <span className="text-muted-foreground text-xs truncate">
                        <Highlight text={note.preview} query={searchValue} />
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
      </CommandList>
    </CommandDialog>
  );
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return <>{text}</>;

  // Escape special characters for regex and create a pattern that matches any of the terms
  const escapedTerms = terms.map((t) =>
    t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <span key={i} className="bg-primary/20 text-primary px-[1px] rounded-[2px] font-medium">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function flattenNotes(
  entries: { name: string; path: string; is_dir: boolean; children: any[] }[],
): { title: string; path: string; preview?: string }[] {
  const notes: { title: string; path: string; preview?: string }[] = [];
  for (const entry of entries) {
    if (entry.is_dir) {
      notes.push(...flattenNotes(entry.children));
    } else {
      notes.push({ title: entry.name, path: entry.path });
    }
  }
  return notes;
}
