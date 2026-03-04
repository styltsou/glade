import { useState } from "react";
import {
  MoreHorizontal,
  Pencil as PencilIcon,
  Copy as CopyIcon,
  PinOff as PinOffIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { useVaultStore } from "@/stores/useVaultStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { useDialogStore } from "@/stores/useDialogStore";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PinnedSection() {
  const { activeNote, selectNote } = useVaultStore();
  const { pinnedNotes, unpinNote } = useHomeStore();

  if (pinnedNotes.length === 0) return null;

  return (
    <div className="px-2 py-1 shrink-0">
      <div className="pb-1.5 flex items-center">
        <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest pt-[1px]">
          Pinned ({pinnedNotes.length})
        </span>
      </div>
      <div className="space-y-0.5">
        {pinnedNotes.map((note) => (
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
  const [menuOpen, setMenuOpen] = useState(false);
  const { duplicateNote } = useVaultStore();
  const { openRename, openDelete } = useDialogStore();

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`flex items-center w-full rounded-md pr-2 pl-2 py-1.5 text-[13px] text-left transition-all cursor-default font-medium ${
          active || menuOpen
            ? "bg-sidebar-accent text-foreground"
            : "text-muted-foreground group-hover:text-foreground group-hover:bg-sidebar-accent"
        }`}
      >
        <span className="truncate pr-6">{name}</span>
      </button>

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 hover:text-foreground bg-sidebar-accent transition-all">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRename(path, name); }}>
            <PencilIcon className="mr-2 h-4 w-4" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateNote(path); }}>
            <CopyIcon className="mr-2 h-4 w-4" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onUnpin(); }}>
            <PinOffIcon className="mr-2 h-4 w-4" />
            Unpin note
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); openDelete(path, name); }}>
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
