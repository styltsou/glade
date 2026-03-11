import { useState } from "react";
import { useStore } from "@/store";
import type { Vault } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { Vault as VaultIcon, Pencil, Trash2, Github, Loader2, Check, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface VaultCardProps {
  vault: Vault;
  isActive: boolean;
  onRename: (name: string, slug: string) => void;
  onDelete: () => void;
  onUpdateGitRemote: (gitRemote: string | null) => void;
  canDelete: boolean;
}

function VaultCard({ vault, isActive, onRename, onDelete, onUpdateGitRemote, canDelete }: VaultCardProps) {
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
        {/* Header section */}
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

        {/* Sync section */}
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

        {/* Actions section */}
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

export function VaultsSection() {
  const vaults = useStore((state) => state.vaults);
  const activeVault = useStore((state) => state.activeVault);
  const isVaultsLoading = useStore((state) => state.isVaultsLoading);
  const renameVault = useStore((state) => state.renameVault);
  const deleteVault = useStore((state) => state.deleteVault);
  const updateVaultGitRemote = useStore((state) => state.updateVaultGitRemote);

  const handleDelete = async (vaultId: string) => {
    try {
      await deleteVault(vaultId);
    } catch (e) {
      console.error("Failed to delete vault:", e);
    }
  };

  const handleRename = async (vaultId: string, name: string, slug: string) => {
    try {
      await renameVault(vaultId, name, slug);
    } catch (e) {
      console.error("Failed to rename vault:", e);
    }
  };

  const handleUpdateGitRemote = async (vaultId: string, gitRemote: string | null) => {
    try {
      await updateVaultGitRemote(vaultId, gitRemote);
    } catch (e) {
      console.error("Failed to update git remote:", e);
    }
  };

  return (
    <div className="w-full space-y-6 pb-10">
      <div className="space-y-2 mt-4">
        <h3 className="text-lg font-semibold">Vaults</h3>
        <p className="text-sm text-muted-foreground w-full">
          Manage your vaults and their synchronization settings.
        </p>
      </div>

      {isVaultsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : vaults.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No vaults yet. Create one from the sidebar.
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(400px,1fr))] gap-6 w-full">
          {vaults.map((vault) => (
            <VaultCard
              key={vault.id}
              vault={vault}
              isActive={activeVault?.id === vault.id}
              onRename={(name, slug) => handleRename(vault.id, name, slug)}
              onDelete={() => handleDelete(vault.id)}
              onUpdateGitRemote={(gitRemote) => handleUpdateGitRemote(vault.id, gitRemote)}
              canDelete={vaults.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
