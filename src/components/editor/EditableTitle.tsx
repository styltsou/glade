import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store";
import { formatTooltipDate } from "@/lib/dates";
import { isUntitled, splitExtension } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { PASTE_NOTE_EVENT, splitPastedNote, type PasteNoteDetail } from "@/lib/pastedNote";
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

const titleSurface = "relative -ml-3 max-w-full rounded-lg border px-3 py-2";
const titleText = "font-sans text-[32px] font-bold leading-none tracking-tight";

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
    // Escape keeps what was typed too: the title is part of the note, like its
    // body, and leaving it by any way keeps it.
    commit();
    onDone?.();
  };

  /**
   * More than a line pasted is a note: its title stays here and the rest goes to
   * the body. Into a note with nothing in it yet, it becomes that whole note.
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const current = editRef.current;
    const note = current && splitPastedNote(e.clipboardData.getData("text/plain"));
    if (!current || !note) return;
    const detail: PasteNoteDetail = { path: current.path, note, handled: null, done: Promise.resolve() };
    window.dispatchEvent(new CustomEvent(PASTE_NOTE_EVENT, { detail }));
    // No editor to take the body (raw Markdown is showing): an ordinary paste.
    if (!detail.handled) return;
    e.preventDefault();
    // Nothing in it read as a title: it all went to the body, and the title is still to be typed.
    if (!note.title) return;
    if (detail.handled === "whole") {
      // The editor writes it, title and all.
      update(null);
      const written = { ...current, value: note.title };
      setSaving(written);
      void detail.done.finally(() => setSaving((s) => (s === written ? null : s)));
      return;
    }
    update({ ...current, value: note.title });
    commit();
    onDone?.();
  };

  const display = saving?.path === path ? saving.value : shown;

  return (
    <div className="mb-2 flex items-center overflow-visible">
      {edit ? (
        <div className={cn(titleSurface, "inline-block border-primary bg-muted/60")}>
          <span aria-hidden="true" className={cn(titleText, "invisible block overflow-hidden whitespace-pre")}>
            {edit.value || "Untitled"}
          </span>
          {/* Its box reaches past the text by 4px each way, as padding, so the
              input does not clip accents and overhangs; the text stays put. */}
          <input
            ref={inputRef}
            type="text"
            aria-label="Title"
            placeholder="Untitled"
            value={edit.value}
            onChange={(e) => update({ ...edit, value: e.target.value })}
            onBlur={commit}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className={cn(titleText, "absolute inset-x-2 top-1 h-10 w-[calc(100%-1rem)] min-w-0 border-0 bg-transparent px-1 py-1 text-foreground outline-none placeholder:text-muted-foreground/50")}
          />
        </div>
      ) : (
        <Tip label={created ? `Created ${formatTooltipDate(created)}` : undefined} align="start">
          <div
            className={cn(titleSurface, "flex w-fit items-center border-transparent cursor-pointer transition-colors hover:border-border/50 hover:bg-muted/40")}
            onClick={() => update({ path, initial: shown, value: shown })}
          >
            <h1
              className={cn(
                titleText, "select-none",
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
