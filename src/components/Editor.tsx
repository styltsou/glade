import { useEditor, type UseEditorOptions } from "@tiptap/react";
import { FileText as FileTextIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { NoteHeader } from "@/components/editor/NoteHeader";
import { TableOfContents, TOC_GUTTER } from "@/components/editor/TableOfContents";
import { SearchHighlight } from "@/components/editor/SearchHighlight";
import type { RawEditorHandle } from "@/components/editor/RawEditor";
import { useNoteFind } from "@/hooks/useNoteFind";
import { toast } from "sonner";
import { useStore } from "@/store";
import { registerEditor } from "@/lib/fileChanges";
import { isDocumentEdit } from "@/lib/editorUpdates";
import { extensions } from "./editor/extensions";
import { useSaveNote } from "@/hooks/useSaveNote";
import { splitNoteTitle, restoreNoteTitle, type NoteTitle } from "@/lib/noteTitle";
import { hasNoteTitle, headingText, PASTE_NOTE_EVENT, type PasteNoteDetail } from "@/lib/pastedNote";
import { isUntitled } from "@/lib/paths";
import { useMarkdownFidelity } from "@/hooks/useMarkdownFidelity";
import { createBlockDragHandleExtension } from "@/components/editor/blocks/blockDragHandle";
import { BlockHandles } from "@/components/editor/blocks/BlockHandles";
import { PreviewRail } from "@/components/editor/PreviewRail";
import { ConflictBanner } from "@/components/editor/ConflictBanner";
import { isAbsolutePath } from "@/lib/links";
import { PaneProvider } from "@/components/editor/PaneContext";
import { cn } from "@/lib/utils";

export interface EditorProps {
  /** Note shown by this pane. */
  path: string;
  /** Whether this pane has focus (the one the global "active note" mirrors). */
  focused: boolean;
  onFocus: () => void;
  /** Index of this pane within its tab. */
  paneIndex: number;
  /** Whether the tab is split (shows the focus indicator). */
  split: boolean;
}

export function Editor({ path, focused, onFocus, split }: EditorProps) {
  const activeNote = useStore(
    (state) => state.noteCache[path] ?? (state.activeNote?.path === path ? state.activeNote : null),
  );
  const fetchNote = useStore((state) => state.fetchNote);
  const [overlayEl, setOverlayEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    void fetchNote(path);
  }, [path, fetchNote]);
  const saveNote = useStore((state) => state.saveNote);
  const selectNote = useStore((state) => state.selectNote);
  const noteScrollPositions = useStore((state) => state.noteScrollPositions);
  const updateNoteScrollPosition = useStore(
    (state) => state.updateNoteScrollPosition,
  );
  const tocOpen = useStore((state) => state.tocOpen);
  const toggleToc = useStore((state) => state.toggleToc);
  const reduceMotion = useReducedMotion();
  const tocWidth = useStore((state) => state.tocWidth);
  const noteEditMode = useStore((state) => state.noteEditMode);
  const setNoteEditMode = useStore((state) => state.setNoteEditMode);
  const isRawModeMap = useStore((state) => state.isRawMode);
  const toggleRawModeFromStore = useStore((state) => state.toggleRawMode);

  const isEditMode = activeNote ? noteEditMode[activeNote.path] ?? false : false;
  const isRawMode = activeNote ? isRawModeMap[activeNote.path] ?? false : false;

  const handleExitEditMode = useCallback(() => {
    if (activeNote) {
      setNoteEditMode(activeNote.path, false);
    }
  }, [activeNote, setNoteEditMode]);

  const [rawContent, setRawContent] = useState("");
  const rawTitleRef = useRef<NoteTitle>(splitNoteTitle(""));
  const [tocHeadings, setTocHeadings] = useState<{ level: number; text: string; pos: number }[]>([]);
  const mermaidFullscreenOpen = useStore((state) => state.mermaidFullscreenOpen);
  const paneRef = useRef<HTMLDivElement>(null);
  const rawEditorRef = useRef<RawEditorHandle>(null);

  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastSavedContentRef = useRef<string>("");
  const latestContentRef = useRef<string>("");
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pasteNoteRef = useRef<(event: ClipboardEvent) => boolean>(() => false);
  const isLoadingRef = useRef(false);
  const cursorPositionRef = useRef<number | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const lastFocusedPositionRef = useRef<number | null>(null);
  const { snapshot: snapshotFidelity, getMarkdown, hasTitle } = useMarkdownFidelity();

  // A change made by another program while we hold unsaved edits.
  const [conflict, setConflict] = useState<null | { kind: "modified" | "removed" }>(null);
  const conflictRef = useRef(false);
  conflictRef.current = conflict !== null;
  const externalEvent = useStore((state) => state.externalEvent);
  const reloadNote = useStore((state) => state.reloadNote);

  const { saveStatus, setSaveStatusWithRef, saveNow, scheduleAutosave } = useSaveNote({
    focused,
    activeNote,
    saveNote,
    latestContentRef,
    lastSavedContentRef,
    pendingSaveRef,
    savedTimeoutRef,
    blockedRef: conflictRef,
  });

  // Lets renames and moves flush this editor and carry it to the new path.
  useEffect(
    () =>
      registerEditor({
        path: () => currentPathRef.current,
        content: () => latestContentRef.current,
        unsaved: () => latestContentRef.current !== lastSavedContentRef.current,
        blocked: () => conflictRef.current,
        markSaved: (content) => {
          const previous = lastSavedContentRef.current;
          lastSavedContentRef.current = content;
          if (latestContentRef.current === content) setSaveStatusWithRef("idle");
          return () => {
            lastSavedContentRef.current = previous;
            setSaveStatusWithRef("unsaved");
          };
        },
        follow: (to) => {
          currentPathRef.current = to;
        },
      }),
    [setSaveStatusWithRef],
  );

  // One set of gutter controls (+ and drag grip) per editor instance.
  const blockControls = useMemo(createBlockDragHandleExtension, []);

  // These two must keep their identity: after any render in which they differ,
  // useEditor re-applies them with two more full view updates (so on every keystroke).
  const editorExtensions = useMemo(
    () => [
      ...extensions,
      blockControls.extension,
      SearchHighlight,
    ],
    [blockControls],
  );
  const editorProps = useMemo<UseEditorOptions["editorProps"]>(
    () => ({
      attributes: { class: "tiptap-editor" },
      handlePaste: (_view, event) => pasteNoteRef.current(event),
      handleClickOn: (_view, _pos, node, _nodePos) => {
        if (node.type.name === "mention" && node.attrs.id) {
          const { idToPath } = useStore.getState();
          const targetPath = idToPath[node.attrs.id];

          if (targetPath) {
            selectNote(targetPath);
          } else {
            toast.error("Note not found", { description: "It may have been deleted." });
          }
          return true;
        }
        return false;
      },
    }),
    [selectNote],
  );

  const editor = useEditor({
    extensions: editorExtensions,
    content: "",
    editorProps,
    onSelectionUpdate: ({ editor }) => {
      if (!isLoadingRef.current) {
        cursorPositionRef.current = editor.state.selection.from;
        if (editor.isFocused) {
          lastFocusedPositionRef.current = editor.state.selection.from;
        }
      }
    },
    onUpdate: (update) => {
      if (!activeNote || isLoadingRef.current) return;

      if (!isDocumentEdit(update)) return;

      const { editor } = update;
      const markdown = getMarkdown(editor);

      // Skip if content hasn't actually changed
      if (markdown === latestContentRef.current) return;

      cursorPositionRef.current = editor.state.selection.from;
      latestContentRef.current = markdown;

      if (markdown !== lastSavedContentRef.current) {
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
          savedTimeoutRef.current = null;
        }
        setSaveStatusWithRef("unsaved");
        scheduleAutosave();
      }
    },
  });

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || !activeNote?.path) return;

    if (scrollSaveTimerRef.current) {
      clearTimeout(scrollSaveTimerRef.current);
    }

    scrollSaveTimerRef.current = setTimeout(() => {
      const position = scrollRef.current?.scrollTop ?? 0;
      updateNoteScrollPosition(activeNote.path, position);
    }, 150);
  }, [activeNote?.path, updateNoteScrollPosition]);

  // Load content when switching notes
  useLayoutEffect(() => {
    if (editor && activeNote) {
      const pathChanged = currentPathRef.current !== activeNote.path;
      (editor.storage as any).paneNote.path = activeNote.path;
      isLoadingRef.current = true;

      // Save scroll position for the *previous* note before switching
      if (pathChanged && currentPathRef.current && scrollRef.current) {
        updateNoteScrollPosition(
          currentPathRef.current,
          scrollRef.current.scrollTop,
        );
      }

      // Wait for any in-flight save to complete before proceeding
      if (pendingSaveRef.current) {
        (async () => {
          await pendingSaveRef.current;
          pendingSaveRef.current = null;
        })();
      }

      const left = pathChanged ? currentPathRef.current : null;
      const leftContent = latestContentRef.current;
      let leftSaved: Promise<void> | null = null;

      // Save any unsaved changes before switching
      if (latestContentRef.current !== lastSavedContentRef.current) {
        const contentToSave = latestContentRef.current;
        lastSavedContentRef.current = contentToSave;
        const pathToSave = pathChanged ? currentPathRef.current : activeNote.path;
        if (pathToSave) {
          leftSaved = (async () => {
            try {
              await saveNote(pathToSave, contentToSave);
            } catch {
              // Keep unsaved status on error
            } finally {
              if (savedTimeoutRef.current) {
                clearTimeout(savedTimeoutRef.current);
                savedTimeoutRef.current = null;
              }
              setSaveStatusWithRef("idle");
            }
          })();
        }
      }
      if (left && !conflictRef.current) void useStore.getState().leaveNote(left, leftContent, leftSaved);

      const currentMarkdown = getMarkdown(editor);

      // Only update content if it actually changed
      if (pathChanged || currentMarkdown !== activeNote.body) {
        // Set refs BEFORE setContent so onUpdate sees correct values
        lastSavedContentRef.current = activeNote.body || "";
        latestContentRef.current = activeNote.body || "";
        // Use setContent with emitUpdate: false to avoid focusing
        const title = splitNoteTitle(activeNote.body || "");
        editor.commands.setContent(title.body, { emitUpdate: false });
        snapshotFidelity(editor, activeNote.body || "");
        rawTitleRef.current = title;
        setRawContent(title.body);

        // Manually trigger TOC update since emitUpdate: false skips the event
        setTimeout(() => {
          const headings: { level: number; text: string; pos: number }[] = [];
          editor.state.doc.descendants((node, pos) => {
            if (node.type.name === "heading") {
              const text = node.textContent.trim();
              if (text) {
                headings.push({ level: node.attrs.level, text, pos });
              }
            }
            return true;
          });
          setTocHeadings(headings);
        }, 0);

        // Reset cursor position tracking for new note
        cursorPositionRef.current = null;
      }

      // Restore scroll position for the *new* note immediately after content is set
      if (pathChanged || currentMarkdown !== activeNote.body) {
        const savedPosition = noteScrollPositions[activeNote.path];
        if (scrollRef.current) {
          scrollRef.current.scrollTop = savedPosition || 0;
        }

        // Only restore cursor if in edit mode - not in read mode
        if (isEditMode) {
          if (lastFocusedPositionRef.current !== null) {
            requestAnimationFrame(() => {
              if (editor && lastFocusedPositionRef.current !== null) {
                const pos = lastFocusedPositionRef.current;
                const docSize = editor.state.doc.content.size;
                if (pos >= 0 && pos <= docSize) {
                  editor.commands.setTextSelection({ from: pos, to: pos });
                }
              }
            });
          } else {
            requestAnimationFrame(() => {
              if (editor) {
                editor.commands.setTextSelection({ from: 0, to: 0 });
              }
            });
          }
        }
      }

      if (pathChanged) {
        currentPathRef.current = activeNote.path;
      }

      setSaveStatusWithRef("idle");
      isLoadingRef.current = false;
    }
  }, [
    activeNote?.path,
    activeNote?.body,
    editor,
    updateNoteScrollPosition,
    noteScrollPositions,
  ]);

  // Switching tabs or closing a pane unmounts this editor: never lose unsaved edits.
  useEffect(() => {
    return () => {
      const path = currentPathRef.current;
      if (!path || conflictRef.current) return;
      const content = latestContentRef.current;
      let saved: Promise<void> | null = null;
      if (content !== lastSavedContentRef.current) {
        saved = useStore.getState().saveNote(path, content);
        saved.catch((e) => toast.error(`Couldn't save "${path}"`, { description: String(e) }));
      }
      void useStore.getState().leaveNote(path, content, saved);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current);
      }
      if (savedTimeoutRef.current) {
        clearTimeout(savedTimeoutRef.current);
      }
    };
  }, []);

  // Toggle raw mode using store action
  const handleToggleRawMode = useCallback(async () => {
    if (!editor || !activeNote) return;
    const currentlyRaw = isRawModeMap[activeNote.path] ?? false;
    if (currentlyRaw) {
      isLoadingRef.current = true;
      const source = restoreNoteTitle(rawTitleRef.current, rawContent);
      latestContentRef.current = source;
      editor.commands.setContent(splitNoteTitle(source).body, { emitUpdate: false });
      snapshotFidelity(editor, source);
      toggleRawModeFromStore(activeNote.path);
      if (source !== lastSavedContentRef.current) {
        setSaveStatusWithRef("unsaved");
        await saveNow();
      }
      setTimeout(() => { isLoadingRef.current = false; }, 100);
    } else {
      const title = splitNoteTitle(getMarkdown(editor));
      rawTitleRef.current = title;
      setRawContent(title.body);
      toggleRawModeFromStore(activeNote.path);
    }
  }, [editor, isRawModeMap, rawContent, activeNote, saveNow, toggleRawModeFromStore]);

  /**
   * A whole note pasted into an empty one, from the body or the title field: shown
   * as if it had been opened, so its H1 is the title and the rest the body. It is
   * saved at once, and a file still called untitled is named after it.
   */
  /**
   * Save what the editor now shows as `source`, showing its title in the title
   * field at once rather than after the write, and name a file still called
   * untitled after it.
   */
  const settleSource = useCallback(
    async (path: string, source: string) => {
      const heading = splitNoteTitle(source).heading;
      useStore.setState((state) => {
        const note = state.noteCache[path];
        if (!note) return {};
        const next = { ...note, body: source, title: heading ? headingText(heading) : note.title };
        return {
          noteCache: { ...state.noteCache, [path]: next },
          activeNote: state.activeNote?.path === path ? next : state.activeNote,
        };
      });
      latestContentRef.current = source;
      setSaveStatusWithRef("unsaved");
      await saveNow();
      if (heading && isUntitled(path) && currentPathRef.current === path) {
        await useStore.getState().commitTitle(path, null);
      }
    },
    [setSaveStatusWithRef, saveNow],
  );

  const adoptNote = useCallback(
    async (source: string, focus = true) => {
      if (!editor || !activeNote) return;
      const title = splitNoteTitle(source);
      isLoadingRef.current = true;
      // Emitted for the outline; the edit itself is saved below.
      const chain = editor.chain().setContent(title.body, { emitUpdate: true });
      (focus ? chain.focus("end") : chain).run();
      snapshotFidelity(editor, source);
      rawTitleRef.current = title;
      setRawContent(title.body);
      isLoadingRef.current = false;
      await settleSource(activeNote.path, source);
    },
    [editor, activeNote, snapshotFidelity, settleSource],
  );

  /**
   * An H1 typed at the top of the body of a note without a title is its title,
   * as it is when the note is opened again. So once it is finished (the cursor
   * moves on, or the editor loses focus), it goes up into the title field, the
   * way a title typed there would, and a file still called untitled is named.
   */
  const promoteTitle = () => {
    if (!editor || !activeNote || isLoadingRef.current || isRawMode || conflictRef.current) return;
    if (hasTitle() || editor.view.composing) return;
    const first = editor.state.doc.firstChild;
    if (!first || first.type.name !== "heading" || first.attrs.level !== 1 || !first.textContent.trim()) return;
    // Still being typed: the cursor is in it, and the editor has the keyboard,
    // or only lost it to another window.
    const inside = editor.state.selection.from < first.nodeSize;
    if (inside && (editor.view.hasFocus() || !document.hasFocus())) return;

    // Without the empty line that Enter at the end of the heading has just made,
    // which is where the cursor is, not a blank line kept at the end of the file.
    const source = getMarkdown(editor).replace(/\s+$/, "\n");
    const title = splitNoteTitle(source);
    if (!title.heading || title.index !== 0) return;
    // The body as it would be loaded from the file, so it saves the same way;
    // the cursor stays where it was in the text below the heading.
    const cursor = Math.max(1, editor.state.selection.from - first.nodeSize);
    const focused = editor.view.hasFocus();
    isLoadingRef.current = true;
    editor
      .chain()
      .command(({ tr }) => {
        tr.setMeta("addToHistory", false);
        return true;
      })
      .setContent(title.body, { emitUpdate: true })
      .run();
    snapshotFidelity(editor, source);
    const size = editor.state.doc.content.size;
    editor.commands.setTextSelection(Math.min(cursor, Math.max(1, size - 1)));
    if (focused) editor.commands.focus();
    rawTitleRef.current = title;
    isLoadingRef.current = false;
    void settleSource(activeNote.path, source);
  };
  const promoteTitleRef = useRef(promoteTitle);
  promoteTitleRef.current = promoteTitle;
  useEffect(() => {
    if (!editor) return;
    // After the change that moved the cursor has been applied.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(timer);
      timer = setTimeout(() => promoteTitleRef.current(), 0);
    };
    editor.on("selectionUpdate", later);
    editor.on("blur", later);
    return () => {
      clearTimeout(timer);
      editor.off("selectionUpdate", later);
      editor.off("blur", later);
    };
  }, [editor]);
  const adoptNoteRef = useRef(adoptNote);
  adoptNoteRef.current = adoptNote;

  /** Nothing in the note yet, not even a title. */
  const isEmptyNote = () => !latestContentRef.current.trim();

  pasteNoteRef.current = (event: ClipboardEvent) => {
    if (isRawMode || !isEmptyNote()) return false;
    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!hasNoteTitle(text)) return false;
    event.preventDefault();
    void adoptNoteRef.current(text.replace(/^(?:[ \t]*\r?\n)+/, ""));
    return true;
  };

  // A note pasted into the title field: its body comes here.
  useEffect(() => {
    const onPaste = (e: Event) => {
      const detail = (e as CustomEvent<PasteNoteDetail>).detail;
      if (detail.handled || !editor || isRawMode || detail.path !== activeNote?.path) return;
      if (isEmptyNote()) {
        detail.handled = "whole";
        // With no title in it, the title field keeps the keyboard.
        detail.done = adoptNoteRef.current(detail.note.source, detail.note.title !== "");
      } else {
        detail.handled = "body";
        if (detail.note.body) editor.chain().insertContentAt(0, detail.note.body).run();
      }
    };
    window.addEventListener(PASTE_NOTE_EVENT, onPaste);
    return () => window.removeEventListener(PASTE_NOTE_EVENT, onPaste);
  }, [editor, isRawMode, activeNote?.path]);

  // Raw markdown is toggled from the command palette or its shortcut.
  const toggleRawRef = useRef(handleToggleRawMode);
  toggleRawRef.current = handleToggleRawMode;
  useEffect(() => {
    const onToggle = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string; handled: boolean }>).detail;
      if (detail.handled || detail.path !== activeNote?.path) return;
      detail.handled = true;
      void toggleRawRef.current();
    };
    window.addEventListener("glade:toggle-raw", onToggle);
    return () => window.removeEventListener("glade:toggle-raw", onToggle);
  }, [activeNote?.path]);

  const onRawChange = useCallback(
    (value: string) => {
      setRawContent(value);
      latestContentRef.current = restoreNoteTitle(rawTitleRef.current, value);
      if (activeNote && latestContentRef.current !== lastSavedContentRef.current) {
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
          savedTimeoutRef.current = null;
        }
        setSaveStatusWithRef("unsaved");
        scheduleAutosave();
      }
    },
    [activeNote, setSaveStatusWithRef, scheduleAutosave],
  );

  // Keep TOC headings updated whenever editor changes
  useEffect(() => {
    if (!editor) {
      setTocHeadings([]);
      return;
    }

    const updateHeadings = () => {
      const headings: { level: number; text: string; pos: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === "heading") {
          const text = node.textContent.trim();
          if (text) {
            headings.push({
              level: node.attrs.level,
              text,
              pos,
            });
          }
        }
        return true;
      });
      setTocHeadings(headings);
    };

    // Run updateHeadings immediately
    updateHeadings();

    // Also listen for updates
    editor.on("update", updateHeadings);
    return () => {
      editor.off("update", updateHeadings);
    };
  }, [editor]);

  const isTocOpen = activeNote ? (tocOpen[activeNote.path] ?? false) : false;

  const handleToggleToc = useCallback(() => {
    if (activeNote) {
      toggleToc(activeNote.path);
    }
  }, [activeNote, toggleToc]);

  const find = useNoteFind({
    editor,
    path: activeNote?.path ?? path,
    isRawMode,
    rawContent,
    rawEditorRef,
    // The raw view is always editable; the rich one follows reading mode.
    canEdit: isRawMode || isEditMode,
    focused,
    rootRef: paneRef,
    scrollRef,
  });

  // Another program changed (or removed) the open file.
  useEffect(() => {
    if (!externalEvent || !activeNote || !editor) return;
    const root = useStore.getState().target;
    const abs = isAbsolutePath(activeNote.path) ? activeNote.path : `${root?.path ?? ""}/${activeNote.path}`;
    if (externalEvent.path !== abs) return;
    if (externalEvent.kind === "removed") {
      setConflict({ kind: "removed" });
      return;
    }
    const dirty = latestContentRef.current !== lastSavedContentRef.current;
    if (dirty) setConflict({ kind: "modified" });
    else reloadNote(activeNote.path); // nothing unsaved: show the new content silently
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalEvent]);

  useEffect(() => {
    setConflict(null);
  }, [activeNote?.path]);

  const handleKeepMine = useCallback(async () => {
    if (!editor || !activeNote) return;
    const markdown = getMarkdown(editor);
    const previous = lastSavedContentRef.current;
    latestContentRef.current = markdown;
    lastSavedContentRef.current = markdown;
    setConflict(null);
    try {
      await saveNote(activeNote.path, markdown, true);
    } catch (e) {
      lastSavedContentRef.current = previous;
      setConflict(conflict);
      toast.error("Couldn't save the note", { description: String(e) });
    }
  }, [editor, activeNote, getMarkdown, saveNote, conflict]);

  const handleLoadTheirs = useCallback(async () => {
    if (!activeNote) return;
    // Discard local edits: mark clean so nothing is written back on reload.
    lastSavedContentRef.current = latestContentRef.current;
    setConflict(null);
    await reloadNote(activeNote.path);
  }, [activeNote, reloadNote]);

  const handleCloseDeleted = useCallback(() => {
    setConflict(null);
    lastSavedContentRef.current = latestContentRef.current;
    // Close the tab, not blank it: a blank tab opened from a single file has no
    // folder to show, and sat on the loading skeleton.
    useStore.getState().closePathTab(path);
  }, [path]);

  if (!activeNote) {
    return (
      <div className="flex flex-col flex-1 h-full bg-background items-center justify-center select-none">
        <FileTextIcon className="w-10 h-10 text-muted-foreground mb-4" />
        <p className="text-[14px] text-muted-foreground mb-1">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <PaneProvider value={{ path }}>
    <div
      ref={paneRef}
      data-pane-focused={focused}
      onMouseDownCapture={onFocus}
      onFocusCapture={onFocus}
      className={cn(
        "@container/pane flex flex-1 h-full min-w-0 bg-background overflow-hidden relative",
        split && "transition-[box-shadow] duration-150",

      )}
    >
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
      {/* Under the diagram full view the header stays put (no layout jump), just unreachable. */}
      <div className="contents" {...(mermaidFullscreenOpen ? { inert: "" } : {})}>
        <NoteHeader
          notePath={activeNote.path}
        noteTitle={activeNote.title}
        saveStatus={saveStatus}
        isEditMode={isEditMode}
        hasHeadings={tocHeadings.length > 0}
        isTocOpen={isTocOpen}
        onToggleToc={handleToggleToc}
        find={find.visible ? find.barProps : null}
      />
      </div>

      {conflict && (
        <ConflictBanner
          kind={conflict.kind}
          onKeepMine={handleKeepMine}
          onLoadTheirs={handleLoadTheirs}
          onClose={handleCloseDeleted}
        />
      )}

      <div id={focused ? "note-fullview-portal" : undefined} className="pointer-events-none absolute inset-0 z-50 overflow-hidden" />

      <div className="flex flex-1 overflow-hidden relative">
        <div ref={setOverlayEl} id={focused ? "note-overlay-portal" : undefined} className="absolute inset-0 pointer-events-none z-40 overflow-hidden" />
        {editor && !isRawMode && <BlockHandles editor={editor} blockControls={blockControls} />}
        {editor && !isRawMode && activeNote && (
          <PreviewRail editor={editor} scrollContainerRef={scrollRef} noteKey={activeNote.path} host={overlayEl} />
        )}
        <NoteEditor
          activeNote={activeNote}
          editor={editor}
          isRawMode={isRawMode}
          rawContent={rawContent}
          onRawChange={onRawChange}
          scrollRef={scrollRef}
          onScroll={handleScroll}
          findQuery={find.highlight.query}
          currentMatchIndex={find.highlight.activeIndex}
          caseSensitive={find.highlight.caseSensitive}
          wholeWord={find.highlight.wholeWord}
          rawEditorRef={rawEditorRef}
          isEditMode={isEditMode}
          onExitEditMode={handleExitEditMode}
        />
      </div>
      </div>
      {/* Opens like a drawer: the clip reveals the card from its right edge while it fades in.
            Exit is quicker than enter. Not animated when a note mounts with the drawer already open.
            It spans the full pane height, beside the toolbar, which narrows to make room. */}
        <AnimatePresence initial={false}>
          {isTocOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: tocWidth + TOC_GUTTER, opacity: 1, transition: { duration: reduceMotion ? 0.12 : 0.24, ease: [0.32, 0.72, 0, 1] } }}
              exit={{ width: 0, opacity: 0, transition: { duration: reduceMotion ? 0.1 : 0.16, ease: [0.32, 0.72, 0, 1] } }}
              className="flex shrink-0 justify-end overflow-hidden"
            >
              <TableOfContents
                editor={editor}
                isOpen={isTocOpen}
                onClose={handleToggleToc}
                headings={tocHeadings}
              />
            </motion.div>
          )}
        </AnimatePresence>
    </div>
    </PaneProvider>
  );
}
