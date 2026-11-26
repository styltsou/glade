import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Tip } from "@/components/ui/tooltip";
import { useStore } from "@/store";
import { baseName, splitExtension } from "@/lib/paths";

interface RenameDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  path: string | null;
  isFolder?: boolean;
  /** Resolves to what went wrong, or null. */
  onRename: (name: string) => Promise<string | null>;
}

/** Renames a file or folder. A note's title is edited in the note instead. */
export function RenameDialog({ isOpen, onOpenChange, path, isFolder, onRename }: RenameDialogProps) {
  const { stem, ext } = !path
    ? { stem: "", ext: "" }
    : isFolder
      ? { stem: baseName(path), ext: "" }
      : splitExtension(path);

  const [name, setName] = useState(stem);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fromTitle, setFromTitle] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Before the dialog takes focus and selects the name, or it selects the last one.
  useLayoutEffect(() => {
    if (!isOpen) return;
    setName(stem);
    setError(null);
  }, [isOpen, path, stem]);

  // Opening the dialog can finish a title edit, so follow the title.
  const title = useStore((state) => (path ? state.noteCache[path]?.title : undefined));
  useEffect(() => {
    if (!isOpen) return;
    setFromTitle(null);
    if (!path || isFolder) return;
    let current = true;
    invoke<string | null>("title_file_name", { path })
      .then((suggested) => current && setFromTitle(suggested))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [isOpen, path, isFolder, title]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || !name.trim()) return;
    if (name.trim() === stem) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    const failed = await onRename(name.trim());
    setBusy(false);
    if (failed) setError(failed);
    else onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          // Select the name (never the extension), ready to be typed over.
          e.preventDefault();
          const input = (e.currentTarget as HTMLElement).querySelector("input");
          input?.focus();
          input?.select();
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogTitle className="text-lg font-semibold">{isFolder ? "Rename folder" : "Rename file"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isFolder ? "Type a new name for this folder." : "Type a new file name. The note's title stays as it is."}
          </DialogDescription>
          <div className="flex flex-col gap-2">
            <div className="flex h-6 items-center justify-between gap-2">
              <Label htmlFor="rename-input">{isFolder ? "Folder name" : "File name"}</Label>
              {fromTitle && fromTitle !== name && (
                <Tip label={`${fromTitle}${ext}`}>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground"
                    onClick={() => {
                      setName(fromTitle);
                      setError(null);
                      inputRef.current?.focus();
                    }}
                  >
                    Use note title
                  </Button>
                </Tip>
              )}
            </div>
            <InputGroup>
              <InputGroupInput
                ref={inputRef}
                id="rename-input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                aria-invalid={!!error}
                aria-describedby={[ext && "rename-extension", error && "rename-error"].filter(Boolean).join(" ") || undefined}
                spellCheck={false}
                autoComplete="off"
              />
              {ext && <InputGroupAddon id="rename-extension">{ext}</InputGroupAddon>}
            </InputGroup>
            {error && (
              <p id="rename-error" role="alert" className="break-words text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Rename
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
