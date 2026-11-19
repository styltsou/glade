import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Clock, Copy, Check, BookOpen, PencilOff } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FindBar } from "./FindBar";
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
  findVisible?: boolean;
  findQuery?: string;
  onFindQueryChange?: (query: string) => void;
  currentMatch?: number;
  totalMatches?: number;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  onFindClose?: () => void;
  findInputRef?: React.RefObject<HTMLInputElement>;
  onFindKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Replace
  isReplaceVisible?: boolean;
  onToggleReplace?: () => void;
  replaceQuery?: string;
  onReplaceQueryChange?: (query: string) => void;
  onReplace?: () => void;
  onReplaceAll?: () => void;
  replaceInputRef?: React.RefObject<HTMLInputElement>;
  onReplaceKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Search options
  caseSensitive?: boolean;
  onToggleCaseSensitive?: () => void;
  matchWholeWord?: boolean;
  onToggleMatchWholeWord?: () => void;
  useRegex?: boolean;
  onToggleUseRegex?: () => void;
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
  findVisible = false,
  findQuery = "",
  onFindQueryChange,
  currentMatch = 0,
  totalMatches = 0,
  onNavigateNext,
  onNavigatePrev,
  onFindClose,
  findInputRef,
  onFindKeyDown,
  isReplaceVisible = false,
  onToggleReplace,
  replaceQuery = "",
  onReplaceQueryChange,
  onReplace,
  onReplaceAll,
  replaceInputRef,
  onReplaceKeyDown,
  caseSensitive = false,
  onToggleCaseSensitive,
  matchWholeWord = false,
  onToggleMatchWholeWord,
  useRegex = false,
  onToggleUseRegex,
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


  return (
    <div className="flex items-center justify-between h-10 shrink-0 select-none relative">
      {/* Floating FindBar — positioned absolutely in top-right of the editor */}
      {findVisible && (
        <div className="absolute top-full right-4 z-50 mt-1">
          <FindBar
            isVisible={findVisible}
            query={findQuery}
            onQueryChange={onFindQueryChange || (() => {})}
            currentMatch={currentMatch}
            totalMatches={totalMatches}
            onNavigateNext={onNavigateNext || (() => {})}
            onNavigatePrev={onNavigatePrev || (() => {})}
            onClose={onFindClose || (() => {})}
            inputRef={findInputRef || { current: null }}
            onKeyDown={onFindKeyDown || (() => {})}
            isReplaceVisible={isReplaceVisible}
            onToggleReplace={onToggleReplace}
            replaceQuery={replaceQuery}
            onReplaceQueryChange={onReplaceQueryChange}
            onReplace={onReplace}
            onReplaceAll={onReplaceAll}
            replaceInputRef={replaceInputRef}
            onReplaceKeyDown={onReplaceKeyDown}
            caseSensitive={caseSensitive}
            onToggleCaseSensitive={onToggleCaseSensitive}
            matchWholeWord={matchWholeWord}
            onToggleMatchWholeWord={onToggleMatchWholeWord}
            useRegex={useRegex}
            onToggleUseRegex={onToggleUseRegex}
          />
        </div>
      )}

      <div className="flex items-center pl-3 h-full min-w-0">
        <Breadcrumbs path={parentPath} activeItem={noteTitle} />
      </div>

      <div className="flex items-center gap-1 pr-3 h-full shrink-0 text-[13px] sm:text-[14px] text-muted-foreground self-center -mt-px">
        {saveStatus !== "idle" && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground animate-in fade-in-0 duration-150">
            <span className={cn("size-1.5 rounded-full", saveStatus === "saved" ? "bg-emerald-500" : "bg-amber-500")} />
            <span className="hidden @[34rem]/pane:inline">{saveStatus === "saved" ? "Saved" : "Unsaved"}</span>
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
            <p>Table of Contents (Ctrl+Shift+T)</p>
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