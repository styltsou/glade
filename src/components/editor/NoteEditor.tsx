import { EditorContent, Editor } from "@tiptap/react";
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
  return (
    <div className="flex-1 overflow-auto px-10 py-8">
      <div className="max-w-[680px] mx-auto">
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
