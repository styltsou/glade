import { useEffect } from "react";
import { Folder, Files } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const defaultVaultName = sourcePath.split(/[/\\]/).pop() || "";

  useEffect(() => {
    if (!newVaultName && defaultVaultName) {
      onNewVaultNameChange(defaultVaultName);
    }
  }, []);
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

      {totalCount === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground border rounded-lg">
          <Files className="h-10 w-10 opacity-50" />
          <p className="text-sm">No markdown files found in this folder</p>
          <p className="text-xs">Select a folder containing .md files to import</p>
        </div>
      ) : (
        <div className="min-w-0 min-h-[100px] max-h-80 overflow-y-auto border rounded-lg p-2">
          <FolderTree nodes={folderTree} />
        </div>
      )}

      <div className="space-y-3">
        <Label>Import into:</Label>

        <RadioGroup
          value={targetVault}
          onValueChange={(value) => onTargetVaultChange(value as VaultTarget)}
          className="space-y-1"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="existing" id="existing" />
            <Label htmlFor="existing" className="text-sm cursor-pointer">Existing vault</Label>
            <Select
              value={selectedVaultId}
              onValueChange={onSelectedVaultIdChange}
              disabled={targetVault !== "existing"}
            >
              <SelectTrigger className="ml-auto w-[180px] h-8">
                <SelectValue placeholder="Select vault" />
              </SelectTrigger>
              <SelectContent>
                {vaults.map((vault) => (
                  <SelectItem key={vault.id} value={vault.id}>
                    {vault.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <RadioGroupItem value="new" id="new" />
            <Label htmlFor="new" className="text-sm cursor-pointer">New vault</Label>
            <Input
              placeholder="Vault name"
              value={newVaultName}
              onChange={(e) => onNewVaultNameChange(e.target.value)}
              disabled={targetVault !== "new"}
              className="ml-auto w-[180px] h-8"
            />
          </div>
          {targetVault === "new" && newVaultError && (
            <p className="text-sm text-destructive ml-6">{newVaultError}</p>
          )}
        </RadioGroup>
      </div>
    </div>
  );
}
