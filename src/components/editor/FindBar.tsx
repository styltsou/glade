import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { ArrowDown, ArrowUp, CaseSensitive, ChevronDown, ChevronRight, Replace, ReplaceAll, WholeWord, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FIND_SHORTCUTS, formatShortcut } from "@/lib/keybindings";
import { cn } from "@/lib/utils";

export interface FindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  /** 1-based position of the current match. */
  current: number;
  total: number;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement>;
  onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  caseSensitive: boolean;
  onToggleCaseSensitive: () => void;
  wholeWord: boolean;
  onToggleWholeWord: () => void;
  /** Absent where the text cannot be changed (reading mode). */
  replace?: {
    open: boolean;
    onToggle: () => void;
    text: string;
    onTextChange: (text: string) => void;
    inputRef: RefObject<HTMLInputElement>;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    onReplace: () => void;
    onReplaceAll: () => void;
  };
  className?: string;
}

interface BarButtonProps {
  label: string;
  /** Shown after the label, e.g. "Ctrl+Alt+C". */
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  small?: boolean;
  children: ReactNode;
}

function BarButton({ label, hint, onClick, disabled, pressed, small, children }: BarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          // Keep the focus in the field being typed in.
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          className={cn(
            "press flex shrink-0 items-center justify-center rounded-sm transition-colors disabled:pointer-events-none disabled:opacity-40",
            small ? "size-5 rounded-[3px]" : "size-7",
            pressed ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="flex items-center gap-2">
          {label}
          {hint && <span className="opacity-60">{hint}</span>}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/** Find, and replace, in the open note. State and keys are in `useNoteFind`. */
export function FindBar({
  query,
  onQueryChange,
  current,
  total,
  onNext,
  onPrevious,
  onClose,
  inputRef,
  onKeyDown,
  caseSensitive,
  onToggleCaseSensitive,
  wholeWord,
  onToggleWholeWord,
  replace,
  className,
}: FindBarProps) {
  const hasMatches = total > 0;
  const status = !query ? "" : hasMatches ? `${current} of ${total}` : "No results";
  const mod = formatShortcut({ key: "Enter", mod: true });

  return (
    <div
      role="search"
      className={cn(
        "flex flex-col gap-1 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
    >
      <div className="flex h-7 items-center gap-0.5">
        {replace && (
          <BarButton
            label={replace.open ? "Hide replace" : "Show replace"}
            hint={formatShortcut(FIND_SHORTCUTS.replace)}
            onClick={replace.onToggle}
          >
            {replace.open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </BarButton>
        )}

        <div className="relative flex items-center">
          <Input
            ref={inputRef}
            type="text"
            aria-label="Find"
            placeholder="Find"
            spellCheck={false}
            autoComplete="off"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={onKeyDown}
            className={cn("h-7 w-52 rounded-sm bg-background py-0 pl-2 pr-[3.25rem] text-xs focus-visible:ring-1")}
          />
          <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-px">
            <BarButton
              small
              label="Match case"
              hint={formatShortcut(FIND_SHORTCUTS.caseSensitive)}
              pressed={caseSensitive}
              onClick={onToggleCaseSensitive}
            >
              <CaseSensitive className="size-3.5" />
            </BarButton>
            <BarButton
              small
              label="Whole word"
              hint={formatShortcut(FIND_SHORTCUTS.wholeWord)}
              pressed={wholeWord}
              onClick={onToggleWholeWord}
            >
              <WholeWord className="size-3.5" />
            </BarButton>
          </div>
        </div>

        <span
          aria-live="polite"
          className={cn(
            "min-w-[4.5rem] whitespace-nowrap px-1 text-center text-xs tabular-nums",
            query && !hasMatches ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {status}
        </span>

        <BarButton label="Previous match" hint="Shift+Enter" onClick={onPrevious} disabled={!hasMatches}>
          <ArrowUp className="size-4" />
        </BarButton>
        <BarButton label="Next match" hint="Enter" onClick={onNext} disabled={!hasMatches}>
          <ArrowDown className="size-4" />
        </BarButton>
        <BarButton label="Close" hint="Esc" onClick={onClose}>
          <X className="size-4" />
        </BarButton>
      </div>

      {replace?.open && (
        <div className="flex h-7 items-center gap-0.5 pl-[1.875rem]">
          <Input
            ref={replace.inputRef}
            type="text"
            aria-label="Replace with"
            placeholder="Replace"
            spellCheck={false}
            autoComplete="off"
            value={replace.text}
            onChange={(e) => replace.onTextChange(e.target.value)}
            onKeyDown={replace.onKeyDown}
            className="h-7 w-52 rounded-sm bg-background py-0 pl-2 pr-2 text-xs focus-visible:ring-1"
          />
          <BarButton label="Replace" hint="Enter" onClick={replace.onReplace} disabled={!hasMatches}>
            <Replace className="size-4" />
          </BarButton>
          <BarButton label="Replace all" hint={mod} onClick={replace.onReplaceAll} disabled={!hasMatches}>
            <ReplaceAll className="size-4" />
          </BarButton>
        </div>
      )}
    </div>
  );
}
