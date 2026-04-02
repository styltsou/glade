import { useEffect, useState, useCallback } from "react";
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
  onToggleRaw: (isRaw: boolean) => void;
  notePath?: string;
  noteTitle?: string;
  isTocOpen: boolean;
  onToggleToc: () => void;
}

export function EditorToolbar({
  editor,
  isRawMode,
  onToggleRaw,
  notePath,
  noteTitle,
  isTocOpen,
  onToggleToc,
}: EditorToolbarProps) {
  const [hasHeadings, setHasHeadings] = useState(false);

  const checkHeadings = useCallback(() => {
    if (!editor?.state?.doc) {
      setHasHeadings(false);
      return;
    }
    let found = false;
    editor.state.doc.descendants((node) => {
      if (node.type.name === "heading") {
        found = true;
        return false;
      }
      return true;
    });
    setHasHeadings(found);
  }, [editor]);

  useEffect(() => {
    checkHeadings();

    if (!editor) return;

    editor.on("update", checkHeadings);
    editor.on("selectionUpdate", checkHeadings);

    return () => {
      editor.off("update", checkHeadings);
      editor.off("selectionUpdate", checkHeadings);
    };
  }, [editor, checkHeadings]);

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
        hasHeadings={hasHeadings}
        isTocOpen={isTocOpen}
        onToggleToc={onToggleToc}
      />
    </div>
  );
}
