import { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react";
import { EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Strikethrough, Link2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EditableTitle } from "./EditableTitle";
import { TagInput } from "@/components/TagInput";
import { RawEditor } from "./RawEditor";
import { MentionList, MentionListHandle } from "./MentionList";
import { useStore } from "@/store";
import {
  registerSuggestionCallbacks,
  unregisterSuggestionCallbacks,
  SuggestionItem,
} from "./suggestion";

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
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

export function NoteEditor({
  activeNote,
  editor,
  isRawMode,
  rawContent,
  onRawChange,
  scrollRef,
  onScroll,
}: NoteEditorProps) {
  const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>([]);
  const [suggestionPosition, setSuggestionPosition] = useState<{ top: number; left: number } | null>(null);
  const [suggestionVisible, setSuggestionVisible] = useState(false);
  const mentionListRef = useRef<MentionListHandle>(null);
  const suggestionCommandRef = useRef<((item: SuggestionItem) => void) | null>(null);

  const handleSuggestionCommand = useCallback((item: SuggestionItem) => {
    if (suggestionCommandRef.current) {
      suggestionCommandRef.current(item);
    }
    setSuggestionVisible(false);
  }, []);

  useEffect(() => {
    if (!editor) return;

    registerSuggestionCallbacks(
      (props) => {
        if (!props.clientRect) return;
        const clientRect = props.clientRect();
        if (!clientRect) return;

        suggestionCommandRef.current = props.command;
        setSuggestionItems(props.items);
        setSuggestionPosition({
          top: clientRect.bottom + 4,
          left: clientRect.left,
        });
        setSuggestionVisible(true);
      },
      (props) => {
        if (!props.clientRect) return;
        const clientRect = props.clientRect();
        if (!clientRect) return;

        setSuggestionItems(props.items);
        setSuggestionPosition({
          top: clientRect.bottom + 4,
          left: clientRect.left,
        });
      },
      () => {
        setSuggestionVisible(false);
        suggestionCommandRef.current = null;
      }
    );

    return () => {
      unregisterSuggestionCallbacks();
      setSuggestionVisible(false);
    };
  }, [editor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!suggestionVisible || !mentionListRef.current) return;
      
      const result = mentionListRef.current.onKeyDown({ event: e });
      if (result) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [suggestionVisible]);

  return (
    <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-auto px-10 py-8">
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

        {suggestionVisible && suggestionPosition && (
          <MentionList
            ref={mentionListRef}
            items={suggestionItems}
            position={suggestionPosition}
            command={handleSuggestionCommand}
          />
        )}
      </div>
    </div>
  );
}
