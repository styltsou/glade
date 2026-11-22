import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { formatTooltipDate } from "@/lib/dates";
import { isUntitled, splitExtension } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";

interface EditableTitleProps {
  title: string;
  path: string;
  created?: string | null;
  /** The title was finished from the keyboard, so typing continues in the body. */
  onDone?: () => void;
}

interface Edit {
  /** The note being retitled, which may no longer be the one this pane shows. */
  path: string;
  /** What the field held at first; "" while a note has no title yet. */
  initial: string;
  value: string;
}

/**
 * The note's first H1, as a field. Editing it never renames the file, except
 * the first time an untitled note gets a title.
 */
export function EditableTitle({ title, path, created, onDone }: EditableTitleProps) {
  const commitTitle = useStore((state) => state.commitTitle);
  const wantsFocus = useStore((state) => state.focusTitlePath === path);
  const clearFocusTitle = useStore((state) => state.clearFocusTitle);

  // An untitled note without an H1 has no title, only a placeholder.
  const shown = isUntitled(path) && title === splitExtension(path).stem ? "" : title;

  const [edit, setEdit] = useState<Edit | null>(null);
  // Read by blur and unmount, which must not see an edit that already ended.
  const editRef = useRef<Edit | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Shown while it is being written, so the old title doesn't flash back.
  const [saving, setSaving] = useState<Edit | null>(null);

  const update = (next: Edit | null) => {
    editRef.current = next;
    setEdit(next);
  };

  const commit = () => {
    const current = editRef.current;
    if (!current) return;
    update(null);
    const value = current.value.trim();
    const changed = value !== current.initial;
    // An unchanged title still names a file that is waiting for its name.
    if (!value || (!changed && !isUntitled(current.path))) return;
    setSaving({ ...current, value });
    void commitTitle(current.path, changed ? value : null).then((saved) => {
      setSaving(null);
      // Not saved: give back what was typed rather than lose it.
      if (!saved && !editRef.current) update(current);
    });
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    // The pane went on to another note with the field still open.
    if (editRef.current && editRef.current.path !== path) commitRef.current();
  }, [path]);

  useEffect(() => {
    if (!wantsFocus) return;
    clearFocusTitle();
    update({ path, initial: shown, value: shown });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsFocus]);

  const editingPath = edit?.path;
  useEffect(() => {
    if (editingPath !== undefined) inputRef.current?.focus();
  }, [editingPath]);

  // Removing a focused input fires no blur. StrictMode also runs this cleanup
  // on mount, so only commit if it really went away.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) commitRef.current();
      });
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter also confirms what an input method is composing.
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (e.key !== "Enter" && e.key !== "Escape") return;
    // Or the Enter would land in the body as a new line.
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Enter") commit();
    else update(null);
    onDone?.();
  };

  const display = saving?.path === path ? saving.value : shown;

  return (
    <div className="mb-2 flex items-center overflow-visible">
      {edit ? (
        <div className="relative inline-grid max-w-full items-center -ml-3 px-3 py-2 min-h-[52px] rounded-lg border border-primary/20 bg-background/50 shadow-sm">
          <span className="invisible overflow-hidden whitespace-pre text-[32px] font-bold font-sans tracking-tight leading-none px-1 h-full min-w-[50px]">
            {edit.value || "Untitled"}
          </span>
          <input
            ref={inputRef}
            type="text"
            aria-label="Title"
            placeholder="Untitled"
            value={edit.value}
            onChange={(e) => update({ ...edit, value: e.target.value })}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="absolute inset-x-3 inset-y-2 bg-transparent text-[32px] font-bold font-sans text-foreground tracking-tight underline decoration-primary decoration-2 underline-offset-8 outline-none px-1 h-8 leading-none placeholder:text-muted-foreground/50"
          />
        </div>
      ) : (
        <Tip label={created ? `Created ${formatTooltipDate(created)}` : undefined} align="start">
          <div
            className="group relative flex items-center w-fit border border-transparent rounded-lg -ml-3 px-3 py-2 cursor-pointer active:scale-[0.99] hover:bg-muted/30 hover:border-border"
            onClick={() => update({ path, initial: shown, value: shown })}
          >
            <h1
              className={cn(
                "text-[32px] font-bold font-sans tracking-tight leading-none select-none",
                display ? "text-foreground" : "text-muted-foreground/50",
              )}
            >
              {display || "Untitled"}
            </h1>
          </div>
        </Tip>
      )}
    </div>
  );
}
