import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { FileText as FileTextIcon } from "lucide-react";
import { useVaultStore } from "@/stores/useVaultStore";
import { TagInput } from "@/components/TagInput";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { NoteHeader } from "@/components/editor/NoteHeader";

const AUTOSAVE_DELAY = 1500;

export function Editor() {
  const { activeNote, saveNote, createNote } = useVaultStore();
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawContent, setRawContent] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: { HTMLAttributes: { class: "code-block" } },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Placeholder.configure({ placeholder: "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: false }),
    ],
    content: "",
    editorProps: {
      attributes: { class: "tiptap-editor" },
    },
    onUpdate: ({ editor }) => {
      if (!activeNote) return;
      debouncedSave(editor.getHTML());
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
      editor.commands.setContent(activeNote.body || "");
      setRawContent(activeNote.body || "");
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
  const toggleRawMode = useCallback(() => {
    if (!editor) return;
    if (isRawMode) {
      editor.commands.setContent(rawContent);
      setIsRawMode(false);
    } else {
      setRawContent(editor.getHTML());
      setIsRawMode(true);
    }
  }, [editor, isRawMode, rawContent]);

  // Handle raw textarea changes
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
      <NoteHeader dateLabel={dateLabel} saveStatus={saveStatus} />
      <EditorToolbar editor={editor} isRawMode={isRawMode} onToggleRaw={toggleRawMode} />

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto px-10 py-8">
        <div className="max-w-[680px] mx-auto">
          {/* Title */}
          <h1 className="text-[32px] font-bold font-sans text-foreground tracking-tight leading-tight mb-3">
            {activeNote.title}
          </h1>

          {/* Tags */}
          <div className="mb-6">
            <TagInput />
          </div>

          {/* Editor or Raw view */}
          {isRawMode ? (
            <textarea
              className="w-full h-[calc(100vh-280px)] bg-transparent text-[14px] leading-[1.7] font-mono text-foreground resize-none focus:outline-none placeholder:text-muted-foreground"
              value={rawContent}
              onChange={(e) => onRawChange(e.target.value)}
              placeholder="Write raw markdown…"
              spellCheck={false}
            />
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>
      </div>
    </div>
  );
}

function formatNoteDate(iso: string): string {
  const date = new Date(iso);
  return (
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    })
  );
}
