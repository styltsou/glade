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
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions,
    content: "",
    editorProps: {
      attributes: { class: "tiptap-editor" },
    },
    onUpdate: ({ editor }) => {
      if (!activeNote) return;
      const markdown = (editor.storage as any).markdown.getMarkdown();
      debouncedSave(markdown);
    },
  });

  // Debounced autosave
  const debouncedSave = useCallback(
    (content: string) => {
      if (!activeNote) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

      saveTimerRef.current = setTimeout(async () => {
        setSaveStatus("saving");
        try {
          await saveNote(activeNote.path, content);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch {
          setSaveStatus("idle");
        }
      }, AUTOSAVE_DELAY);
    },
    [activeNote, saveNote],
  );

  // Update editor content when switching notes
  useEffect(() => {
    if (editor && activeNote) {
      // If we have a body (from cache or server), set it. 
      // If not, we keep the previous content or show empty until it arrives.
      if (activeNote.body !== undefined) {
        editor.commands.setContent(activeNote.body || "");
        setRawContent(activeNote.body || "");
      }
      setIsRawMode(false);
      setSaveStatus("idle");
    }
  }, [activeNote?.path, editor]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
      if (activeNote) debouncedSave(value);
    },
    [activeNote, debouncedSave],
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
