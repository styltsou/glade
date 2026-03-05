import { Editor } from "@tiptap/react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Bold, Italic, Strikethrough,
  List, ListOrdered, CheckSquare,
  Quote, Code, Minus, Link2,
  Heading1, Heading2, Heading3, Heading4,
} from "lucide-react";

interface GroupProps {
  editor: Editor | null;
}

export function HeadingGroup({ editor }: GroupProps) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
      <ToggleGroupItem
        value="h1"
        data-state={editor?.isActive("heading", { level: 1 }) ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="h2"
        data-state={editor?.isActive("heading", { level: 2 }) ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="h3"
        data-state={editor?.isActive("heading", { level: 3 }) ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="h4"
        data-state={editor?.isActive("heading", { level: 4 }) ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 4 }).run()}
      >
        <Heading4 className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function InlineGroup({ editor }: GroupProps) {
  return (
    <ToggleGroup type="multiple" variant="outline" size="sm" className="bg-muted">
      <ToggleGroupItem
        value="bold"
        data-state={editor?.isActive("bold") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="italic"
        data-state={editor?.isActive("italic") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="strike"
        data-state={editor?.isActive("strike") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function ListGroup({ editor }: GroupProps) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
      <ToggleGroupItem
        value="bulletList"
        data-state={editor?.isActive("bulletList") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="orderedList"
        data-state={editor?.isActive("orderedList") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="taskList"
        data-state={editor?.isActive("taskList") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleTaskList().run()}
      >
        <CheckSquare className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function BlockGroup({ editor }: GroupProps) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
      <ToggleGroupItem
        value="blockquote"
        data-state={editor?.isActive("blockquote") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="codeBlock"
        data-state={editor?.isActive("codeBlock") ? "on" : "off"}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <Code className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function InsertGroup({ editor }: GroupProps) {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" className="bg-muted">
      <ToggleGroupItem
        value="hr"
        onClick={() => editor?.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="h-4 w-4" />
      </ToggleGroupItem>
      <ToggleGroupItem
        value="link"
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
        <Link2 className="h-4 w-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
