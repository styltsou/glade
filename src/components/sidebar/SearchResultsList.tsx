import { useStore } from "@/store";
import type { NoteData } from "@/types";
import {
  Folder,
  Pencil as PencilIcon,
  Copy as CopyIcon,
  Pin as DrawingPinFilledIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

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

  const pinnedPaths = new Set<string>(pinnedNotes.map((n: any) => n.path));

  return (
    <div className="space-y-0.5 px-2 py-1 border-t border-border/40">
      {searchResults.map((note: NoteData) => {
        const isPinned = pinnedPaths.has(note.path);
        const isActive = activeNotePath === note.path;

        // Extract folder path (e.g., "Work/Projects/Note.md" -> "Work/Projects")
        const pathParts = note.path.split("/");
        const folderPath = pathParts.slice(0, -1).join("/");

        return (
          <ContextMenu key={note.path}>
            <ContextMenuTrigger>
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
                  <div className="flex items-center">
                    <span className="truncate pr-1">
                      <Highlight text={note.title} query={sidebarQuery} />
                    </span>
                  </div>
                </div>
              </button>
            </ContextMenuTrigger>

            <ContextMenuContent className="w-48">
              <ContextMenuItem onClick={() => openRename(note.path, note.title)}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => duplicateNote(note.path)}>
                <CopyIcon className="mr-2 h-4 w-4" />
                Duplicate
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => pinNote(note.path)}>
                <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
                {isPinned ? "Unpin note" : "Pin note"}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => openDelete(note.path, note.title)}
              >
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete note
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
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
            className="bg-primary/20 text-primary px-[1px] rounded-xs font-medium"
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
