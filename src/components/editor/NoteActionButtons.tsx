import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { FileText, Code, Copy, Check, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportDialog, type ExportFormat } from "@/components/editor/ExportDialog";
import { cn } from "@/lib/utils";

interface NoteActionButtonsProps {
  isRawMode: boolean;
  onToggleRaw: (isRaw: boolean) => void;
  notePath?: string;
  noteTitle?: string;
  hasHeadings: boolean;
  isTocOpen: boolean;
  onToggleToc: () => void;
}

export function NoteActionButtons({
  isRawMode,
  onToggleRaw,
  notePath,
  noteTitle,
  hasHeadings,
  isTocOpen,
  onToggleToc,
}: NoteActionButtonsProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("markdown");
  const [copied, setCopied] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const button = document.getElementById('export-button');
      if (exportMenuRef.current && button && !button.contains(e.target as Node) && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
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
      setTimeout(() => setCopied(false), 3000);
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
    <div className="flex items-center">
      <div className="h-10 w-px bg-border" />

      <Button
        variant="ghost"
        className={cn(
          "h-10 w-10 rounded-none",
          isTocOpen && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
        )}
        title="Table of Contents (Ctrl+Shift+T)"
        onClick={onToggleToc}
        disabled={!hasHeadings}
      >
        <BookOpen className="h-4 w-4" />
      </Button>

      <div className="h-10 w-px bg-border" />

      <Button
        variant="ghost"
        className={cn(
          "h-10 w-10 rounded-none",
          isRawMode && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
        )}
        onClick={() => onToggleRaw(!isRawMode)}
        disabled={!notePath}
      >
        {isRawMode ? (
          <FileText className="h-4 w-4" />
        ) : (
          <Code className="h-4 w-4" />
        )}
      </Button>

      <div className="h-10 w-px bg-border" />

      <Button
        variant="ghost"
        className={cn(
          "h-10 w-10 rounded-none",
          copied && "bg-primary/10 text-primary"
        )}
        onClick={handleCopyMarkdown}
        disabled={!notePath}
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>

      <div className="h-10 w-px bg-border" />

      <div className="relative" ref={exportMenuRef}>
        <Button
          variant="ghost"
          className={cn(
            "h-10 w-10 rounded-none",
            exportMenuOpen && "bg-accent"
          )}
          title="Export"
          disabled={!notePath}
          onClick={() => setExportMenuOpen((v) => !v)}
          id="export-button"
        >
          <Download className="h-4 w-4" />
        </Button>

        {exportMenuOpen && (
          <div className="absolute right-0 top-full mt-1 z-[110] w-max rounded-md border bg-popover p-1 text-popover-foreground shadow-md origin-top-right animate-in fade-in zoom-in-95 whitespace-nowrap">
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