import { useState } from "react";
import { useStore } from "@/store";
import type { Vault } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Folder, Pencil, Trash2, Check, X, Loader2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

interface VaultItemProps {
  vault: Vault;
  isActive: boolean;
  onSetActive: () => void;
  onRename: (name: string, slug: string) => void;
  onDelete: () => void;
}

function VaultItem({ vault, isActive, onSetActive, onRename, onDelete }: VaultItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(vault.name);
  const [editSlug, setEditSlug] = useState(vault.slug);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSave = () => {
    if (editName.trim() && editSlug.trim() && (editName !== vault.name || editSlug !== vault.slug)) {
      onRename(editName.trim(), editSlug.trim());
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(vault.name);
    setEditSlug(vault.slug);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-background">
        <div className="flex-1 space-y-2">
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Vault name"
            className="h-8"
          />
          <Input
            value={editSlug}
            onChange={(e) => setEditSlug(e.target.value)}
            placeholder="Vault slug"
            className="h-8 text-muted-foreground text-xs"
          />
        </div>
        <div className="flex flex-col gap-1">
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSave}>
            <Check className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancel}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
          isActive
            ? "border-primary bg-primary/5"
            : "border-border hover:bg-muted/50"
        )}
        onClick={onSetActive}
      >
        <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
          <Folder className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{vault.name}</div>
          <div className="text-xs text-muted-foreground truncate uppercase tracking-wider opacity-70">
            Vault • {vault.slug}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Created {formatDate(vault.created_at)} • Last opened {formatDate(vault.last_opened)}
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vault</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{vault.name}"? This will permanently delete all
              notes in this vault. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Vault
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function VaultsSection() {
  const vaults = useStore((state) => state.vaults);
  const activeVault = useStore((state) => state.activeVault);
  const isVaultsLoading = useStore((state) => state.isVaultsLoading);
  const renameVault = useStore((state) => state.renameVault);
  const deleteVault = useStore((state) => state.deleteVault);
  const setActiveVault = useStore((state) => state.setActiveVault);
  const setCurrentView = useStore((state) => state.setCurrentView);

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

  const handleSetActive = async (vaultId: string) => {
    await setActiveVault(vaultId);
    setCurrentView("home");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Vaults</h3>
        <p className="text-sm text-muted-foreground">
          Manage your vaults. Click on a vault to set it as active.
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
        <div className="space-y-2">
          { vaults.map((vault) => (
            <VaultItem
              key={vault.id}
              vault={vault}
              isActive={activeVault?.id === vault.id}
              onSetActive={() => handleSetActive(vault.id)}
              onRename={(name, slug) => handleRename(vault.id, name, slug)}
              onDelete={() => handleDelete(vault.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
