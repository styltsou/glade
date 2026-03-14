import { Folder } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Vault } from "@/types";
import type { FolderNode, VaultTarget } from "../types";
import { FolderTree } from "./FolderTree";

interface ImportPreviewProps {
  folderTree: FolderNode[];
  totalCount: number;
  sourcePath: string;
  targetVault: VaultTarget;
  selectedVaultId: string;
  vaults: Vault[];
  newVaultName: string;
  newVaultError: string;
  onTargetVaultChange: (vault: VaultTarget) => void;
  onSelectedVaultIdChange: (id: string) => void;
  onNewVaultNameChange: (name: string) => void;
}

export function ImportPreview({
  folderTree,
  totalCount,
  sourcePath,
  targetVault,
  selectedVaultId,
  vaults,
  newVaultName,
  newVaultError,
  onTargetVaultChange,
  onSelectedVaultIdChange,
  onNewVaultNameChange,
}: ImportPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
        <Folder className="h-8 w-8 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{sourcePath}</p>
          <p className="text-sm text-muted-foreground">
            {totalCount} markdown {totalCount === 1 ? "file" : "files"} found
          </p>
        </div>
      </div>

      <div className="max-h-48 overflow-y-auto border rounded-lg p-2">
        <FolderTree nodes={folderTree} />
      </div>

      <div className="space-y-3">
        <Label>Import into:</Label>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="vaultTarget"
              checked={targetVault === "existing"}
              onChange={() => onTargetVaultChange("existing")}
              className="accent-primary"
            />
            <span className="text-sm">Existing vault</span>
            <select
              value={selectedVaultId}
              onChange={(e) => onSelectedVaultIdChange(e.target.value)}
              disabled={targetVault !== "existing"}
              className="ml-auto px-2 py-1 text-sm border rounded bg-background"
            >
              {vaults.map((vault) => (
                <option key={vault.id} value={vault.id}>
                  {vault.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="vaultTarget"
              checked={targetVault === "new"}
              onChange={() => onTargetVaultChange("new")}
              className="accent-primary"
            />
            <span className="text-sm">New vault</span>
          </label>

          {targetVault === "new" && (
            <div className="ml-6">
              <Input
                placeholder="Vault name"
                value={newVaultName}
                onChange={(e) => onNewVaultNameChange(e.target.value)}
                className="w-full"
              />
              {newVaultError && (
                <p className="text-sm text-destructive mt-1">{newVaultError}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
