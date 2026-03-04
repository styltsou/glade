import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Quote,
  Link2,
  Minus,
  CheckSquare,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface EditorToolbarProps {
  editor: Editor | null;
  isRawMode: boolean;
  onToggleRaw: () => void;
}

export function EditorToolbar({ editor, isRawMode, onToggleRaw }: EditorToolbarProps) {
  return (
    <div className="flex items-center h-9 px-4 shrink-0 bg-background sticky top-0 z-10 w-full gap-1.5">

      {/* Headings */}
      <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
        <ToggleGroupItem
          value="h1"
          title="Heading 1"
          data-state={editor?.isActive("heading", { level: 1 }) ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="h2"
          title="Heading 2"
          data-state={editor?.isActive("heading", { level: 2 }) ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="h3"
          title="Heading 3"
          data-state={editor?.isActive("heading", { level: 3 }) ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="h4"
          title="Heading 4"
          data-state={editor?.isActive("heading", { level: 4 }) ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
        >
          <Heading4 />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Inline formatting */}
      <ToggleGroup type="multiple" variant="outline" size="sm" className="bg-muted">
        <ToggleGroupItem
          value="bold"
          title="Bold"
          data-state={editor?.isActive("bold") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="italic"
          title="Italic"
          data-state={editor?.isActive("italic") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="strike"
          title="Strikethrough"
          data-state={editor?.isActive("strike") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        >
          <Strikethrough />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Lists */}
      <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
        <ToggleGroupItem
          value="bulletList"
          title="Bullet List"
          data-state={editor?.isActive("bulletList") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >
          <List />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="orderedList"
          title="Ordered List"
          data-state={editor?.isActive("orderedList") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="taskList"
          title="Task List"
          data-state={editor?.isActive("taskList") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <CheckSquare />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Blocks */}
      <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
        <ToggleGroupItem
          value="blockquote"
          title="Blockquote"
          data-state={editor?.isActive("blockquote") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="codeBlock"
          title="Code Block"
          data-state={editor?.isActive("codeBlock") ? "on" : "off"}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <Code />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Inserts */}
      <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
        <ToggleGroupItem
          value="hr"
          title="Horizontal Rule"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        >
          <Minus />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="link"
          title={editor?.isActive("link") ? "Remove Link" : "Add Link"}
          data-state={editor?.isActive("link") ? "on" : "off"}
          onClick={() => {
            if (editor?.isActive("link")) {
              editor.chain().focus().unsetLink().run();
            } else {
              const url = window.prompt("Enter URL:");
              if (url) editor?.chain().focus().setLink({ href: url }).run();
            }
          }}
        >
          <Link2 />
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Raw toggle */}
      <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
        <ToggleGroupItem
          value="raw"
          title={isRawMode ? "Rich View" : "Raw Markdown"}
          data-state={isRawMode ? "on" : "off"}
          onClick={onToggleRaw}
        >
          <FileCode2 />
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
