import { useEffect, useRef, useCallback, useState } from "react";
import { EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Bold, Italic, Strikethrough, Link2, ChevronDown, Clock } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EditableTitle } from "./EditableTitle";
import { TagInput } from "@/components/TagInput";
import { RawEditor } from "./RawEditor";
import { MentionList, MentionListHandle } from "./MentionList";
import {
  registerSuggestionCallbacks,
  unregisterSuggestionCallbacks,
  SuggestionItem,
} from "./suggestion";
import {
  registerSlashCommandCallbacks,
  unregisterSlashCommandCallbacks,
  SlashCommandItem,
} from "./SlashCommands";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/dates";

interface NoteEditorProps {
  activeNote: {
    title: string;
    path: string;
    updated: string | null;
    created: string | null;
    [key: string]: any;
  };
  editor: Editor | null;
  isRawMode: boolean;
  rawContent: string;
  onRawChange: (value: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onScroll: () => void;
}

const blockTypes = [
  { id: "paragraph", label: "Paragraph" },
  { id: "heading-1", label: "Heading 1", level: 1 },
  { id: "heading-2", label: "Heading 2", level: 2 },
  { id: "heading-3", label: "Heading 3", level: 3 },
  { id: "heading-4", label: "Heading 4", level: 4 },
  { id: "bulletList", label: "Bullet list" },
  { id: "orderedList", label: "Ordered list" },
  { id: "taskList", label: "Task list" },
  { id: "blockquote", label: "Blockquote" },
  { id: "codeBlock", label: "Code block" },
];

function convertToBlockType(editor: Editor, blockTypeId: string) {
  switch (blockTypeId) {
    case "paragraph":
      editor.chain().focus().setParagraph().run();
      break;
    case "heading-1":
      editor.chain().focus().toggleHeading({ level: 1 }).run();
      break;
    case "heading-2":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case "heading-3":
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      break;
    case "heading-4":
      editor.chain().focus().toggleHeading({ level: 4 }).run();
      break;
    case "bulletList":
      editor.chain().focus().toggleBulletList().run();
      break;
    case "orderedList":
      editor.chain().focus().toggleOrderedList().run();
      break;
    case "taskList":
      editor.chain().focus().toggleTaskList().run();
      break;
    case "blockquote":
      editor.chain().focus().toggleBlockquote().run();
      break;
    case "codeBlock":
      editor.chain().focus().toggleCodeBlock().run();
      break;
  }
}

function getCurrentBlockType(editor: Editor): string {
  if (editor.isActive("paragraph")) return "paragraph";
  if (editor.isActive("heading", { level: 1 })) return "heading-1";
  if (editor.isActive("heading", { level: 2 })) return "heading-2";
  if (editor.isActive("heading", { level: 3 })) return "heading-3";
  if (editor.isActive("heading", { level: 4 })) return "heading-4";
  if (editor.isActive("bulletList")) return "bulletList";
  if (editor.isActive("orderedList")) return "orderedList";
  if (editor.isActive("taskList")) return "taskList";
  if (editor.isActive("blockquote")) return "blockquote";
  if (editor.isActive("codeBlock")) return "codeBlock";
  return "paragraph";
}

function BubbleButton({ 
  children, 
  onClick, 
  isActive = false,
  className = "",
}: { 
  children: React.ReactNode; 
  onClick?: () => void; 
  isActive?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center h-8 w-8 rounded-sm text-sm font-medium transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        isActive && "bg-primary/10 text-primary",
        className
      )}
    >
      {children}
    </button>
  );
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
  const [suggestionPosition, setSuggestionPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [suggestionVisible, setSuggestionVisible] = useState(false);
  const [slashItems, setSlashItems] = useState<SlashCommandItem[]>([]);
  const [slashPosition, setSlashPosition] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [slashVisible, setSlashVisible] = useState(false);
  const [blockPopoverOpen, setBlockPopoverOpen] = useState(false);
  const [currentBlockType, setCurrentBlockType] = useState("paragraph");
  const mentionListRef = useRef<MentionListHandle>(null);
  const suggestionCommandRef = useRef<((item: SuggestionItem) => void) | null>(null);
  const blockTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editor) return;
    
    const updateBlockType = () => {
      setCurrentBlockType(getCurrentBlockType(editor));
    };
    
    updateBlockType();
    editor.on("selectionUpdate", updateBlockType);
    editor.on("transaction", updateBlockType);
    
    return () => {
      editor.off("selectionUpdate", updateBlockType);
      editor.off("transaction", updateBlockType);
    };
  }, [editor]);

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

        const spaceBelow = window.innerHeight - clientRect.bottom;
        const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

        suggestionCommandRef.current = props.command;
        
        requestAnimationFrame(() => {
          setSuggestionItems(props.items);
          setSuggestionPosition({
            top: showAbove ? undefined : clientRect.bottom + 4,
            bottom: showAbove ? window.innerHeight - clientRect.top + 4 : undefined,
            left: clientRect.left,
          });
          setSuggestionVisible(true);
        });
      },
      (props) => {
        if (!props.clientRect) return;
        const clientRect = props.clientRect();
        if (!clientRect) return;

        const spaceBelow = window.innerHeight - clientRect.bottom;
        const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

        suggestionCommandRef.current = props.command;
        
        requestAnimationFrame(() => {
          setSuggestionItems(props.items);
          setSuggestionPosition({
            top: showAbove ? undefined : clientRect.bottom + 4,
            bottom: showAbove ? window.innerHeight - clientRect.top + 4 : undefined,
            left: clientRect.left,
          });
        });
      },
      () => {
        requestAnimationFrame(() => {
          setSuggestionVisible(false);
          suggestionCommandRef.current = null;
        });
      }
    );

    return () => {
      unregisterSuggestionCallbacks();
      setSuggestionVisible(false);
    };
  }, [editor]);

  // Slash command callbacks
  useEffect(() => {
    if (!editor) return;

    registerSlashCommandCallbacks(
      (props) => {
        if (!props.clientRect) return;
        const clientRect = props.clientRect();
        if (!clientRect) return;

        const spaceBelow = window.innerHeight - clientRect.bottom;
        const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

        requestAnimationFrame(() => {
          setSlashItems(props.items);
          setSlashPosition({
            top: showAbove ? undefined : clientRect.bottom + 4,
            bottom: showAbove ? window.innerHeight - clientRect.top + 4 : undefined,
            left: clientRect.left,
          });
          setSlashVisible(true);
        });
      },
      (props) => {
        if (!props.clientRect) return;
        const clientRect = props.clientRect();
        if (!clientRect) return;

        const spaceBelow = window.innerHeight - clientRect.bottom;
        const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

        requestAnimationFrame(() => {
          setSlashItems(props.items);
          setSlashPosition({
            top: showAbove ? undefined : clientRect.bottom + 4,
            bottom: showAbove ? window.innerHeight - clientRect.top + 4 : undefined,
            left: clientRect.left,
          });
        });
      },
      () => {
        requestAnimationFrame(() => {
          setSlashVisible(false);
        });
      }
    );

    return () => {
      unregisterSlashCommandCallbacks();
      setSlashVisible(false);
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
    <div ref={scrollRef as React.RefObject<HTMLDivElement>} onScroll={onScroll} className="flex-1 overflow-auto px-10 py-8">
      <div className="max-w-[680px] mx-auto">
        {editor && (
          <BubbleMenu editor={editor}>
            <div className="flex items-center bg-background border shadow-lg rounded-md p-0.5 gap-0.5">
              <Popover open={blockPopoverOpen} onOpenChange={setBlockPopoverOpen}>
                <PopoverTrigger asChild>
                  <button
                    ref={blockTriggerRef}
                    type="button"
                    className={cn(
                      "inline-flex items-center justify-center gap-2 h-8 px-2 rounded-sm text-sm font-medium transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    )}
                  >
                    <span className="text-sm">
                      {blockTypes.find(bt => bt.id === currentBlockType)?.label || "Paragraph"}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </PopoverTrigger>
                <PopoverContent 
                  className="w-48 p-1" 
                  align="start"
                  sideOffset={4}
                >
                  {blockTypes.map((bt) => (
                    <button
                      key={bt.id}
                      type="button"
                      onClick={() => {
                        convertToBlockType(editor, bt.id);
                        setBlockPopoverOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                        currentBlockType === bt.id && "bg-accent text-accent-foreground"
                      )}
                    >
                      {bt.label}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <BubbleButton
                onClick={() => editor.chain().focus().toggleBold().run()}
                isActive={editor.isActive("bold")}
              >
                <Bold className="h-4 w-4" />
              </BubbleButton>
              <BubbleButton
                onClick={() => editor.chain().focus().toggleItalic().run()}
                isActive={editor.isActive("italic")}
              >
                <Italic className="h-4 w-4" />
              </BubbleButton>
              <BubbleButton
                onClick={() => editor.chain().focus().toggleStrike().run()}
                isActive={editor.isActive("strike")}
              >
                <Strikethrough className="h-4 w-4" />
              </BubbleButton>
              <BubbleButton
                onClick={() => {
                  if (editor.isActive("link")) {
                    editor.chain().focus().unsetLink().run();
                  } else {
                    const url = window.prompt("Enter URL:");
                    if (url) editor.chain().focus().setLink({ href: url }).run();
                  }
                }}
                isActive={editor.isActive("link")}
              >
                <Link2 className="h-4 w-4" />
              </BubbleButton>
            </div>
          </BubbleMenu>
        )}

        <EditableTitle 
          title={activeNote.title} 
          path={activeNote.path} 
          created={activeNote.created}
        />

        {activeNote.updated && (
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
            <Clock className="w-4 h-4" />
            <span>Modified {formatRelativeDate(activeNote.updated)}</span>
          </div>
        )}

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

        {slashVisible && slashPosition && (
          <div
            className="fixed z-[1000] min-w-[200px]"
            style={{
              top: slashPosition.top,
              bottom: slashPosition.bottom,
              left: slashPosition.left,
            }}
          >
            <div className="flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
              <div className="max-h-[300px] overflow-y-auto p-1 scroll-py-1">
                {slashItems.length ? (
                  slashItems.map((item) => (
                    <div
                      key={item.id}
                      className="relative flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="truncate font-medium">{item.label}</span>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground italic text-center">No matches</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
