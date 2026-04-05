import { useState, useCallback, useLayoutEffect, useRef } from "react";
import { Pin as DrawingPinFilledIcon, PinOff as PinOffIcon, Trash2 as TrashIcon, Pencil as PencilIcon, Copy as CopyIcon } from "lucide-react";
import { useStore } from "@/store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(card.tags.length > 3 ? 3 : card.tags.length);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const calculateVisibleTags = () => {
      const containerWidth = container.offsetWidth;
      const tagsToConsider = card.tags.slice(0, 3);
      if (tagsToConsider.length === 0) return 0;

      // Temporary element to measure tag widths
      const measureDiv = document.createElement("div");
      measureDiv.style.visibility = "hidden";
      measureDiv.style.position = "absolute";
      measureDiv.style.display = "flex";
      measureDiv.style.gap = "6px"; // gap-1.5
      measureDiv.style.fontSize = "10px";
      measureDiv.style.padding = "0 6px"; // buffer
      document.body.appendChild(measureDiv);

      let currentWidth = 0;
      let count = 0;
      const indicatorWidth = card.tags.length > 3 ? 25 : 0; // Estimated '+N' width

      for (let i = 0; i < tagsToConsider.length; i++) {
        const span = document.createElement("span");
        span.innerText = tagsToConsider[i];
        span.style.padding = "0 6px"; // px-1.5
        span.style.border = "1px solid"; // border
        measureDiv.appendChild(span);
        
        const tagWidth = span.offsetWidth + 6; // item + gap
        if (currentWidth + tagWidth + indicatorWidth > containerWidth && count > 0) {
          break;
        }
        currentWidth += tagWidth;
        count++;
      }

      document.body.removeChild(measureDiv);
      
      // If we have tags left over, ensure there are at least 2 in the popover
      // so it doesn't look weird with just one tag.
      let finalCount = count;
      const leftover = card.tags.length - count;
      if (leftover === 1 && finalCount > 0) {
        finalCount -= 1;
      }
      
      setVisibleCount(finalCount);
    };

    calculateVisibleTags();
    const observer = new ResizeObserver(calculateVisibleTags);
    observer.observe(container);
    return () => observer.disconnect();
  }, [card.tags]);

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
            group relative flex flex-col gap-2 text-left w-full min-h-36
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
          <div className="flex items-center justify-between gap-4 mt-auto pt-3">
            <div ref={containerRef} className="flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-nowrap overflow-hidden min-w-0">
                {card.tags.slice(0, visibleCount).map((tag) => (
                  <span
                    key={tag}
                    className="
                      text-[10px] font-medium px-1.5 py-0.5 rounded-sm border
                      text-primary/70 bg-primary/5 border-primary/10
                      truncate max-w-[120px] shrink-0
                    "
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {(card.tags.length > visibleCount) && (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <span
                      onMouseEnter={() => setIsPopoverOpen(true)}
                      onMouseLeave={() => setIsPopoverOpen(false)}
                      className="
                        text-[10px] font-bold shrink-0 cursor-default px-1.5 py-0.5 rounded-sm border
                        text-primary/70 bg-primary/5 border-primary/10
                        hover:text-primary transition-colors
                      "
                    >
                      +{card.tags.length - visibleCount}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="w-auto p-2 flex flex-wrap gap-1.5 max-w-[280px] bg-popover/95 backdrop-blur-sm border-primary/10 shadow-xl"
                    onMouseEnter={() => setIsPopoverOpen(true)}
                    onMouseLeave={() => setIsPopoverOpen(false)}
                  >
                    {card.tags.slice(visibleCount).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-medium px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary border border-primary/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>
            {dateLabel && (
              <span className="text-[10px] font-medium text-muted-foreground/40 shrink-0 tabular-nums ml-auto">
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
