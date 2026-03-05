import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { Editor } from "@tiptap/react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
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
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { ExportDialog, type ExportFormat } from "@/components/editor/ExportDialog";

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
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!notePath) return;
    try {
      const raw = await invoke<string>("read_note_raw", { path: notePath });
      // Strip YAML frontmatter before copying
      const stripped = raw.replace(/^---[\s\S]*?---\s*\n?/, "");
      await writeText(stripped);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Markdown copied to clipboard");
    } catch (err) {
      toast.error(`Failed to copy: ${err}`);
    }
  }, [notePath]);

  const handleExport = useCallback((format: ExportFormat) => {
    setExportMenuOpen(false);
    setExportFormat(format);
    setExportOpen(true);
  }, []);

  return (
    <>
      <div className="flex items-center h-9 px-4 shrink-0 bg-background sticky top-0 z-50 w-full gap-1.5">

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

        {/* Document Actions */}
        <div className="flex items-center rounded-md border bg-muted">
          {/* View Raw */}
          <Button
            variant="ghost"
            size="sm"
            title={isRawMode ? "Rich View" : "Raw Markdown"}
            onClick={onToggleRaw}
            className={cn("h-8 w-8 p-0 rounded-none rounded-l-sm", isRawMode && "bg-accent text-accent-foreground")}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>

          <div className="w-px h-5 bg-border" />

          {/* Copy Markdown */}
          <Button
            variant="ghost"
            size="sm"
            title={copied ? "Copied!" : "Copy Markdown"}
            onClick={handleCopyMarkdown}
            disabled={!notePath}
            className="h-8 w-8 p-0 rounded-none"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>

          <div className="w-px h-5 bg-border" />

          {/* Export — custom inline dropdown to avoid Radix portal/z-index issues in Tauri */}
          <div className="relative" ref={exportMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              title="Export"
              disabled={!notePath}
              onClick={() => setExportMenuOpen((v) => !v)}
              className="h-8 w-8 p-0 rounded-none rounded-r-sm"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>

            {exportMenuOpen && (
              <div className="absolute right-0 top-full mt-1 z-[100] min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <button
                  className="w-full text-left flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  onClick={() => handleExport("markdown")}
                >
                  Export as Markdown
                </button>
                <button
                  className="w-full text-left flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                  onClick={() => handleExport("pdf")}
                >
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export dialog */}
      {notePath && noteTitle && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          notePath={notePath}
          noteTitle={noteTitle}
          initialFormat={exportFormat}
        />
      )}
    </>
  );
}
