import {
  Pencil as PencilIcon,
  Copy as CopyIcon,
  PinOff as PinOffIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { useStore } from "@/store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteCard } from "@/types";

export function PinnedSection() {
  const activeNote = useStore((state) => state.activeNote);
  const selectNote = useStore((state) => state.selectNote);
  const pinnedNotes = useStore((state) => state.pinnedNotes);
  const unpinNote = useStore((state) => state.unpinNote);
  const isVaultsLoading = useStore((state) => state.isVaultsLoading);

  if (pinnedNotes.length === 0 && !isVaultsLoading) return null;

  return (
    <div className="px-2 pt-2 pb-1 shrink-0">
      <div className="pb-1.5 px-2 flex items-center">
        <span className="text-xs font-bold text-foreground uppercase tracking-widest">
          Pinned
        </span>
      </div>
      <div className="space-y-0.5">
        {isVaultsLoading ? (
          <div className="space-y-4 px-0">
            <div className="flex items-center w-full px-2">
              <Skeleton className="h-4 w-full rounded-md bg-foreground/10" />
            </div>
            <div className="flex items-center w-full px-2">
              <Skeleton className="h-4 w-full rounded-md bg-foreground/10" />
            </div>
          </div>
        ) : (
          pinnedNotes.map((note: NoteCard) => (
            <PinnedItem
              key={note.path}
              path={note.path}
              name={note.title}
              active={activeNote?.path === note.path}
              onClick={() => selectNote(note.path)}
              onUnpin={() => unpinNote(note.path)}
            />
          ))
        )}
      </div>
      <div className="mt-3 mb-2 border-t border-border/50" />
    </div>
  );
}

function PinnedItem({
  path,
  name,
  active,
  onClick,
  onUnpin,
}: {
  path: string;
  name: string;
  active: boolean;
  onClick: () => void;
  onUnpin: () => void;
}) {
  const duplicateNote = useStore((state) => state.duplicateNote);
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className="relative group/note">
          <button
            onClick={onClick}
            className={`flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm text-left transition-colors cursor-pointer font-medium ${
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            }`}
          >
            <span className="truncate">{name}</span>
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openRename(path, name)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(path)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onUnpin()}>
          <PinOffIcon className="mr-2 h-4 w-4" />
          Unpin note
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => openDelete(path, name)}>
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
