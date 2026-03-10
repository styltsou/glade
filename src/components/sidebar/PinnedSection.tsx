import { useState } from "react";
import {
  MoreHorizontal,
  Pencil as PencilIcon,
  Copy as CopyIcon,
  PinOff as PinOffIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { useStore } from "@/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteCard } from "@/types";

export function PinnedSection() {
  const activeNote = useStore((state) => state.activeNote);
  const selectNote = useStore((state) => state.selectNote);
  const pinnedNotes = useStore((state) => state.pinnedNotes);
  const unpinNote = useStore((state) => state.unpinNote);

  if (pinnedNotes.length === 0) return null;

  return (
    <div className="px-2 pt-2 pb-1 shrink-0">
      <div className="pb-1.5 px-2 flex items-center">
        <span className="text-xs font-bold text-foreground uppercase tracking-widest">
          Pinned
        </span>
      </div>
      <div className="space-y-0.5">
        {pinnedNotes.map((note: NoteCard) => (
          <PinnedItem
            key={note.path}
            path={note.path}
            name={note.title}
            active={activeNote?.path === note.path}
            onClick={() => selectNote(note.path)}
            onUnpin={() => unpinNote(note.path)}
          />
        ))}
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
  const [, setMenuOpen] = useState(false);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);

  return (
    <div className="relative group/note">
      <button
        onClick={onClick}
        className={`flex items-center gap-1 w-full rounded-md px-2 py-1.5 text-sm text-left transition-colors cursor-pointer font-medium ${
          active
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
        }`}
      >
          <span className="truncate pr-8">{name}</span>
      </button>

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer absolute right-0 top-0 bottom-0 w-7 px-2 flex items-center justify-center rounded-sm text-foreground/70 opacity-0 group-hover/note:opacity-100 data-[state=open]:opacity-100 hover:text-foreground group-hover/note:bg-sidebar-accent active:bg-sidebar-accent data-[state=open]:bg-sidebar-accent transition-colors z-10">
            <MoreHorizontal className="h-4 w-4" strokeWidth={3} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={2}>
          <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); openRename(path, name); }}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); duplicateNote(path); }}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e: any) => { e.stopPropagation(); onUnpin(); }}>
            <PinOffIcon className="mr-2 h-4 w-4" />
            Unpin note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={(e: any) => { e.stopPropagation(); openDelete(path, name); }}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
