import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { useEffect } from "react";
import { useAutosave } from "@/hooks/useAutosave";

interface TipTapEditorProps {
  content: string;
  editable?: boolean;
}

export function TipTapEditor({ content, editable = true }: TipTapEditorProps) {
  const { onContentChange } = useAutosave();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        codeBlock: {
          HTMLAttributes: { class: "code-block" },
        },
        horizontalRule: {},
        blockquote: {},
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "editor-link" },
      }),
      Placeholder.configure({
        placeholder: "Start writing…",
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Image.configure({
        inline: false,
      }),
    ],
    content: content || "",
    editable,
    editorProps: {
      attributes: {
        class: "tiptap-editor",
      },
    },
    onUpdate: ({ editor }) => {
      // Get markdown-like text content for saving
      // For now we save HTML; TipTap's getHTML() preserves structure
      const html = editor.getHTML();
      onContentChange(html);
    },
  });

  // Update content when the note changes (e.g. selecting a different note)
  useEffect(() => {
    if (editor && content !== undefined) {
      // Only update if content is substantially different (avoid cursor jumps)
      const currentContent = editor.getHTML();
      if (currentContent !== content) {
        editor.commands.setContent(content || "");
      }
    }
  }, [content, editor]);

  if (!editor) return null;

  return <EditorContent editor={editor} />;
}

/** Re-export useEditor for toolbar access */
export { useEditor } from "@tiptap/react";
export type { Editor } from "@tiptap/core";
