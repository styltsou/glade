import { useStore } from "@/store";
import { VaultCard } from "./VaultCard";
import { Loader2 } from "lucide-react";

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
