import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import {
  Bold as FontBoldIcon,
  Italic as FontItalicIcon,
  Strikethrough as StrikethroughIcon,
  List as ListBulletIcon,
  Code as CodeIcon,
  Quote as QuoteIcon,
  Link2 as Link2Icon,
  BookOpen as ReaderIcon,
  Minus as DividerHorizontalIcon,
  CheckSquare as CheckboxIcon,
  FileText as FileTextIcon,
} from "lucide-react";
import { useVaultStore } from "@/stores/useVaultStore";
import { TagInput } from "@/components/TagInput";

const AUTOSAVE_DELAY = 1500;

export function Editor() {
  const { activeNote, saveNote, updateNoteTags } = useVaultStore();
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
      // Switching back to rich view — set raw content into editor
      editor.commands.setContent(rawContent);
      setIsRawMode(false);
    } else {
      // Switching to raw view — get HTML from editor
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

  if (!activeNote) return <EmptyState />;

  const dateLabel = activeNote.updated
    ? formatNoteDate(activeNote.updated)
    : activeNote.created
      ? formatNoteDate(activeNote.created)
      : null;

  return (
    <div className="flex flex-col flex-1 h-full bg-background overflow-hidden relative">
      {/* Note date header */}
      <div className="flex items-center justify-between px-6 h-9 shrink-0 text-[12px] text-muted-foreground select-none">
        <div className="flex items-center gap-1.5">
          <ReaderIcon className="w-3 h-3" />
          {dateLabel && <span>{dateLabel}</span>}
        </div>
        <span className="text-muted-foreground">
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "Saved"
              : ""}
        </span>
      </div>

      {/* Toolbar */}
      <div className="toolbar flex items-center h-9 px-4 shrink-0 bg-background sticky top-0 z-10 w-full">
        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<FontBoldIcon />}
            title="Bold"
            active={editor?.isActive("bold")}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            icon={<FontItalicIcon />}
            title="Italic"
            active={editor?.isActive("italic")}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            icon={<StrikethroughIcon />}
            title="Strikethrough"
            active={editor?.isActive("strike")}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          />
        </div>

        <ToolbarGap />

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            label="H1"
            title="Heading 1"
            active={editor?.isActive("heading", { level: 1 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          />
          <ToolbarButton
            label="H2"
            title="Heading 2"
            active={editor?.isActive("heading", { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          />
          <ToolbarButton
            label="H3"
            title="Heading 3"
            active={editor?.isActive("heading", { level: 3 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          />
          <ToolbarButton
            label="H4"
            title="Heading 4"
            active={editor?.isActive("heading", { level: 4 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
          />
        </div>

        <ToolbarGap />

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<ListBulletIcon />}
            title="Bullet List"
            active={editor?.isActive("bulletList")}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="1."
            title="Ordered List"
            active={editor?.isActive("orderedList")}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            icon={<CheckboxIcon />}
            title="Task List"
            active={editor?.isActive("taskList")}
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
          />
        </div>

        <ToolbarGap />

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<QuoteIcon />}
            title="Blockquote"
            active={editor?.isActive("blockquote")}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            icon={<CodeIcon />}
            title="Code Block"
            active={editor?.isActive("codeBlock")}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          />
        </div>

        <ToolbarGap />

        <div className="flex items-center gap-0.5">
          <ToolbarButton
            icon={<DividerHorizontalIcon />}
            title="Horizontal Rule"
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          />
          <ToolbarButton
            icon={<Link2Icon />}
            title="Link"
            active={editor?.isActive("link")}
            onClick={() => {
              if (editor?.isActive("link")) {
                editor.chain().focus().unsetLink().run();
              } else {
                const url = window.prompt("Enter URL:");
                if (url) {
                  editor?.chain().focus().setLink({ href: url }).run();
                }
              }
            }}
          />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Raw toggle */}
        <ToolbarButton
          icon={<FileTextIcon />}
          title={isRawMode ? "Rich View" : "Raw Markdown"}
          active={isRawMode}
          onClick={toggleRawMode}
        />
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto px-10 py-8">
        <div className="max-w-[680px] mx-auto">
          {/* Title */}
          <h1 className="text-[32px] font-bold font-sans text-foreground tracking-tight leading-tight mb-3">
            {activeNote.title}
          </h1>

          {/* Tags */}
          <div className="mb-6">
            <TagInput
              tags={activeNote.tags}
              onChange={(newTags) => updateNoteTags(newTags)}
            />
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

function EmptyState() {
  const { createNote } = useVaultStore();
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

function ToolbarGap() {
  return <div className="w-3" />;
}

function ToolbarButton({
  icon,
  label,
  title,
  active,
  onClick,
}: {
  icon?: React.ReactNode;
  label?: string;
  title: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md transition-all focus:outline-none ${
        active
          ? "text-foreground bg-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
      title={title}
      onClick={onClick}
      type="button"
    >
      {icon && (
        <span className="w-[15px] h-[15px] flex items-center justify-center">
          {icon}
        </span>
      )}
      {label && (
        <span className="text-[12px] font-semibold leading-none select-none tracking-tight">
          {label}
        </span>
      )}
    </button>
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
