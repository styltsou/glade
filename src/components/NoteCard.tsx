import { useState, useCallback, useLayoutEffect, useRef } from "react";
import { Pin as DrawingPinFilledIcon, PinOff as PinOffIcon, Trash2 as TrashIcon, Pencil as PencilIcon, Copy as CopyIcon, Plus as PlusIcon, Columns2 as ColumnsIcon, FolderSearch as FolderSearchIcon, ClipboardCopy as ClipboardCopyIcon } from "lucide-react";
import { useStore } from "@/store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { NoteCard as NoteCardType } from "@/types";
import { formatShortDate } from "@/lib/dates";
import { useNoteLabel } from "@/lib/noteLabel";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { copyPath, revealInFileManager } from "@/lib/fileActions";
import { MAX_VISIBLE_TAGS, visibleTagCount } from "@/lib/tagOverflow";
import { cn } from "@/lib/utils";

/** Space between tags, in px (gap-1.5). */
const TAG_GAP = 6;

/** A tag, as a pill like the @ references in notes, in tints of the accent colour. */
const TAG_PILL =
  // Line height of its own: a tighter one clips descenders (the g in "glade") where the label truncates.
  "inline-flex items-center rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs leading-4 font-medium text-primary";

interface NoteCardProps {
  card: NoteCardType;
  onOpen?: () => void;
  showPin?: boolean;
}

export function NoteCard({ card, onOpen, showPin = true }: NoteCardProps) {
  const selectNote = useStore((state) => state.selectNote);
  const label = useNoteLabel()(card.path, card.title);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const pinNote = useStore((state) => state.pinNote);
  const unpinNote = useStore((state) => state.unpinNote);
  const openRename = useStore((state) => state.openRename);
  const openNote = useStore((state) => state.openNote);
  const openDelete = useStore((state) => state.openDelete);
  const prefetchNote = useStore((state) => state.prefetchNote);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(Math.min(card.tags.length, MAX_VISIBLE_TAGS));
  const measureRef = useRef<HTMLDivElement>(null);

  // How many tags fit beside the "+N" tag, from the real widths of a hidden copy of them.
  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const calculate = () => {
      const items = Array.from(measure.children) as HTMLElement[];
      const more = items.pop();
      setVisibleCount(
        visibleTagCount({
          widths: items.map((item) => item.offsetWidth),
          total: card.tags.length,
          available: container.clientWidth,
          moreWidth: more?.offsetWidth ?? 0,
          gap: TAG_GAP,
        }),
      );
    };

    calculate();
    const observer = new ResizeObserver(calculate);
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
      <ContextMenuTrigger className="group/menu block h-full">
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
            group relative flex flex-col gap-2 text-left w-full h-full min-h-36
            rounded-lg p-4 cursor-pointer
            bg-card border border-border/70 shadow-xs
            transition-[border-color,background-color] duration-100
            hover:border-foreground/15 hover:bg-accent/20
            group-data-[state=open]/menu:border-foreground/15 group-data-[state=open]/menu:bg-accent/30
            active:bg-accent/30
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50
          "
        >
          {/* Title */}
          <div className="flex items-start gap-1.5 min-w-0">
            {showPin && card.pinned && (
              <DrawingPinFilledIcon className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary rotate-45" />
            )}
            <span className="text-sm font-semibold text-foreground leading-snug line-clamp-2 pr-2">
              {label}
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
            <div ref={containerRef} className="relative flex items-center gap-1.5 overflow-hidden flex-1 min-w-0">
              {/* A hidden copy of the tags and the "+N" tag: what is measured to see how many fit. */}
              <div ref={measureRef} aria-hidden className="pointer-events-none invisible absolute flex gap-1.5 whitespace-nowrap">
                {card.tags.slice(0, MAX_VISIBLE_TAGS).map((tag) => (
                  <span key={tag} className={cn(TAG_PILL, "max-w-[120px] shrink-0")}>
                    <span className="truncate">{tag}</span>
                  </span>
                ))}
                <span className={TAG_PILL}>+{card.tags.length}</span>
              </div>
              {card.tags.slice(0, visibleCount).map((tag) => (
                <span key={tag} className={cn(TAG_PILL, "max-w-[120px] shrink-0")}>
                  <span className="truncate">{tag}</span>
                </span>
              ))}
              {card.tags.length > visibleCount && (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <span
                      onMouseEnter={() => setIsPopoverOpen(true)}
                      onMouseLeave={() => setIsPopoverOpen(false)}
                      className={cn(TAG_PILL, "shrink-0 cursor-pointer whitespace-nowrap hover:bg-primary/20 hover:border-primary/30 data-[state=open]:bg-primary/25 data-[state=open]:border-primary/40 transition-colors")}
                    >
                      +{card.tags.length - visibleCount}
                    </span>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="start"
                    className="w-auto p-2 flex flex-wrap gap-1.5 max-w-[280px]"
                    onMouseEnter={() => setIsPopoverOpen(true)}
                    onMouseLeave={() => setIsPopoverOpen(false)}
                  >
                    {card.tags.slice(visibleCount).map((tag) => (
                      <span key={tag} className={cn(TAG_PILL, "max-w-full")}>
                        <span className="truncate">{tag}</span>
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

      <ContextMenuContent className="min-w-48">
        <ContextMenuItem onClick={() => openNote(card.path, "tab")}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Open in new tab
        </ContextMenuItem>
        <ContextMenuItem onClick={() => openNote(card.path, "side")}>
          <ColumnsIcon className="mr-2 h-4 w-4" />
          Open to the side
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
        <ContextMenuItem onClick={() => openRename(card.path)}>
          <PencilIcon className="mr-2 h-4 w-4" />
          Rename file
          <ContextMenuShortcut>{formatShortcut(bindingFor("rename-file")!)}</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateNote(card.path)}>
          <CopyIcon className="mr-2 h-4 w-4" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => revealInFileManager(card.path)}>
          <FolderSearchIcon className="mr-2 h-4 w-4" />
          Reveal in file manager
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void copyPath(card.path)}>
          <ClipboardCopyIcon className="mr-2 h-4 w-4" />
          Copy path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => openDelete(card.path, label)}>
          <TrashIcon className="mr-2 h-4 w-4" />
          Delete note
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
