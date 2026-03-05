import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export type ExportFormat = "markdown" | "pdf";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notePath: string;
  noteTitle: string;
  initialFormat?: ExportFormat;
}

export function ExportDialog({
  open,
  onOpenChange,
  notePath,
  noteTitle,
  initialFormat = "markdown",
}: ExportDialogProps) {
  const [stripFrontmatter, setStripFrontmatter] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Reset state when dialog opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setStripFrontmatter(false);
      setIsExporting(false);
    }
    onOpenChange(nextOpen);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const isMarkdown = initialFormat === "markdown";
      const ext = isMarkdown ? "md" : "pdf";
      const name = isMarkdown ? "Markdown" : "PDF";
      
      const dest = await save({
        defaultPath: `${noteTitle}.${ext}`,
        filters: [{ name, extensions: [ext] }],
      });

      if (!dest) {
        setIsExporting(false);
        return; // User cancelled
      }

      const command = isMarkdown ? "export_markdown" : "export_pdf";
      
      await invoke(command, {
        sourcePath: notePath,
        destPath: dest,
        stripFrontmatter,
      });

      toast.success(`Note exported as ${name}`);
      onOpenChange(false);
      
    } catch (err) {
      toast.error(`Export failed: ${err}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>
            Export as {initialFormat === "markdown" ? "Markdown" : "PDF"}
          </DialogTitle>
          <DialogDescription>
            Configure export options for your note.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-4 text-left">
          {/* Strip frontmatter option */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="strip-frontmatter"
              checked={stripFrontmatter}
              onCheckedChange={(checked) =>
                setStripFrontmatter(checked === true)
              }
            />
            <Label
              htmlFor="strip-frontmatter"
              className="text-sm cursor-pointer"
            >
              Strip frontmatter
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting}>
            {isExporting ? "Exporting…" : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
