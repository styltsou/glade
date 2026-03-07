import { useCallback } from "react";
import { Pin as DrawingPinFilledIcon, PinOff as PinOffIcon, MoreHorizontal, Trash2 as TrashIcon, Pencil as PencilIcon, Copy as CopyIcon } from "lucide-react";
import { useStore } from "@/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteCard as NoteCardType } from "@/types";

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
        rounded-lg p-3.5 cursor-pointer
        bg-card border border-border
        hover:border-foreground/20 hover:bg-muted/50
        hover:shadow-md
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
      "
    >
      {/* Actions (Pin + Dropdown) */}
      <div 
        className="absolute top-2 right-2 flex items-center gap-0.5 z-10 p-0.5 rounded-md transition-colors" 
        onClick={(e) => e.stopPropagation()}
      >
        {showPin && card.pinned && (
          <span className="text-muted-foreground px-1">
            <DrawingPinFilledIcon className="h-2.5 w-2.5 fill-current" />
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="cursor-pointer p-1 rounded-md text-foreground/70 hover:bg-muted/50 transition-colors">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" avoidCollisions={true} sideOffset={4}>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openRename(card.path, card.title); }}>
              <PencilIcon className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); duplicateNote(card.path); }}>
              <CopyIcon className="mr-2 h-4 w-4" />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {card.pinned ? (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); unpinNote(card.path); }}>
                <PinOffIcon className="mr-2 h-4 w-4" />
                Unpin note
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); pinNote(card.path); }}>
                <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
                Pin note
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); openDelete(card.path, card.title); }}>
              <TrashIcon className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <div className="min-h-[2.4em]">
        <span className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2 pr-2">
          {card.title}
        </span>
      </div>

      {/* Preview */}
      <div className="min-h-[3.2em]">
        {card.preview ? (
          <span className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
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
              className="text-[10px] font-medium text-primary/80 bg-primary/5 border border-primary/20 rounded-sm px-2 py-0.5 leading-none truncate tracking-tight"
            >
              {tag}
            </span>
          ))}
          {card.tags.length > 3 && (
            <span className="text-[11px] text-muted-foreground">
              +{card.tags.length - 3}
            </span>
          )}
        </div>
        {dateLabel && (
          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
            {dateLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function formatShortDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
