import type { Editor } from "@tiptap/react";
import {
  HeadingGroup,
  InlineGroup,
  ListGroup,
  BlockGroup,
  InsertGroup,
} from "./ToolbarGroups";
import { NoteActionButtons } from "./NoteActionButtons";

interface EditorToolbarProps {
  editor: Editor | null;
  isRawMode: boolean;
  onToggleRaw: () => void;
  notePath?: string;
  noteTitle?: string;
}

export function EditorToolbar({
  editor,
  isRawMode,
  onToggleRaw,
  notePath,
  noteTitle,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center h-9 px-6 shrink-0 bg-background sticky top-0 z-50 w-full gap-1.5">
      <HeadingGroup editor={editor} />
      <InlineGroup editor={editor} />
      <ListGroup editor={editor} />
      <BlockGroup editor={editor} />
      <InsertGroup editor={editor} />

      <div className="flex-1" />

      <NoteActionButtons
        isRawMode={isRawMode}
        onToggleRaw={onToggleRaw}
        notePath={notePath}
        noteTitle={noteTitle}
      />
    </div>
  );
}
