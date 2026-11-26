import {
  Folder,
  FolderOpen,
  Pencil as PencilIcon,
  Trash2 as TrashIcon,
  Columns2 as ColumnsIcon,
  FolderSearch as FolderSearchIcon,
  ClipboardCopy as ClipboardCopyIcon,
} from "lucide-react";
import { useCallback } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { formatShortDate } from "@/lib/dates";
import { useStore } from "@/store";
import { copyPath, revealInFileManager } from "@/lib/fileActions";
import type { VaultEntry } from "@/types";

interface FolderCardProps {
  folder: VaultEntry;
}

export function FolderCard({ folder }: FolderCardProps) {
  const setCurrentFolder = useStore((state) => state.setCurrentFolder);
  const openRename = useStore((state) => state.openRename);
  const openFolderToSide = useStore((state) => state.openFolderToSide);
  const openDelete = useStore((state) => state.openDelete);

  const handleClick = useCallback(() => {
    setCurrentFolder(folder.path);
  }, [folder.path, setCurrentFolder]);

  const dateLabel = folder.modified ? formatShortDate(folder.modified) : "";
  const noteCount = folder.children?.filter((c) => !c.is_dir).length || 0;
  const folderCount = folder.children?.filter((c) => c.is_dir).length || 0;

  return (
    <ContextMenu>
      <ContextMenuTrigger className="block h-full">
        <div
          onClick={handleClick}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          className="
            group relative flex flex-col gap-1.5 text-left w-full h-full
            rounded-lg p-3 cursor-pointer
            bg-card border border-border/70 shadow-xs
            transition-[border-color,background-color] duration-100
            hover:border-foreground/15 hover:bg-accent/20
            active:bg-accent/30
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
          "
        >
          {/* Icon + Title */}
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-primary/70 shrink-0" />
            <span className="text-sm font-semibold text-foreground leading-tight line-clamp-1">
              {folder.name}
            </span>
          </div>

          {/* Footer: Detailed info + date */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground/80 tabular-nums">
            <div className="flex items-center gap-1.5">
              {noteCount > 0 && (
                <span>
                  {noteCount} note{noteCount !== 1 ? "s" : ""}
                </span>
              )}
              {noteCount > 0 && folderCount > 0 && (
                <span className="opacity-40">•</span>
              )}
              {folderCount > 0 && (
                <span>
                  {folderCount} folder{folderCount !== 1 ? "s" : ""}
                </span>
              )}
              {noteCount === 0 && folderCount === 0 && <span>Empty</span>}
            </div>
            {dateLabel && <span className="shrink-0">{dateLabel}</span>}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="min-w-48">
        <ContextMenuItem onClick={handleClick}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Open folder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openFolderToSide(folder.path)}>
          <ColumnsIcon className="mr-2 h-4 w-4" />
          Open to the side
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => openRename(folder.path, true)}
        >
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename folder
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => revealInFileManager(folder.path)}>
          <FolderSearchIcon className="mr-2 h-4 w-4" />
          Reveal in file manager
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void copyPath(folder.path)}>
          <ClipboardCopyIcon className="mr-2 h-4 w-4" />
          Copy path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => openDelete(folder.path, folder.name, true)}
        >
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete folder
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
