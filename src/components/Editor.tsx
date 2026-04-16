import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "@tiptap/react";
import { FileText as FileTextIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { NoteHeader } from "@/components/editor/NoteHeader";
import { TableOfContents } from "@/components/editor/TableOfContents";
import { findMatches, findMatchesRaw, SearchHighlight } from "@/components/editor/SearchHighlight";
import { useStore } from "@/store";
import { extensions } from "./editor/extensions";

export function Editor() {
  const activeNote = useStore((state) => state.activeNote);
  const saveNote = useStore((state) => state.saveNote);
  const createNote = useStore((state) => state.createNote);
  const onNoteOpened = useStore((state) => state.onNoteOpened);
  const selectNote = useStore((state) => state.selectNote);
  const noteScrollPositions = useStore((state) => state.noteScrollPositions);
  const updateNoteScrollPosition = useStore(
    (state) => state.updateNoteScrollPosition,
  );
  const tocOpen = useStore((state) => state.tocOpen);
  const toggleToc = useStore((state) => state.toggleToc);
  const noteEditMode = useStore((state) => state.noteEditMode);
  const setNoteEditMode = useStore((state) => state.setNoteEditMode);
  const isRawModeMap = useStore((state) => state.isRawMode);
  const toggleRawModeFromStore = useStore((state) => state.toggleRawMode);

  const isEditMode = activeNote ? noteEditMode[activeNote.path] ?? false : false;
  const isRawMode = activeNote ? isRawModeMap[activeNote.path] ?? false : false;
  
  // Track pending cursor position when entering edit mode
  const pendingCursorPosRef = useRef<number | null>(null);

  const handleEnterEditMode = useCallback((cursorPos?: number | null) => {
    if (activeNote) {
      pendingCursorPosRef.current = cursorPos ?? null;
      setNoteEditMode(activeNote.path, true);
    }
  }, [activeNote, setNoteEditMode]);

  const handleExitEditMode = useCallback(() => {
    if (activeNote) {
      setNoteEditMode(activeNote.path, false);
    }
  }, [activeNote, setNoteEditMode]);

  const [rawContent, setRawContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "saved" | "idle">(
    "idle",
  );
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
  const saveStatusRef = useRef<"unsaved" | "saved" | "idle">("idle");

  const setSaveStatusWithRef = useCallback((status: "unsaved" | "saved" | "idle") => {
    saveStatusRef.current = status;
    setSaveStatus(status);
  }, []);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastSavedContentRef = useRef<string>("");
  const latestContentRef = useRef<string>("");
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const skipUpdateRef = useRef(false);
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingRef = useRef(false);
  const cursorPositionRef = useRef<number | null>(null);
  const currentPathRef = useRef<string | null>(null);
  const lastFocusedPositionRef = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      ...extensions,
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
    onUpdate: ({ editor }) => {
      if (!activeNote || isLoadingRef.current) return;

      // Skip the first onUpdate after loading content (fires during setContent)
      if (skipUpdateRef.current) {
        skipUpdateRef.current = false;
        return;
      }

      const markdown = (editor.storage as any).markdown.getMarkdown();

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
      }
    },
  });

  const saveNow = useCallback(async () => {
    if (!activeNote) return;
    if (latestContentRef.current === lastSavedContentRef.current) return;

    const content = latestContentRef.current;
    lastSavedContentRef.current = content;
    pendingSaveRef.current = (async () => {
      try {
        await saveNote(activeNote.path, content);
        setSaveStatusWithRef("saved");
        // Show "Saved" briefly, then transition to idle (hide label)
        if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
        savedTimeoutRef.current = setTimeout(() => {
          setSaveStatusWithRef("idle");
        }, 2000);
      } catch {
        setSaveStatusWithRef("unsaved");
      } finally {
        pendingSaveRef.current = null;
      }
    })();

    return pendingSaveRef.current;
  }, [activeNote, saveNote, setSaveStatusWithRef]);

  // Keyboard shortcut for Ctrl+S / Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveNow]);

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

      // Cmd/Ctrl+E to toggle read/edit mode
      if (isModPressed && e.key === "e") {
        e.preventDefault();
        if (activeNote) {
          setNoteEditMode(activeNote.path, !isEditMode);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, findVisible, handleFindClose, activeNote, isEditMode, setNoteEditMode]);

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

      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();

      // Only update content if it actually changed
      if (pathChanged || currentMarkdown !== activeNote.body) {
        // Set refs BEFORE setContent so onUpdate sees correct values
        lastSavedContentRef.current = activeNote.body || "";
        latestContentRef.current = activeNote.body || "";
        // Skip the first onUpdate (fires during setContent)
        skipUpdateRef.current = true;
        // Use setContent with emitUpdate: false to avoid focusing
        editor.commands.setContent(activeNote.body || "", { emitUpdate: false });
        setRawContent(activeNote.body || "");

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
          // Use pending cursor position if set (from double-click), otherwise use last saved
          if (pendingCursorPosRef.current !== null) {
            requestAnimationFrame(() => {
              if (editor && pendingCursorPosRef.current !== null) {
                const pos = pendingCursorPosRef.current;
                const docSize = editor.state.doc.content.size;
                if (pos >= 0 && pos <= docSize) {
                  editor.commands.setTextSelection({ from: pos, to: pos });
                }
              }
            });
            pendingCursorPosRef.current = null;
          } else if (lastFocusedPositionRef.current !== null) {
            requestAnimationFrame(() => {
              if (editor && lastFocusedPositionRef.current !== null) {
                const pos = lastFocusedPositionRef.current;
                const docSize = editor.state.doc.content.size;
                // Only restore if position is valid
                if (pos >= 0 && pos <= docSize) {
                  editor.commands.setTextSelection({ from: pos, to: pos });
                }
              }
            });
          } else {
            // No prior position known - default to start of document
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

  // Update recents list when note is opened
  useEffect(() => {
    if (activeNote) {
      onNoteOpened({
        id: activeNote.id,
        path: activeNote.path,
        title: activeNote.title,
        tags: activeNote.tags,
        preview: activeNote.preview,
        modified: new Date().toISOString(),
        pinned: false,
      });
    }
  }, [activeNote?.path, onNoteOpened]);

  // Toggle raw mode using store action
  const handleToggleRawMode = useCallback(async () => {
    if (!editor || !activeNote) return;
    const currentlyRaw = isRawModeMap[activeNote.path] ?? false;
    if (currentlyRaw) {
      isLoadingRef.current = true;
      skipUpdateRef.current = true;
      latestContentRef.current = rawContent;
      editor.commands.setContent(rawContent, { emitUpdate: false });
      toggleRawModeFromStore(activeNote.path);
      if (rawContent !== lastSavedContentRef.current) {
        setSaveStatusWithRef("unsaved");
        await saveNow();
      }
      setTimeout(() => { isLoadingRef.current = false; }, 100);
    } else {
      try {
        const raw = await invoke<string>("read_note_raw", {
          path: activeNote.path,
        });
        const stripped = raw.replace(/^---[\s\S]*?---\s*\n?/, "");
        setRawContent(stripped);
      } catch {
        const md = (editor.storage as any).markdown.getMarkdown();
        setRawContent(md);
      }
      toggleRawModeFromStore(activeNote.path);
    }
  }, [editor, isRawModeMap, rawContent, activeNote, saveNow, toggleRawModeFromStore]);

  const onRawChange = useCallback(
    (value: string) => {
      setRawContent(value);
      latestContentRef.current = value;
      if (activeNote && latestContentRef.current !== lastSavedContentRef.current) {
        if (savedTimeoutRef.current) {
          clearTimeout(savedTimeoutRef.current);
          savedTimeoutRef.current = null;
        }
        setSaveStatusWithRef("unsaved");
      }
    },
    [activeNote, setSaveStatusWithRef],
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

  if (!activeNote) {
    return (
      <div className="flex flex-col flex-1 h-full bg-background items-center justify-center select-none">
        <FileTextIcon className="w-10 h-10 text-muted-foreground mb-4" />
        <p className="text-[14px] text-muted-foreground mb-1">
          No note selected
        </p>
        <button
          onClick={() => createNote()}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Create a new note
        </button>
      </div>
    );
  }

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
        const matches = findMatchesRaw(latestContentRef.current, query, searchOpts);
        setTotalMatches(matches.length);
      } else if (editor) {
        const matches = findMatches(editor.state.doc, query, searchOpts);
        setTotalMatches(matches.length);
      }
    } else {
      setTotalMatches(0);
    }
  }, [editor, isRawMode, caseSensitive, matchWholeWord, useRegex]);

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
      const content = latestContentRef.current;
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
  }, [editor, isRawMode, findQuery, replaceQuery, currentMatchIndex, totalMatches, onRawChange, caseSensitive, matchWholeWord, useRegex]);

  const handleReplaceAll = useCallback(() => {
    if (totalMatches === 0) return;

    if (isRawMode) {
      const content = latestContentRef.current;
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
  }, [editor, isRawMode, findQuery, replaceQuery, totalMatches, onRawChange, caseSensitive, matchWholeWord, useRegex]);

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

  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden relative">
      {!mermaidFullscreenOpen && (
        <NoteHeader
          notePath={activeNote.path}
        noteTitle={activeNote.title}
        saveStatus={saveStatus}
        hasHeadings={tocHeadings.length > 0}
        isTocOpen={isTocOpen}
        onToggleToc={handleToggleToc}
        onToggleRaw={(isRaw) => { if (isRaw !== isRawMode) handleToggleRawMode(); }}
        isRawMode={isRawMode}
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

      <div className="flex flex-1 overflow-hidden relative">
        <div id="note-overlay-portal" className="absolute inset-0 pointer-events-none z-40 overflow-hidden" />
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
          onEnterEditMode={handleEnterEditMode}
          onExitEditMode={handleExitEditMode}
        />
        {isTocOpen && (
          <TableOfContents
            editor={editor}
            isOpen={isTocOpen}
            onClose={handleToggleToc}
            headings={tocHeadings}
          />
        )}
      </div>
    </div>
  );
}
