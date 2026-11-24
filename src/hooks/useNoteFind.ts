import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { toast } from "sonner";
import { findInText, firstMatchFrom, type FindRange } from "@/lib/find";
import { FIND_SHORTCUTS, matchesShortcut } from "@/lib/keybindings";
import { findInDoc, setSearch } from "@/components/editor/SearchHighlight";
import type { RawEditorHandle } from "@/components/editor/RawEditor";
import type { FindBarProps } from "@/components/editor/FindBar";

/** A selection longer than this is not a word to look for. */
const MAX_SEEDED_QUERY = 200;
/** Matches nearer than this to the edge of the page are scrolled to the middle (the find bar sits there). */
const SCROLL_MARGIN = 80;

interface UseNoteFindOptions {
  editor: Editor | null;
  /** The note shown; the bar closes when it changes. */
  path: string;
  isRawMode: boolean;
  rawContent: string;
  rawEditorRef: RefObject<RawEditorHandle | null>;
  /** Whether the text can be changed, so whether there is anything to replace into. */
  canEdit: boolean;
  /** Whether this pane has focus: only that pane answers Ctrl+F. */
  focused: boolean;
  /** The pane, so a shortcut typed in a dialog or the sidebar is left alone. */
  rootRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
}

export interface NoteFind {
  visible: boolean;
  /** What the editors should highlight: nothing while the bar is closed. */
  highlight: { query: string; activeIndex: number; caseSensitive: boolean; wholeWord: boolean };
  barProps: FindBarProps;
}

/**
 * Find and replace in the open note: the state behind the find bar, its
 * keyboard, and the edits it makes. It searches the rich text, or the markdown
 * source in the raw view, with plain text only: case and whole-word are the
 * only options.
 */
export function useNoteFind({
  editor,
  path,
  isRawMode,
  rawContent,
  rawEditorRef,
  canEdit,
  focused,
  rootRef,
  scrollRef,
}: UseNoteFindOptions): NoteFind {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [active, setActive] = useState(0);
  const [count, setCount] = useState(0);

  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  /** Where in the note the search starts from: the cursor, then wherever the last jump landed. */
  const anchorRef = useRef(0);
  const editorWasFocusedRef = useRef(false);
  const rawContentRef = useRef(rawContent);
  rawContentRef.current = rawContent;

  const replaceShown = replaceOpen && canEdit;
  const shown = count === 0 ? 0 : Math.min(active, count - 1);

  const matches = useCallback((): FindRange[] => {
    if (!query) return [];
    const options = { caseSensitive, wholeWord };
    if (isRawMode) return findInText(rawContentRef.current, query, options);
    return editor && !editor.isDestroyed ? findInDoc(editor.state.doc, query, options) : [];
  }, [editor, isRawMode, query, caseSensitive, wholeWord]);

  // A note is searched from the top again; the query stays, as in a code editor.
  useEffect(() => {
    setVisible(false);
    setReplaceOpen(false);
    anchorRef.current = 0;
  }, [path]);

  // The number of matches follows the text: typing in the note, or replacing, changes it.
  useEffect(() => {
    if (!visible) {
      setCount(0);
      return;
    }
    const sync = () => setCount(matches().length);
    sync();
    if (isRawMode || !editor || editor.isDestroyed) return;
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged) sync();
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
    // rawContent is a dependency so the raw view recounts after an edit.
  }, [visible, matches, isRawMode, editor, rawContent]);

  // A new query, or new options, start from the nearest match after where the search began.
  useEffect(() => {
    if (!visible) return;
    setActive(firstMatchFrom(matches(), anchorRef.current));
  }, [visible, matches]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setSearch(editor, {
      query: visible && !isRawMode ? query : "",
      activeIndex: shown,
      caseSensitive,
      wholeWord,
    });
  }, [editor, visible, isRawMode, query, shown, caseSensitive, wholeWord]);

  // Bring the current match into view, unless it already sits well within it.
  const hasMatches = count > 0;
  useEffect(() => {
    if (!visible || !query || !hasMatches || isRawMode || !editor) return;
    const frame = requestAnimationFrame(() => {
      const el = editor.view.dom.querySelector(".search-highlight-active");
      const box = scrollRef.current;
      if (!el || !box) return;
      const r = el.getBoundingClientRect();
      const b = box.getBoundingClientRect();
      if (r.top < b.top + SCROLL_MARGIN || r.bottom > b.bottom - SCROLL_MARGIN) {
        box.scrollTop += r.top + r.height / 2 - (b.top + b.height / 2);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, query, hasMatches, shown, caseSensitive, wholeWord, isRawMode, editor, scrollRef]);

  const focusField = useCallback((which: "find" | "replace") => {
    requestAnimationFrame(() => {
      const input = which === "replace" ? replaceInputRef.current : findInputRef.current;
      input?.focus();
      input?.select();
    });
  }, []);

  const open = useCallback(
    (withReplace: boolean) => {
      editorWasFocusedRef.current = !!editor && !editor.isDestroyed && editor.isFocused;
      // What is selected is what you want to find, if it is a word or a line.
      let seed = "";
      if (isRawMode) {
        seed = rawEditorRef.current?.selectedText() ?? "";
      } else if (editor && !editor.isDestroyed) {
        const { from, to } = editor.state.selection;
        if (from !== to) seed = editor.state.doc.textBetween(from, to, "\n");
        anchorRef.current = from;
      }
      // Closing selects the current match, so reopening would otherwise retype the query in the note's case.
      const seeded = seed.length > 0 && seed.length <= MAX_SEEDED_QUERY && !seed.includes("\n");
      if (seeded && seed.toLowerCase() !== query.toLowerCase()) setQuery(seed);
      setVisible(true);
      if (withReplace && canEdit) setReplaceOpen(true);
      focusField(withReplace && canEdit && (seeded || query) ? "replace" : "find");
    },
    [editor, isRawMode, rawEditorRef, canEdit, query, focusField],
  );

  const close = useCallback(() => {
    setVisible(false);
    setReplaceOpen(false);
    // Leave the cursor on the match you were at, so you can carry on from there.
    if (isRawMode) {
      rawEditorRef.current?.focus();
      return;
    }
    if (!editor || editor.isDestroyed) return;
    const at = query ? matches()[shown] : undefined;
    if (at) {
      editor.chain().focus().setTextSelection({ from: at.from, to: at.to }).run();
    } else if (editorWasFocusedRef.current) {
      editor.commands.focus();
    }
  }, [editor, isRawMode, rawEditorRef, query, matches, shown]);

  const go = useCallback(
    (delta: 1 | -1) => {
      if (count === 0) return;
      const next = (shown + delta + count) % count;
      setActive(next);
      const at = matches()[next];
      if (at) anchorRef.current = at.from;
    },
    [count, shown, matches],
  );

  /** Replace each range with the replacement text. */
  const replaceRanges = useCallback(
    (ranges: FindRange[]) => {
      if (!canEdit || ranges.length === 0) return;
      if (isRawMode) {
        rawEditorRef.current?.replaceRanges(ranges, replacement);
        return;
      }
      if (!editor || editor.isDestroyed) return;
      // One transaction: one undo for the lot. Going from the end keeps the earlier ranges where they are.
      const tr = editor.state.tr;
      for (let i = ranges.length - 1; i >= 0; i--) {
        const { from, to } = ranges[i];
        // Not deleteRange: that removes a paragraph whose whole text was the match.
        if (replacement) tr.insertText(replacement, from, to);
        else tr.delete(from, to);
      }
      editor.view.dispatch(tr);
    },
    [canEdit, isRawMode, rawEditorRef, editor, replacement],
  );

  const replaceOne = useCallback(() => {
    const all = matches();
    const target = all[Math.min(shown, all.length - 1)];
    if (!target) return;
    replaceRanges([target]);
    // Move on to the next match after the replacement, so Enter, Enter, Enter works through them.
    const resume = target.from + replacement.length;
    anchorRef.current = resume;
    const after = isRawMode
      ? findInText(
          rawContentRef.current.slice(0, target.from) + replacement + rawContentRef.current.slice(target.to),
          query,
          { caseSensitive, wholeWord },
        )
      : editor && !editor.isDestroyed
        ? findInDoc(editor.state.doc, query, { caseSensitive, wholeWord })
        : [];
    setActive(Math.max(0, after.findIndex((m) => m.from >= resume)));
    setCount(after.length);
  }, [matches, shown, replaceRanges, replacement, isRawMode, query, caseSensitive, wholeWord, editor]);

  const replaceAll = useCallback(() => {
    const all = matches();
    if (all.length === 0) return;
    replaceRanges(all);
    toast(all.length === 1 ? "Replaced 1 match" : `Replaced ${all.length} matches`);
  }, [matches, replaceRanges]);

  const toggleReplace = useCallback(() => {
    setReplaceOpen((v) => !v);
    focusField("find");
  }, [focusField]);

  // The keys of the pane: open, close, jump, options.
  const latest = useRef({ open, close, go, setCaseSensitive, setWholeWord, visible });
  latest.current = { open, close, go, setCaseSensitive, setWholeWord, visible };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!focused || e.isComposing) return;
      const target = e.target;
      const root = rootRef.current;
      // Not for a dialog, the palette or the sidebar, even while this pane has the focus.
      if (!root || !(target instanceof Node) || !(root.contains(target) || target === document.body)) return;
      const now = latest.current;
      if (matchesShortcut(e, FIND_SHORTCUTS.find)) {
        e.preventDefault();
        now.open(false);
      } else if (matchesShortcut(e, FIND_SHORTCUTS.replace)) {
        e.preventDefault();
        now.open(true);
      } else if (!now.visible) {
        return;
      } else if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        now.close();
      } else if (matchesShortcut(e, FIND_SHORTCUTS.next)) {
        e.preventDefault();
        now.go(1);
      } else if (matchesShortcut(e, FIND_SHORTCUTS.previous)) {
        e.preventDefault();
        now.go(-1);
      } else if (matchesShortcut(e, FIND_SHORTCUTS.caseSensitive)) {
        e.preventDefault();
        now.setCaseSensitive((v) => !v);
      } else if (matchesShortcut(e, FIND_SHORTCUTS.wholeWord)) {
        e.preventDefault();
        now.setWholeWord((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focused, rootRef]);

  const onFindKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
      e.preventDefault();
      go(e.shiftKey ? -1 : 1);
    },
    [go],
  );

  const onReplaceKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) replaceAll();
      else replaceOne();
    },
    [replaceOne, replaceAll],
  );

  const barProps = useMemo<FindBarProps>(
    () => ({
      query,
      onQueryChange: setQuery,
      current: shown + 1,
      total: count,
      onNext: () => go(1),
      onPrevious: () => go(-1),
      onClose: close,
      inputRef: findInputRef,
      onKeyDown: onFindKeyDown,
      caseSensitive,
      onToggleCaseSensitive: () => setCaseSensitive((v) => !v),
      wholeWord,
      onToggleWholeWord: () => setWholeWord((v) => !v),
      replace: canEdit
        ? {
            open: replaceShown,
            onToggle: toggleReplace,
            text: replacement,
            onTextChange: setReplacement,
            inputRef: replaceInputRef,
            onKeyDown: onReplaceKeyDown,
            onReplace: replaceOne,
            onReplaceAll: replaceAll,
          }
        : undefined,
    }),
    [
      query, shown, count, go, close, onFindKeyDown, caseSensitive, wholeWord, canEdit, replaceShown,
      toggleReplace, replacement, onReplaceKeyDown, replaceOne, replaceAll,
    ],
  );

  return {
    visible,
    highlight: {
      query: visible ? query : "",
      activeIndex: shown,
      caseSensitive,
      wholeWord,
    },
    barProps,
  };
}
