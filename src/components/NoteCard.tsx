import { useCallback } from "react";
import { Pin as DrawingPinFilledIcon, PinOff as PinOffIcon, Trash2 as TrashIcon, Pencil as PencilIcon, Copy as CopyIcon } from "lucide-react";
import { useStore } from "@/store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { NoteCard as NoteCardType } from "@/types";
import { formatShortDate } from "@/lib/dates";

interface NoteCardProps {
  card: NoteCardType;
  onOpen?: () => void;
  showPin?: boolean;
}

export function NoteCard({ card, onOpen, showPin = true }: NoteCardProps) {
  const selectNote = useStore((state) => state.selectNote);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const pinNote = useStore((state) => state.pinNote);
  const unpinNote = useStore((state) => state.unpinNote);
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);
  const prefetchNote = useStore((state) => state.prefetchNote);

  const handleClick = useCallback(() => {
    // Pass partial data for optimistic UI
    // Do not await so navigation feels instant
    selectNote(card.path, {
      path: card.path,
      title: card.title,
      tags: card.tags,
      preview: card.preview,
    });
    onOpen?.();
  }, [card, selectNote, onOpen]);

  const handleMouseEnter = useCallback(() => {
    prefetchNote(card.path);
  }, [card.path, prefetchNote]);

  const tags = card.tags.slice(0, 3);
  const dateLabel = card.modified ? formatShortDate(card.modified) : "";

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          onClick={handleClick}
          onMouseEnter={handleMouseEnter}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
          className="
            group relative flex flex-col gap-2 text-left w-full
            rounded-lg p-4 cursor-pointer
            bg-card border border-border
            hover:border-foreground/20 hover:bg-muted/50
            hover:shadow-md
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          {/* Title */}
          <div className="flex items-start gap-1.5 min-w-0">
            {showPin && card.pinned && (
              <DrawingPinFilledIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary rotate-45" />
            )}
            <span className="text-sm font-semibold text-foreground leading-snug line-clamp-2 pr-2">
              {card.title}
            </span>
          </div>

          {/* Preview */}
          <div>
            {card.preview ? (
              <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {card.preview}
              </span>
            ) : (
              <div className="h-full w-full" />
            )}
          </div>

          {/* Footer: tags + date */}
          <div className="flex items-center justify-between gap-2 mt-auto pt-3">
            <div className="flex items-center gap-1 flex-wrap min-w-0">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-medium text-primary/80 bg-primary/5 border border-primary/20 rounded-sm px-2 py-0.5 leading-none truncate tracking-tight"
                >
                  {tag}
                </span>
              ))}
              {card.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{card.tags.length - 3}
                </span>
              )}
            </div>
            {dateLabel && (
              <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                {dateLabel}
              </span>
            )}
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => openRename(card.path, card.title)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(card.path)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        {card.pinned ? (
          <ContextMenuItem onClick={() => unpinNote(card.path)}>
            <PinOffIcon className="mr-2 h-4 w-4" />
            Unpin note
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={() => pinNote(card.path)}>
            <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
            Pin note
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => openDelete(card.path, card.title)}>
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
