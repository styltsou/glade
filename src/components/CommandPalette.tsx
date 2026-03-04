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
import { SettingsDialog } from "@/components/SettingsDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const {
    entries,
    activeNote,
    selectNote,
    createNote,
    deleteEntry,
    searchNotes,
    searchResults,
    clearSearch,
  } = useVaultStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // Also Cmd+K for search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      // Cmd+N for new note
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        createNote();
      }
      // Cmd+, for settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      }
      // Cmd+D for delete note — show confirmation
      if ((e.metaKey || e.ctrlKey) && e.key === "d" && !e.shiftKey) {
        e.preventDefault();
        if (activeNote) {
          setIsDeleteOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [createNote, activeNote, deleteEntry]);

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
            setIsDeleteOpen(true);
          }
          break;
        case "settings":
          setSettingsOpen(true);
          break;
        default:
          // If it starts with "note:", it's a note path
          if (action.startsWith("note:")) {
            selectNote(action.slice(5));
          }
          break;
      }
    },
    [activeNote, createNote, deleteEntry, selectNote, clearSearch],
  );

  // Flatten notes for navigation
  const allNotes = flattenNotes(entries);

  return (
    <>
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

          {/* Search Results */}
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

          {/* Actions */}
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
              value="appearance settings theme"
              onSelect={() => handleSelect("settings")}
            >
              <GearIcon />
              <span>Appearance</span>
              <CommandShortcut>⌘,</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          {/* Navigate to notes */}
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

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {activeNote && (
        <DeleteConfirmDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          name={activeNote.title}
          onConfirm={() => {
            deleteEntry(activeNote.path);
            setIsDeleteOpen(false);
          }}
        />
      )}
    </>
  );
}

/** Recursively flatten vault entries to get all notes. */
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
