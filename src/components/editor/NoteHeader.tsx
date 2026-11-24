import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Clock, Copy, Check, BookOpen, PencilOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FindBar, type FindBarProps } from "./FindBar";
import { useStore } from "@/store";
import { bindingFor, formatShortcut } from "@/lib/keybindings";

interface NoteHeaderProps {
  notePath: string;
  noteTitle: string;
  dateLabel?: string | null;
  saveStatus: "unsaved" | "saved" | "idle";
  isEditMode?: boolean;
  hasHeadings?: boolean;
  isTocOpen?: boolean;
  onToggleToc?: () => void;
  /** The find bar, shown while there is one. */
  find?: FindBarProps | null;
}

export function NoteHeader({ 
  notePath, 
  noteTitle,
  dateLabel,
  saveStatus,
  isEditMode = false,
  hasHeadings = false,
  isTocOpen = false,
  onToggleToc,
  find = null,
}: NoteHeaderProps) {
  const setNoteEditMode = useStore((s) => s.setNoteEditMode);
  const segments = notePath.split("/");
  const parentPath = segments.slice(0, -1).join("/") || null;
  
  const [copied, setCopied] = useState(false);

  const handleCopyMarkdown = useCallback(async () => {
    if (!notePath) return;
    try {
      const raw = await invoke<string>("read_note_raw", { path: notePath });
      const stripped = raw.replace(/^---[\s\S]*?---\s*\n?/, "");
      
      let finalMarkdown = stripped.trimStart();
      if (noteTitle && !finalMarkdown.startsWith("# ")) {
        finalMarkdown = `# ${noteTitle}\n\n${finalMarkdown}`;
      }
      
      await writeText(finalMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [notePath, noteTitle]);


  // Autosave normally clears "unsaved" within a second, so only say so when it lingers
  // (a failed save, or an external-edit conflict that blocks writing).
  const [unsavedLingers, setUnsavedLingers] = useState(false);
  useEffect(() => {
    if (saveStatus !== "unsaved") {
      setUnsavedLingers(false);
      return;
    }
    const timer = setTimeout(() => setUnsavedLingers(true), 3000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  return (
    <div className="flex items-center justify-between h-10 shrink-0 select-none relative">
      {/* Floating FindBar — positioned absolutely in top-right of the editor */}
      {find && (
        <div className="absolute top-full right-4 z-50 mt-1">
          <FindBar {...find} />
        </div>
      )}

      <div className="flex items-center pl-3 h-full min-w-0">
        <Breadcrumbs path={parentPath} file={notePath} />
      </div>

      <div className={cn("flex items-center gap-1 h-full shrink-0 text-[13px] sm:text-[14px] text-muted-foreground self-center -mt-px pr-1")}>
        {unsavedLingers && (
          <span aria-live="polite" className="mr-1 text-xs text-foreground/80 animate-in fade-in-0 duration-150">
            Unsaved
          </span>
        )}

        {/* Flag read-only mode so it is clear why typing does nothing. Click to start editing. */}
        {!isEditMode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Reading mode. Switch to editing"
                onClick={() => setNoteEditMode(notePath, true)}
                className="press flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:text-foreground"
              >
                <PencilOff className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="flex items-center gap-2">
                Reading mode
                <span className="opacity-60">{formatShortcut(bindingFor("toggle-edit-mode")!)}</span>
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {dateLabel && (
          <span className="text-muted-foreground text-xs hidden @[40rem]/pane:flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {dateLabel}
          </span>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                !hasHeadings ? "text-muted-foreground/50 cursor-not-allowed" : "",
                isTocOpen && hasHeadings && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
              )}
              onClick={onToggleToc}
              disabled={!hasHeadings}
            >
              <BookOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Table of Contents ({formatShortcut(bindingFor("toggle-toc")!)})</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                "text-muted-foreground",
                copied && "bg-primary/10 text-primary"
              )}
              onClick={handleCopyMarkdown}
              disabled={!notePath}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Copy as Markdown</p>
          </TooltipContent>
        </Tooltip>

      </div>

    </div>
  );
}