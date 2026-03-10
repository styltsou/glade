import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor } from "@tiptap/react";
import { FileText as FileTextIcon } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { NoteHeader } from "@/components/editor/NoteHeader";
import { NoteEditor } from "@/components/editor/NoteEditor";
import { extensions } from "./editor/extensions";
import { formatNoteDate } from "@/lib/dates";

const AUTOSAVE_DELAY = 1500;

export function Editor() {
  const activeNote = useStore((state) => state.activeNote);
  const saveNote = useStore((state) => state.saveNote);
  const createNote = useStore((state) => state.createNote);
  const onNoteOpened = useStore((state) => state.onNoteOpened);
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Track last saved content to avoid saving unchanged content
  const lastSavedContentRef = useRef<string>("");
  // Track if we're programmatically loading content (not user typing)
  const isLoadingRef = useRef(false);
  // Track the path that was used when setting the timer (for race condition fix)
  const pendingSaveRef = useRef<{ path: string; content: string } | null>(null);

  const editor = useEditor({
    extensions,
    content: "",
    editorProps: {
      attributes: { class: "tiptap-editor" },
    },
    onUpdate: ({ editor }) => {
      if (!activeNote || isLoadingRef.current) return;
      const markdown = (editor.storage as any).markdown.getMarkdown();
      debouncedSave(activeNote.path, markdown);
    },
  });

  // Debounced autosave with content comparison and path capture
  const debouncedSave = useCallback(
    (path: string, content: string) => {
      // Skip if content hasn't changed from last save
      if (content === lastSavedContentRef.current) {
        return;
      }

      // Clear existing timer
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // Capture the path at the time of setting the timer (fixes race condition)
      pendingSaveRef.current = { path, content };

      saveTimerRef.current = setTimeout(async () => {
        const pending = pendingSaveRef.current;
        if (!pending) return;
        
        setSaveStatus("saving");
        try {
          await saveNote(pending.path, pending.content);
          lastSavedContentRef.current = pending.content;
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("idle");
        }
        pendingSaveRef.current = null;
      }, AUTOSAVE_DELAY);
    },
    [saveNote]
  );

  // Track current path to detect switching
  const currentPathRef = useRef<string | null>(null);

  // Update editor content when switching notes OR when body arrives from bg fetch
  useEffect(() => {
    if (editor && activeNote) {
      const pathChanged = currentPathRef.current !== activeNote.path;
      isLoadingRef.current = true;
      
      // Get current editor content
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
      
      // Update if path changed OR if content is different (e.g. background load)
      if (pathChanged || currentMarkdown !== activeNote.body) {
        editor.commands.setContent(activeNote.body || "");
        setRawContent(activeNote.body || "");
        // Update last saved to current content so we don't re-save immediately
        lastSavedContentRef.current = activeNote.body || "";
      }
      
      if (pathChanged) {
        currentPathRef.current = activeNote.path;
        // Reset scroll or other state if needed
      }
      
      isLoadingRef.current = false;
      setSaveStatus("idle");
    }
  }, [activeNote?.path, activeNote?.body, editor]);

  // Clear timer on note switch to prevent race conditions
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Update recents list when note is opened
  useEffect(() => {
    if (activeNote) {
      onNoteOpened({
        path: activeNote.path,
        title: activeNote.title,
        tags: activeNote.tags,
        preview: activeNote.preview,
        modified: new Date().toISOString(),
        pinned: false
      });
    }
  }, [activeNote?.path, onNoteOpened]);

  // Toggle raw mode
  const toggleRawMode = useCallback(async () => {
    if (!editor || !activeNote) return;
    if (isRawMode) {
      editor.commands.setContent(rawContent);
      setIsRawMode(false);
    } else {
      try {
        const raw = await invoke<string>("read_note_raw", { path: activeNote.path });
        const stripped = raw.replace(/^---[\s\S]*?---\s*\n?/, "");
        setRawContent(stripped);
      } catch {
        const md = (editor.storage as any).markdown.getMarkdown();
        setRawContent(md);
      }
      setIsRawMode(true);
    }
  }, [editor, isRawMode, rawContent, activeNote]);

  const onRawChange = useCallback(
    (value: string) => {
      setRawContent(value);
      if (activeNote) debouncedSave(activeNote.path, value);
    },
    [activeNote, debouncedSave]
  );

  if (!activeNote) {
    return (
      <div className="flex flex-col flex-1 h-full bg-background items-center justify-center select-none">
        <FileTextIcon className="w-10 h-10 text-muted-foreground mb-4" />
        <p className="text-[14px] text-muted-foreground mb-1">No note selected</p>
        <button
          onClick={() => createNote()}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Create a new note
        </button>
      </div>
    );
  }

  const dateLabel = activeNote.updated
    ? formatNoteDate(activeNote.updated)
    : activeNote.created
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
      />
    </div>
  );
}
