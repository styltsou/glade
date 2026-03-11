import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Display name of the item being deleted (note title or folder name). */
  name: string;
  type?: "note" | "folder" | "vault";
  onConfirm: () => void;
  description?: React.ReactNode;
  /** If provided, user must type this exact text to enable delete button. */
  requireConfirmationText?: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  name,
  type = "note",
  onConfirm,
  description,
  requireConfirmationText,
}: DeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const isConfirmValid = !requireConfirmationText || confirmText === requireConfirmationText;

  // Reset input when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setConfirmText("");
    }
  }, [open]);

  const handleConfirm = () => {
    if (isConfirmValid) {
      onConfirm();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent 
        onKeyDown={(e) => {
          if (e.key === "Enter" && isConfirmValid) {
            e.preventDefault();
            handleConfirm();
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {type}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {description || (
              <>
                <span className="font-medium text-foreground">{name}</span> will be
                permanently deleted. This cannot be undone.
              </>
            )}
          </AlertDialogDescription>
          {requireConfirmationText && (
            <div className="mt-4 space-y-2">
              <p className="text-sm">
                Please type <span className="font-mono font-medium text-foreground px-1 bg-muted rounded-sm">
                  {requireConfirmationText}
                </span> to confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={requireConfirmationText}
                autoFocus
                className="h-9"
              />
            </div>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={!isConfirmValid}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
