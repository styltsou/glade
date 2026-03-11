import { useState } from "react";
import type { Vault } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Vault as VaultIcon, Pencil, Trash2, Github, Check, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface VaultCardProps {
  vault: Vault;
  isActive: boolean;
  onRename: (name: string, slug: string) => void;
  onDelete: () => void;
  onUpdateGitRemote: (gitRemote: string | null) => void;
  canDelete: boolean;
}

export function VaultCard({ vault, isActive, onRename, onDelete, onUpdateGitRemote, canDelete }: VaultCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(vault.name);
  
  const [isEditingRepo, setIsEditingRepo] = useState(false);
  const [editRepo, setEditRepo] = useState(vault.git_remote || "");
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveName = () => {
    if (editName.trim() && editName !== vault.name) {
      onRename(editName.trim(), vault.slug);
    }
    setIsEditingName(false);
  };

  const handleCancelName = () => {
    setEditName(vault.name);
    setIsEditingName(false);
  };

  const handleSaveRepo = () => {
    const newRepo = editRepo.trim() || null;
    if (newRepo !== vault.git_remote) {
      onUpdateGitRemote(newRepo);
    }
    setIsEditingRepo(false);
  };

  const handleCancelRepo = () => {
    setEditRepo(vault.git_remote || "");
    setIsEditingRepo(false);
  };

  return (
    <>
      <div className="flex flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm overflow-hidden w-full">
        <div className="p-4 border-b border-border/50 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <VaultIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              {isEditingName ? (
                <div className="flex items-center gap-1 min-w-0 flex-1">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Vault name"
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveName();
                      if (e.key === "Escape") handleCancelName();
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSaveName}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleCancelName}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="font-semibold truncate">{vault.name}</div>
              )}
            </div>
            {isActive && <Badge variant="secondary" className="shrink-0 bg-primary/10 text-primary hover:bg-primary/20 pointer-events-none">Active</Badge>}
          </div>
          
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="truncate opacity-80">Created: {formatDate(vault.created_at)}</div>
            <div className="truncate opacity-80">Last opened: {formatDate(vault.last_opened)}</div>
          </div>
        </div>

        <div className="p-4 border-b border-border/50 bg-muted/10 space-y-2">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Storage & Sync</div>
          {isEditingRepo ? (
            <div className="flex items-center gap-2">
              <Github className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                value={editRepo}
                onChange={(e) => setEditRepo(e.target.value)}
                placeholder="e.g. user/repo"
                className="h-7 text-xs flex-1"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveRepo();
                  if (e.key === "Escape") handleCancelRepo();
                }}
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSaveRepo}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleCancelRepo}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <Github className="h-4 w-4 text-muted-foreground shrink-0" />
              {vault.git_remote ? (
                <span className="truncate flex-1">{vault.git_remote}</span>
              ) : (
                <span className="truncate flex-1 text-muted-foreground italic">Not connected</span>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs px-2 shrink-0 opacity-70 hover:opacity-100" 
                onClick={() => setIsEditingRepo(true)}
                disabled={isEditingName}
              >
                Edit
              </Button>
            </div>
          )}
        </div>

        <div className="p-2 flex items-center justify-end gap-1 bg-muted/20">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8"
            onClick={() => setIsEditingName(true)}
            disabled={isEditingName || isEditingRepo}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={isEditingName || isEditingRepo || !canDelete}
            title={!canDelete ? "You cannot delete your only vault" : isActive ? "Deleting the active vault will switch to another vault" : "Delete vault"}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5 text-inherit" />
            Delete
          </Button>
        </div>
      </div>

      <DeleteConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        name={vault.name}
        type="vault"
        onConfirm={onDelete}
        requireConfirmationText={`delete ${vault.name}`}
        description={
          <>
            This will permanently delete <span className="font-medium text-foreground">{vault.name}</span> and all its notes.
            {isActive && " You will be switched to another vault."}
          </>
        }
      />
    </>
  );
}
