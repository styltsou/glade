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
    <div className="px-2 py-1 shrink-0">
      <div className="pb-1.5 px-2 flex items-center">
        <span className="text-[10px] font-bold text-foreground uppercase tracking-widest pt-[1px]">
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
      <div className="mt-2 mb-1 border-t border-border" />
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
        className={`flex items-center gap-1 w-full rounded-md pr-2 pl-2 py-1.5 text-[13px] text-left transition-all cursor-pointer font-medium ${
          active
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground group-hover/note:text-foreground group-hover/note:bg-sidebar-accent"
        }`}
      >
        <span className="truncate pr-1">{name}</span>
      </button>

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-foreground/70 opacity-0 group-hover/note:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent transition-all z-10">
            <MoreHorizontal className="h-4 w-4" />
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
