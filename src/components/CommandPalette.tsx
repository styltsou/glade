import { useEffect, useState, useCallback } from "react";
import {
  Plus as PlusIcon,
  FileText as FileTextIcon,
  Trash2 as TrashIcon,
  Settings as GearIcon,
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

  const allNotes = flattenNotes(entries);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Type a command or search…"
        onValueChange={(value) => {
          if (value.length > 1) {
            searchNotes(value);
          } else {
            clearSearch();
          }
        }}
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {searchResults.length > 0 && (
          <CommandGroup heading="Search Results">
            {searchResults.map((note) => (
              <CommandItem
                key={`search-${note.path}`}
                value={`search ${note.title} ${note.path}`}
                onSelect={() => handleSelect(`note:${note.path}`)}
              >
                <FileTextIcon className="shrink-0" />
                <span className="truncate">{note.title}</span>
                {note.preview && (
                  <span className="text-muted-foreground text-xs truncate ml-auto max-w-[200px]">
                    {note.preview}
                  </span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {searchResults.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Actions">
          <CommandItem value="new note" onSelect={() => handleSelect("new-note")}>
            <PlusIcon />
            <span>New Note</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>

          {activeNote && (
            <CommandItem value="delete note" onSelect={() => handleSelect("delete-note")}>
              <TrashIcon />
              <span>Delete Current Note</span>
              <CommandShortcut>⌘D</CommandShortcut>
            </CommandItem>
          )}

          <CommandItem
            value="appearance settings theme"
            onSelect={() => handleSelect("settings")}
          >
            <GearIcon />
            <span>Appearance</span>
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Notes">
          {allNotes.map((note) => (
            <CommandItem
              key={note.path}
              value={`${note.name} ${note.path}`}
              onSelect={() => handleSelect(`note:${note.path}`)}
            >
              <FileTextIcon className="shrink-0" />
              <span className="truncate">{note.name}</span>
              {note.path.includes("/") && (
                <span className="text-muted-foreground text-xs ml-auto">
                  {note.path.split("/").slice(0, -1).join("/")}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

function flattenNotes(
  entries: { name: string; path: string; is_dir: boolean; children: any[] }[],
): { name: string; path: string }[] {
  const notes: { name: string; path: string }[] = [];
  for (const entry of entries) {
    if (entry.is_dir) {
      notes.push(...flattenNotes(entry.children));
    } else {
      notes.push({ name: entry.name, path: entry.path });
    }
  }
  return notes;
}
