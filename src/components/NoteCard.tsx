import { useState, useCallback } from "react";
import { Pin as DrawingPinFilledIcon, PinOff as PinOffIcon, MoreHorizontal, Trash2 as TrashIcon, Pencil as PencilIcon, Copy as CopyIcon } from "lucide-react";
import { useVaultStore } from "@/stores/useVaultStore";
import { useHomeStore } from "@/stores/useHomeStore";
import { motion } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteCard as NoteCardType } from "@/types";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

interface NoteCardProps {
  card: NoteCardType;
  onOpen?: () => void;
  showPin?: boolean;
}

export function NoteCard({ card, onOpen, showPin = true }: NoteCardProps) {
  const { selectNote, deleteEntry, renameNote, duplicateNote } = useVaultStore();
  const { pinNote, unpinNote } = useHomeStore();
  
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleClick = useCallback(async () => {
    await selectNote(card.path);
    onOpen?.();
  }, [card.path, selectNote, onOpen]);

  const handlePin = async () => {
    await pinNote(card.path);
  };

  const handleUnpin = async () => {
    await unpinNote(card.path);
  };

  const handleDelete = async () => {
    await deleteEntry(card.path);
    setIsDeleteOpen(false);
  };

  const handleRename = async (newTitle: string) => {
    await renameNote(card.path, newTitle);
  };

  const handleDuplicate = async () => {
    await duplicateNote(card.path);
  };

  const tags = card.tags.slice(0, 3);
  const dateLabel = card.modified ? formatShortDate(card.modified) : "";

  return (
    <>
      <motion.div
        onClick={handleClick}
        tabIndex={0}
        role="button"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
        className="
          group relative flex flex-col gap-2 text-left w-full
          rounded-xl p-3.5 cursor-pointer
          bg-card border border-border
          hover:border-foreground/20 hover:bg-muted/50
          hover:shadow-md
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        {/* Actions (Pin + Dropdown) */}
        <div className="absolute top-2.5 right-2.5 flex items-center gap-1 z-10" onClick={(e) => e.stopPropagation()}>
          {showPin && card.pinned && (
            <span className="text-muted-foreground mr-1">
              <DrawingPinFilledIcon className="h-2.5 w-2.5 fill-current" />
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="cursor-pointer p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" avoidCollisions={true} sideOffset={4}>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setIsRenameOpen(true); }}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(); }}>
                <CopyIcon className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {card.pinned ? (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleUnpin(); }}>
                  <PinOffIcon className="mr-2 h-4 w-4" />
                  Unpin note
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePin(); }}>
                  <DrawingPinFilledIcon className="mr-2 h-4 w-4" />
                  Pin note
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={(e) => { e.stopPropagation(); setIsDeleteOpen(true); }}>
                <TrashIcon className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Title */}
        <span className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2 pr-8">
          {card.title}
        </span>

        {/* Preview */}
        {card.preview && (
          <span className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
            {card.preview}
          </span>
        )}

        {/* Footer: tags + date */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-3">
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-[12px] font-medium text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 leading-none truncate"
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
      </motion.div>
      <RenameDialog
        isOpen={isRenameOpen}
        onOpenChange={setIsRenameOpen}
        initialTitle={card.title}
        onRename={handleRename}
      />
      <DeleteConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        name={card.title}
        onConfirm={handleDelete}
      />
    </>
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
