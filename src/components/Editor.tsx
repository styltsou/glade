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
  const selectNote = useStore((state) => state.selectNote);
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"unsaved" | "saved">("saved");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const lastSavedContentRef = useRef<string>("");
  const isLoadingRef = useRef(false);
  const pendingSaveRef = useRef<{ path: string; content: string } | null>(null);
  const cursorPositionRef = useRef<number | null>(null);
  const currentPathRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions,
    content: "",
    editorProps: {
      attributes: { class: "tiptap-editor" },
      handleClickOn: (_view, _pos, node, _nodePos) => {
        if (node.type.name === 'mention' && node.attrs.id) {
          selectNote(node.attrs.id);
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
      const markdown = (editor.storage as any).markdown.getMarkdown();
      cursorPositionRef.current = editor.state.selection.from;
      
      if (saveStatus !== "unsaved") {
        setSaveStatus("unsaved");
      }
      debouncedSave(activeNote.path, markdown);
    },
  });

  const debouncedSave = useCallback(
    (path: string, content: string) => {
      if (content === lastSavedContentRef.current) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      pendingSaveRef.current = { path, content };

      saveTimerRef.current = setTimeout(async () => {
        const pending = pendingSaveRef.current;
        if (!pending) return;
        
        try {
          await saveNote(pending.path, pending.content);
          lastSavedContentRef.current = pending.content;
          setSaveStatus("saved");
        } catch {
          // Keep unsaved status on error
        }
        pendingSaveRef.current = null;
      }, AUTOSAVE_DELAY);
    },
    [saveNote]
  );

  const saveNow = useCallback(async () => {
    if (!activeNote || saveStatus === "saved") return;
    
    // Clear pending debounced save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    
    const pending = pendingSaveRef.current;
    if (!pending) return;
    
    try {
      await saveNote(pending.path, pending.content);
      lastSavedContentRef.current = pending.content;
      setSaveStatus("saved");
    } catch {
      // Keep unsaved status on error
    }
    pendingSaveRef.current = null;
  }, [activeNote, saveNote, saveStatus]);

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

  // Load content when switching notes
  useEffect(() => {
    if (editor && activeNote) {
      const pathChanged = currentPathRef.current !== activeNote.path;
      isLoadingRef.current = true;
      
      const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
      
      // Only update content if it actually changed
      if (pathChanged || currentMarkdown !== activeNote.body) {
        editor.commands.setContent(activeNote.body || "");
        setRawContent(activeNote.body || "");
        lastSavedContentRef.current = activeNote.body || "";
        
        // Reset cursor position tracking for new note
        cursorPositionRef.current = null;
      }
      
      if (pathChanged) {
        currentPathRef.current = activeNote.path;
      }
      
      isLoadingRef.current = false;
      setSaveStatus("saved");
    }
  }, [activeNote?.path, activeNote?.body, editor]);

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
      if (activeNote) {
        if (saveStatus !== "unsaved") {
          setSaveStatus("unsaved");
        }
        debouncedSave(activeNote.path, value);
      }
    },
    [activeNote, debouncedSave, saveStatus]
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
