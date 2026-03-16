import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface RenameDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle: string;
  isFolder?: boolean;
  onRename: (newTitle: string) => void;
}

export function RenameDialog({
  isOpen,
  onOpenChange,
  initialTitle,
  isFolder,
  onRename,
}: RenameDialogProps) {
  const [title, setTitle] = useState(initialTitle);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
    }
  }, [isOpen, initialTitle]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && title !== initialTitle) {
      onRename(title.trim());
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{isFolder ? "Rename Folder" : "Rename Note"}</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="rename-input">
              {isFolder ? "Folder name" : "Note name"}
            </Label>
            <Input
              id="rename-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="w-full"
              placeholder={isFolder ? "Folder name..." : "Note title..."}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || title === initialTitle}>
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
