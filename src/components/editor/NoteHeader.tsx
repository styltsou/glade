import { useState, useCallback, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Clock, FileText, Code, Copy, Check, Download, BookOpen } from "lucide-react";
import { ExportDialog, type ExportFormat } from "@/components/editor/ExportDialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface NoteHeaderProps {
  notePath: string;
  noteTitle: string;
  dateLabel?: string | null;
  saveStatus: "unsaved" | "saved" | "idle";
  hasHeadings?: boolean;
  isTocOpen?: boolean;
  onToggleToc?: () => void;
  onToggleRaw?: (isRaw: boolean) => void;
  isRawMode?: boolean;
}

export function NoteHeader({ 
  notePath, 
  noteTitle,
  dateLabel,
  saveStatus,
  hasHeadings = false,
  isTocOpen = false,
  onToggleToc,
  onToggleRaw,
  isRawMode = false,
}: NoteHeaderProps) {
  const segments = notePath.split("/");
  const parentPath = segments.slice(0, -1).join("/") || null;
  
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
    <div className="flex items-center justify-between h-10 shrink-0 select-none border-b">
      <div className="flex items-center pl-3 h-full min-w-0">
        <Breadcrumbs path={parentPath} activeItem={noteTitle} />
      </div>

      <div className="flex items-center h-full shrink-0 text-[13px] sm:text-[14px] text-muted-foreground">
        {saveStatus !== "idle" && (
          <span className="text-muted-foreground">
            {saveStatus === "saved" ? "Saved" : "Unsaved"}
          </span>
        )}
        {dateLabel && (
          <span className="text-muted-foreground text-xs flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {dateLabel}
          </span>
        )}

        <div className="h-10 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-none transition-colors cursor-pointer",
                !hasHeadings ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                isTocOpen && hasHeadings && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
              )}
              onClick={onToggleToc}
              disabled={!hasHeadings}
            >
              <BookOpen className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Table of Contents (Ctrl+Shift+T)</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-10 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-none transition-colors cursor-pointer",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
                isRawMode && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary"
              )}
              onClick={() => onToggleRaw?.(!isRawMode)}
              disabled={!notePath}
            >
              {isRawMode ? (
                <FileText className="h-4 w-4" />
              ) : (
                <Code className="h-4 w-4" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{isRawMode ? "Switch to rich text" : "Switch to raw markdown"}</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-10 w-px bg-border" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "h-10 w-10 flex items-center justify-center rounded-none transition-colors cursor-pointer",
                "text-muted-foreground hover:text-foreground hover:bg-accent",
                copied && "bg-primary/10 text-primary"
              )}
              onClick={handleCopyMarkdown}
              disabled={!notePath}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Copy as Markdown</p>
          </TooltipContent>
        </Tooltip>

        <div className="h-10 w-px bg-border" />

        <div className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  "h-10 w-10 flex items-center justify-center rounded-none transition-colors cursor-pointer",
                  "text-muted-foreground hover:text-foreground hover:bg-accent",
                  exportMenuOpen && "bg-accent"
                )}
                disabled={!notePath}
                onClick={() => setExportMenuOpen((v) => !v)}
                id="export-button"
              >
                <Download className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Export</p>
            </TooltipContent>
          </Tooltip>

          {exportMenuOpen && (
            <div ref={exportMenuRef} className="absolute right-0 top-full mt-1 z-[110] w-max rounded-md border bg-popover p-1 text-popover-foreground shadow-md origin-top-right animate-in fade-in zoom-in-95 whitespace-nowrap">
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