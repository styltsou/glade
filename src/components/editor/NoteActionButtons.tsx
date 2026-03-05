import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { Eye, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportDialog, type ExportFormat } from "@/components/editor/ExportDialog";
import { cn } from "@/lib/utils";

interface NoteActionButtonsProps {
  isRawMode: boolean;
  onToggleRaw: () => void;
  notePath?: string;
  noteTitle?: string;
}

export function NoteActionButtons({
  isRawMode,
  onToggleRaw,
  notePath,
  noteTitle,
}: NoteActionButtonsProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

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
      const stripped = raw.replace(/^---[\s\S]*?---\s*\n?/, "");
      
      let finalMarkdown = stripped.trimStart();
      if (noteTitle && !finalMarkdown.startsWith("# ")) {
        finalMarkdown = `# ${noteTitle}\n\n${finalMarkdown}`;
      }
      
      await writeText(finalMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Markdown copied to clipboard");
    } catch (err) {
      toast.error(`Failed to copy: ${err}`);
    }
  }, [notePath, noteTitle]);

  const handleExport = useCallback((format: ExportFormat) => {
    setExportMenuOpen(false);
    setExportFormat(format);
    setExportOpen(true);
  }, []);

  return (
    <div className="flex items-center rounded-md border bg-muted">
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
              Export
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

      {notePath && noteTitle && (
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          notePath={notePath}
          noteTitle={noteTitle}
          initialFormat={exportFormat}
        />
      )}
    </div>
  );
}
