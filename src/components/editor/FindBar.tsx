import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  replace?: {
    /** The text cannot be changed (reading mode): the toggle is dimmed and the row stays shut. */
    disabled: boolean;
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
  /** Why it is disabled, said in its tooltip. The button gets no pointer events, so its wrapper shows the cursor and the tooltip. */
  disabledReason?: string;
  pressed?: boolean;
  small?: boolean;
  children: ReactNode;
}

function BarButton({ label, hint, onClick, disabled, disabledReason, pressed, small, children }: BarButtonProps) {
  const button = (
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
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {disabled ? <span className="flex cursor-not-allowed">{button}</span> : button}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="flex items-center gap-2">
          {disabled && disabledReason ? disabledReason : label}
          {hint && !disabled && <span className="opacity-60">{hint}</span>}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * A strong ease-out: it moves most of the way in the first frames, so the card
 * answers the keypress at once. Find is opened and closed from the keyboard
 * all day, so both it and the replace row stay barely there: ~90ms in, ~60ms out.
 */
export const FIND_EASE = [0.23, 1, 0.32, 1] as const;

/** Both inputs share this, so find and replace line up. */
const FIELD = "h-7 w-56 rounded-sm bg-background py-0 pl-2 text-xs focus-visible:ring-1 @[40rem]/pane:w-64";

/** The buttons after each field: room for three, so the two rows end together. */
const BUTTONS = "flex w-[5.25rem] items-center";

/**
 * Find, and replace, in one card that hangs from the top of the note toolbar.
 * The find row sits where the toolbar's buttons are; the replace row opens
 * below it, with its field and buttons in the same columns. State and keys are
 * in `useNoteFind`; the header animates the card in and out.
 */
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
  const reduceMotion = useReducedMotion();
  const hasMatches = total > 0;
  const status = !query ? "" : hasMatches ? `${current} of ${total}` : "No results";
  const mod = formatShortcut({ key: "Enter", mod: true });

  return (
    <div
      role="search"
      className={cn(
        // Tucked into the pane's top-right corner: no top or right border, only the
        // bottom-left corner rounded, and a shadow that falls only below it.
        "flex flex-col rounded-bl-md border-b border-l border-border bg-popover p-1 text-popover-foreground shadow-[0_8px_16px_-8px_rgb(0_0_0/0.35)]",
        className,
      )}
    >
      <div className="flex h-7 items-center gap-1">
        {/* The first column: the replace toggle, with room under it. */}
        <div className="flex size-7 shrink-0 items-center justify-center">
          {replace && (
            <BarButton
              label={replace.open ? "Hide replace" : "Show replace"}
              hint={formatShortcut(FIND_SHORTCUTS.replace)}
              disabled={replace.disabled}
              disabledReason="Replace isn't available in reading mode"
              onClick={replace.onToggle}
            >
              {replace.open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </BarButton>
          )}
        </div>

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
            className={cn(FIELD, "pr-[6.75rem]")}
          />
          <span
            aria-live="polite"
            className={cn(
              "pointer-events-none absolute right-[3.1rem] top-1/2 -translate-y-1/2 whitespace-nowrap text-xs tabular-nums",
              query && !hasMatches ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {status}
          </span>
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

        <div className={BUTTONS}>
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
      </div>

      <AnimatePresence initial={false}>
        {replace?.open && (
          <motion.div
            key="replace"
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: reduceMotion ? 0.06 : 0.1, ease: FIND_EASE } }}
            exit={{ height: 0, opacity: 0, transition: { duration: reduceMotion ? 0.05 : 0.07, ease: FIND_EASE } }}
          >
            <div className="flex h-7 items-center gap-1 pt-1 box-content">
              <div className="size-7 shrink-0" />
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
                className={cn(FIELD, "pr-2")}
              />
              <div className={BUTTONS}>
                <BarButton label="Replace" hint="Enter" onClick={replace.onReplace} disabled={!hasMatches}>
                  <Replace className="size-4" />
                </BarButton>
                <BarButton label="Replace all" hint={mod} onClick={replace.onReplaceAll} disabled={!hasMatches}>
                  <ReplaceAll className="size-4" />
                </BarButton>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
