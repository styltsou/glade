import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface CreateFolderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (folderName: string) => void;
}

export function CreateFolderDialog({
  isOpen,
  onOpenChange,
  onCreate,
}: CreateFolderDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setName("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Folder</DialogTitle>
          <DialogDescription>
            Enter a name for the new folder.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="w-full"
            placeholder="Folder name..."
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
