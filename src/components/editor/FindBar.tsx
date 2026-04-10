import { useEffect } from "react";
import { Search, X, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Replace, ReplaceAll, CaseSensitive, WholeWord, Regex } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface FindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  currentMatch: number;
  totalMatches: number;
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  onClose: () => void;
  isVisible: boolean;
  inputRef: React.RefObject<HTMLInputElement>;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  
  // Replace Props
  isReplaceVisible?: boolean;
  onToggleReplace?: () => void;
  replaceQuery?: string;
  onReplaceQueryChange?: (query: string) => void;
  onReplace?: () => void;
  onReplaceAll?: () => void;
  replaceInputRef?: React.RefObject<HTMLInputElement>;
  onReplaceKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  // Search option toggles
  caseSensitive?: boolean;
  onToggleCaseSensitive?: () => void;
  matchWholeWord?: boolean;
  onToggleMatchWholeWord?: () => void;
  useRegex?: boolean;
  onToggleUseRegex?: () => void;
  className?: string;
}

export function FindBar({
  query,
  onQueryChange,
  currentMatch,
  totalMatches,
  onNavigateNext,
  onNavigatePrev,
  onClose,
  isVisible,
  inputRef,
  onKeyDown,
  
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
  className
}: FindBarProps) {
  useEffect(() => {
    if (isVisible) {
      if (inputRef?.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }
  }, [isVisible, inputRef]);

  if (!isVisible) return null;

  return (
    <div className={cn("flex flex-col overflow-hidden bg-background border border-border shadow-md rounded-md p-1 gap-1", className)}>
      {/* Top Row: Find */}
      <div className="flex items-center gap-[2px] h-8">
        {onToggleReplace && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleReplace}
                className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground rounded-sm transition-colors cursor-pointer"
              >
                {isReplaceVisible ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Toggle Replace</p></TooltipContent>
          </Tooltip>
        )}
        
        <div className="relative flex items-center ml-0.5">
          {!onToggleReplace && <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />}
          <Input
            ref={inputRef}
            type="text"
            placeholder={useRegex ? "Find regex..." : "Find..."}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            className={cn("h-7 w-44 text-xs bg-background py-0 rounded-sm focus-visible:ring-1 pr-[64px]", onToggleReplace ? "pl-2" : "pl-7")}
          />
          {/* Option toggles rendered inside find input on the right */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-[1px]">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCaseSensitive}
                  className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-[3px] transition-colors cursor-pointer",
                    caseSensitive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <CaseSensitive className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Match Case (Alt+C)</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleMatchWholeWord}
                  disabled={useRegex}
                  className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-[3px] transition-colors cursor-pointer",
                    matchWholeWord && !useRegex ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                    "disabled:pointer-events-none disabled:opacity-40"
                  )}
                >
                  <WholeWord className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Whole Word (Alt+W)</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleUseRegex}
                  className={cn(
                    "h-5 w-5 flex items-center justify-center rounded-[3px] transition-colors cursor-pointer",
                    useRegex ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <Regex className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom"><p>Use Regex (Alt+R)</p></TooltipContent>
            </Tooltip>
          </div>
        </div>

        <span className="text-xs text-muted-foreground min-w-[70px] text-center tabular-nums whitespace-nowrap ml-1">
          {totalMatches > 0 ? `${currentMatch} of ${totalMatches}` : "No results"}
        </span>

        <div className="flex items-center gap-[2px] ml-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNavigatePrev}
                disabled={totalMatches === 0}
                className="h-7 w-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Previous match (Shift+Enter)</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={totalMatches === 0}
                className="h-7 w-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Next match (Enter)</p></TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom"><p>Close (Escape)</p></TooltipContent>
        </Tooltip>
      </div>

      {/* Bottom Row: Replace (collapsible) */}
      {isReplaceVisible && (
        <div className="flex items-center gap-[2px] h-8 pl-[30px]">
          <Input
            ref={replaceInputRef}
            type="text"
            placeholder="Replace with..."
            value={replaceQuery}
            onChange={(e) => onReplaceQueryChange?.(e.target.value)}
            onKeyDown={onReplaceKeyDown}
            className="h-7 w-44 pl-2 pr-2 text-xs bg-background py-0 rounded-sm focus-visible:ring-1 ml-0.5"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onReplace}
                disabled={totalMatches === 0}
                className="h-7 w-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50 ml-1"
              >
                <Replace className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Replace (Enter)</p></TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onReplaceAll}
                disabled={totalMatches === 0}
                className="h-7 w-7 flex items-center justify-center rounded-sm transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <ReplaceAll className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom"><p>Replace All (Alt+Enter)</p></TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
}
