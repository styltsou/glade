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
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { NoteHeader } from "@/components/editor/NoteHeader";
import { formatNoteDate } from "@/lib/dates";
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

  const [isRawMode, setIsRawMode] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "saved" | "idle">(
    "idle",
  );
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

  const editor = useEditor({
    extensions,
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
        (async () => {
          try {
            await saveNote(activeNote.path, contentToSave);
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

      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();

      // Only update content if it actually changed
      if (pathChanged || currentMarkdown !== activeNote.body) {
        // Set refs BEFORE setContent so onUpdate sees correct values
        lastSavedContentRef.current = activeNote.body || "";
        latestContentRef.current = activeNote.body || "";
        // Skip the first onUpdate (fires during setContent)
        skipUpdateRef.current = true;
        editor.commands.setContent(activeNote.body || "");
        setRawContent(activeNote.body || "");

        // Reset cursor position tracking for new note
        cursorPositionRef.current = null;
      }

      // Restore scroll position for the *new* note immediately after content is set
      if (pathChanged || currentMarkdown !== activeNote.body) {
        const savedPosition = noteScrollPositions[activeNote.path];
        if (scrollRef.current) {
          scrollRef.current.scrollTop = savedPosition || 0;
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

  // Toggle raw mode
  const toggleRawMode = useCallback(async () => {
    if (!editor || !activeNote) return;
    if (isRawMode) {
      isLoadingRef.current = true;
      // Skip the first onUpdate after setContent (TipTap serializes differently than raw markdown)
      skipUpdateRef.current = true;
      latestContentRef.current = rawContent;
      editor.commands.setContent(rawContent);
      setIsRawMode(false);
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
      setIsRawMode(true);
    }
  }, [editor, isRawMode, rawContent, activeNote, saveNow]);

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

  const dateLabel = activeNote.created
    ? formatNoteDate(activeNote.created)
    : null;

  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden relative">
      <NoteHeader
        notePath={activeNote.path}
        noteTitle={activeNote.title}
        dateLabel={dateLabel}
        saveStatus={saveStatus}
      />
      <EditorToolbar
        editor={editor}
        isRawMode={isRawMode}
        onToggleRaw={toggleRawMode}
        notePath={activeNote.path}
        noteTitle={activeNote.title}
      />

      <NoteEditor
        activeNote={activeNote}
        editor={editor}
        isRawMode={isRawMode}
        rawContent={rawContent}
        onRawChange={onRawChange}
        scrollRef={scrollRef}
        onScroll={handleScroll}
      />
    </div>
  );
}
