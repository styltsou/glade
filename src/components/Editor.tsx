import { useEditor } from "@tiptap/react";
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
import { findMatches, findMatchesRaw, SearchHighlight } from "@/components/editor/SearchHighlight";
import { toast } from "sonner";
import { useStore } from "@/store";
import { registerEditor } from "@/lib/fileChanges";
import { isDocumentEdit } from "@/lib/editorUpdates";
import { extensions } from "./editor/extensions";
import { useSaveNote } from "@/hooks/useSaveNote";
import { splitNoteTitle, restoreNoteTitle, type NoteTitle } from "@/lib/noteTitle";
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

export function Editor({ path, focused, onFocus, paneIndex, split }: EditorProps) {
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
  const [findVisible, setFindVisible] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [replaceVisible, setReplaceVisible] = useState(false);
  const [replaceQuery, setReplaceQuery] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const wasEditorFocusedRef = useRef(false);

  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastSavedContentRef = useRef<string>("");
  const latestContentRef = useRef<string>("");
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const cursorPositionRef = useRef<number | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const lastFocusedPositionRef = useRef<number | null>(null);
  const { snapshot: snapshotFidelity, getMarkdown } = useMarkdownFidelity();

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

  const editor = useEditor({
    extensions: [
      ...extensions,
      blockControls.extension,
      SearchHighlight.configure({
        query: "",
        activeIndex: 0,
        caseSensitive: true,
      }),
    ],
    content: "",
    editorProps: {
      attributes: { class: "tiptap-editor" },
      handleClickOn: (_view, _pos, node, _nodePos) => {
        if (node.type.name === "mention" && node.attrs.id) {
          const { idToPath } = useStore.getState();
          const targetPath = idToPath[node.attrs.id];

          if (targetPath) {
            selectNote(targetPath);
          } else {
            // Handle deleted or missing note
            alert("Note not found. It may have been deleted.");
          }
          return true;
        }
        return false;
      },
    },
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

  const handleFindClose = useCallback(() => {
    setFindVisible(false);
    setFindQuery("");
    setTotalMatches(0);
    setCurrentMatchIndex(0);
    setReplaceVisible(false);
    setReplaceQuery("");
    
    // Only focus the editor if it was originally focused, or we actively searched and found matches
    if (editor && (wasEditorFocusedRef.current || (findQuery && totalMatches > 0))) {
      editor.commands.focus();
    }
  }, [editor, findQuery, totalMatches]);

  // Keyboard shortcuts for Ctrl+F / Cmd+F and Ctrl+H / Cmd+H
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!focused) return;
      const isModPressed = e.metaKey || e.ctrlKey;
      if (isModPressed && e.key === "f") {
        e.preventDefault();
        wasEditorFocusedRef.current = editor?.isFocused ?? false;
        const { from, to } = editor?.state.selection ?? { from: 0, to: 0 };
        const selectedText = editor && from !== to ? editor.state.doc.textBetween(from, to) : "";
        setFindVisible(true);
        setReplaceVisible(false);
        setFindQuery(selectedText || "");
        setCurrentMatchIndex(0);
        if (selectedText && editor) {
          const matches = findMatches(editor.state.doc, selectedText, { caseSensitive, matchWholeWord, useRegex });
          setTotalMatches(matches.length);
        }
        setTimeout(() => findInputRef.current?.focus(), 50);
      }

      if (isModPressed && e.key === "h") {
        e.preventDefault();
        wasEditorFocusedRef.current = editor?.isFocused ?? false;
        setFindVisible(true);
        setReplaceVisible(true);
        setTimeout(() => findInputRef.current?.focus(), 50);
      }
      
      // Close find bar on Escape
      if (e.key === "Escape" && findVisible) {
        e.preventDefault();
        handleFindClose();
      }

      // Alt+C / Alt+W / Alt+R — search option toggles
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          setCaseSensitive((v) => !v);
        } else if (e.key === "w" || e.key === "W") {
          e.preventDefault();
          setMatchWholeWord((v) => !v);
        } else if (e.key === "r" || e.key === "R") {
          e.preventDefault();
          setUseRegex((v) => !v);
        }
      }

    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, findVisible, handleFindClose, activeNote, isEditMode, setNoteEditMode, focused]);

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

      // Save any unsaved changes before switching
      if (latestContentRef.current !== lastSavedContentRef.current) {
        const contentToSave = latestContentRef.current;
        lastSavedContentRef.current = contentToSave;
        const pathToSave = pathChanged ? currentPathRef.current : activeNote.path;
        if (pathToSave) {
          (async () => {
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
  const paneIndexRef = useRef(paneIndex);
  paneIndexRef.current = paneIndex;
  useEffect(() => {
    return () => {
      const path = currentPathRef.current;
      if (path && !conflictRef.current && latestContentRef.current !== lastSavedContentRef.current) {
        useStore
          .getState()
          .saveNote(path, latestContentRef.current)
          .catch((e) => toast.error(`Couldn't save "${path}"`, { description: String(e) }));
      }
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

  const searchOpts = { caseSensitive, matchWholeWord, useRegex };

  const handleFindQueryChange = useCallback((query: string) => {
    setFindQuery(query);
    setCurrentMatchIndex(0);
    if (query) {
      if (isRawMode) {
        const matches = findMatchesRaw(rawContent, query, searchOpts);
        setTotalMatches(matches.length);
      } else if (editor) {
        const matches = findMatches(editor.state.doc, query, searchOpts);
        setTotalMatches(matches.length);
      }
    } else {
      setTotalMatches(0);
    }
  }, [editor, isRawMode, rawContent, caseSensitive, matchWholeWord, useRegex]);

  const handleNavigateNext = useCallback(() => {
    if (totalMatches === 0) return;
    const nextIndex = (currentMatchIndex + 1) % totalMatches;
    setCurrentMatchIndex(nextIndex);
  }, [currentMatchIndex, totalMatches]);

  const handleNavigatePrev = useCallback(() => {
    if (totalMatches === 0) return;
    const prevIndex = (currentMatchIndex - 1 + totalMatches) % totalMatches;
    setCurrentMatchIndex(prevIndex);
  }, [currentMatchIndex, totalMatches]);


  const handleFindKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab" || e.key === "ArrowDown") {
      e.preventDefault();
      if (e.shiftKey) {
        handleNavigatePrev();
      } else {
        handleNavigateNext();
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      handleNavigatePrev();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleFindClose();
    }
  }, [handleNavigateNext, handleNavigatePrev, handleFindClose]);

  const handleToggleReplace = useCallback(() => {
    setReplaceVisible((v) => !v);
    // Focus back to find input so keyboard flow stays natural
    setTimeout(() => findInputRef.current?.focus(), 0);
  }, []);

  const handleReplace = useCallback(() => {
    if (totalMatches === 0 || !replaceQuery && replaceQuery !== "") return;

    if (isRawMode) {
      const content = rawContent;
      const matches = findMatchesRaw(content, findQuery, searchOpts);
      const match = matches[currentMatchIndex];
      if (!match) return;
      const newContent = content.slice(0, match.from) + replaceQuery + content.slice(match.to);
      onRawChange(newContent);
      setTimeout(() => {
        const newMatches = findMatchesRaw(newContent, findQuery, searchOpts);
        setTotalMatches(newMatches.length);
        setCurrentMatchIndex(Math.min(currentMatchIndex, Math.max(0, newMatches.length - 1)));
      }, 0);
    } else if (editor) {
      const matches = findMatches(editor.state.doc, findQuery, searchOpts);
      const match = matches[currentMatchIndex];
      if (!match) return;
      editor.chain()
        .focus()
        .deleteRange({ from: match.from, to: match.to })
        .insertContentAt(match.from, replaceQuery)
        .run();
      setTimeout(() => {
        const newMatches = findMatches(editor.state.doc, findQuery, searchOpts);
        setTotalMatches(newMatches.length);
        setCurrentMatchIndex(Math.min(currentMatchIndex, Math.max(0, newMatches.length - 1)));
      }, 0);
    }
  }, [editor, isRawMode, rawContent, findQuery, replaceQuery, currentMatchIndex, totalMatches, onRawChange, caseSensitive, matchWholeWord, useRegex]);

  const handleReplaceAll = useCallback(() => {
    if (totalMatches === 0) return;

    if (isRawMode) {
      const content = rawContent;
      const matches = findMatchesRaw(content, findQuery, searchOpts);
      let newContent = content;
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        newContent = newContent.slice(0, m.from) + replaceQuery + newContent.slice(m.to);
      }
      onRawChange(newContent);
      setTotalMatches(0);
      setCurrentMatchIndex(0);
    } else if (editor) {
      const matches = findMatches(editor.state.doc, findQuery, searchOpts);
      if (matches.length === 0) return;
      const { tr } = editor.state;
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        tr.insertText(replaceQuery, m.from, m.to);
      }
      editor.view.dispatch(tr);
      setTotalMatches(0);
      setCurrentMatchIndex(0);
    }
  }, [editor, isRawMode, rawContent, findQuery, replaceQuery, totalMatches, onRawChange, caseSensitive, matchWholeWord, useRegex]);

  // Update search highlight decorations when query or match index changes
  useEffect(() => {
    if (!editor) return;
    
    const extension = editor.extensionManager.extensions.find(
      (ext) => ext.name === "searchHighlight"
    );
    if (extension) {
      // Dispatch a transaction with new options to force ProseMirror plugin state to update
      editor.view.dispatch(
        editor.state.tr.setMeta("searchHighlight", {
          query: findQuery,
          activeIndex: currentMatchIndex,
          caseSensitive,
          matchWholeWord,
          useRegex,
        })
      );

      // Defer scroll operation slightly so ProseMirror can render the new decorations first.
      // This is purely visual and does not modify text selection, avoiding mention triggers.
      if (!isRawMode && findQuery) {
        requestAnimationFrame(() => {
          const activeMatch = editor.view.dom.querySelector(".search-highlight-active");
          if (activeMatch) {
            activeMatch.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        });
      }
    }
  }, [editor, findQuery, currentMatchIndex, isRawMode, caseSensitive, matchWholeWord, useRegex]);

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
    const store = useStore.getState();
    store.focusGroup(paneIndexRef.current);
    store.setFocusedPathNull();
  }, []);

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
      data-pane-focused={focused}
      onMouseDownCapture={onFocus}
      onFocusCapture={onFocus}
      className={cn(
        "@container/pane flex flex-1 h-full min-w-0 bg-background overflow-hidden relative",
        split && "transition-[box-shadow] duration-150",

      )}
    >
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
      {!mermaidFullscreenOpen && (
        <NoteHeader
          notePath={activeNote.path}
        noteTitle={activeNote.title}
        saveStatus={saveStatus}
        isEditMode={isEditMode}
        hasHeadings={tocHeadings.length > 0}
        isTocOpen={isTocOpen}
        onToggleToc={handleToggleToc}
        findVisible={findVisible}
        findQuery={findQuery}
        onFindQueryChange={handleFindQueryChange}
        currentMatch={currentMatchIndex + 1}
        totalMatches={totalMatches}
        onNavigateNext={handleNavigateNext}
        onNavigatePrev={handleNavigatePrev}
        onFindClose={handleFindClose}
        findInputRef={findInputRef}
        onFindKeyDown={handleFindKeyDown}
        isReplaceVisible={replaceVisible}
        onToggleReplace={handleToggleReplace}
        replaceQuery={replaceQuery}
        onReplaceQueryChange={setReplaceQuery}
        onReplace={handleReplace}
        onReplaceAll={handleReplaceAll}
        replaceInputRef={replaceInputRef}
        onReplaceKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.altKey) {
              handleReplaceAll();
            } else {
              handleReplace();
            }
          } else if (e.key === "Escape") {
            e.preventDefault();
            handleFindClose();
          }
        }}
        caseSensitive={caseSensitive}
        onToggleCaseSensitive={() => setCaseSensitive((v) => !v)}
        matchWholeWord={matchWholeWord}
        onToggleMatchWholeWord={() => setMatchWholeWord((v) => !v)}
        useRegex={useRegex}
        onToggleUseRegex={() => setUseRegex((v) => !v)}
      />
      )}

      {conflict && (
        <ConflictBanner
          kind={conflict.kind}
          onKeepMine={handleKeepMine}
          onLoadTheirs={handleLoadTheirs}
          onClose={handleCloseDeleted}
        />
      )}

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
          findQuery={findQuery}
          currentMatchIndex={currentMatchIndex}
          searchOpts={{ caseSensitive, matchWholeWord, useRegex }}
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
