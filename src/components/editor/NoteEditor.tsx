import { useEffect, useRef } from "react";
import { EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Strikethrough, Link2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EditableTitle } from "./EditableTitle";
import { TagInput } from "@/components/TagInput";
import { RawEditor } from "./RawEditor";

interface NoteEditorProps {
  activeNote: {
    title: string;
    path: string;
    [key: string]: any;
  };
  editor: Editor | null;
  isRawMode: boolean;
  rawContent: string;
  onRawChange: (value: string) => void;
}

export function NoteEditor({
  activeNote,
  editor,
  isRawMode,
  rawContent,
  onRawChange,
}: NoteEditorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeNote.path]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto px-10 py-8">
      <div className="max-w-[680px] mx-auto">
        {editor && (
          <BubbleMenu editor={editor}>
            <ToggleGroup 
              type="multiple" 
              size="sm" 
              variant="outline"
              className="bg-background border shadow-lg rounded-md p-0.5 gap-0.5"
            >
              <ToggleGroupItem
                value="bold"
                data-state={editor.isActive("bold") ? "on" : "off"}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <Bold className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="italic"
                data-state={editor.isActive("italic") ? "on" : "off"}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <Italic className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="strike"
                data-state={editor.isActive("strike") ? "on" : "off"}
                onClick={() => editor.chain().focus().toggleStrike().run()}
              >
                <Strikethrough className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="link"
                data-state={editor.isActive("link") ? "on" : "off"}
                onClick={() => {
                  if (editor.isActive("link")) {
                    editor.chain().focus().unsetLink().run();
                  } else {
                    const url = window.prompt("Enter URL:");
                    if (url) editor.chain().focus().setLink({ href: url }).run();
                  }
                }}
              >
                <Link2 className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </BubbleMenu>
        )}

        <EditableTitle title={activeNote.title} path={activeNote.path} />

        <div className="mb-8">
          <TagInput />
        </div>

        {isRawMode ? (
          <RawEditor content={rawContent} onChange={onRawChange} />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  );
}
