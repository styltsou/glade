import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { FileText, Code, Copy, Check, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconSwitch } from "@/components/ui/icon-switch";
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
    <div className="flex items-center gap-2">
      <IconSwitch
        checked={isRawMode}
        onCheckedChange={onToggleRaw}
        disabled={!notePath}
        checkedIcon={<Code className="h-4 w-4" />}
        uncheckedIcon={<FileText className="h-4 w-4" />}
      />

      <div className="flex h-8 items-center rounded-md border border-input bg-muted shadow-xs">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopyMarkdown}
          disabled={!notePath}
          className={cn(
            "h-full px-3 rounded-l-[calc(var(--radius-md)-1px)] rounded-r-none gap-1.5",
            copied && "bg-primary/10 text-primary"
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="text-sm font-medium">{copied ? "Copied" : "Copy"}</span>
        </Button>

        <div className="w-px h-full bg-border" />

        <div className="relative h-full" ref={exportMenuRef}>
          <Button
            variant="ghost"
            size="sm"
            title="Export"
            disabled={!notePath}
            onClick={() => setExportMenuOpen((v) => !v)}
            className={cn(
              "h-full w-8 p-0 rounded-l-none rounded-r-[calc(var(--radius-md)-1px)]",
              exportMenuOpen && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
            )}
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
