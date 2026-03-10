import { useState } from "react";
import { useStore } from "@/store";
import { PanelLeft, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Vault } from "@/types";

export function SidebarHeader() {
  const toggleSidebarCollapsed = useStore((state) => state.toggleSidebarCollapsed);
  const goHome = useStore((state) => state.goHome);
  const vaults = useStore((state) => state.vaults);
  const activeVault = useStore((state) => state.activeVault);
  const setActiveVault = useStore((state) => state.setActiveVault);
  const createVault = useStore((state) => state.createVault);
  
  const [newVaultName, setNewVaultName] = useState("");
  const [error, setError] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSelectOpen, setIsSelectOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleSelectVault = async (vaultId: string) => {
    if (vaultId !== activeVault?.id) {
      await setActiveVault(vaultId);
      goHome();
    }
  };

  const handleCreateVault = async () => {
    if (!newVaultName.trim()) return;
    
    const slug = newVaultName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    
    if (vaults.some((v: Vault) => v.slug === slug)) {
      setError("A vault with this name already exists");
      return;
    }
    
    setIsCreating(true);
    try {
      const createdVault = await createVault(newVaultName.trim(), slug);
      await setActiveVault(createdVault.id);
      goHome();
      setNewVaultName("");
      setError("");
      setIsCreateDialogOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 px-2 py-2 shrink-0">
      <Select value={activeVault?.id} onValueChange={handleSelectVault} open={isSelectOpen} onOpenChange={setIsSelectOpen}>
        <SelectTrigger size="sm" className="flex-1 font-medium">
          <SelectValue placeholder="Select Vault" />
        </SelectTrigger>
        <SelectContent>
          {vaults.map((vault: Vault) => (
            <SelectItem key={vault.id} value={vault.id}>
              <span>{vault.name}</span>
            </SelectItem>
          ))}
          <div className="h-px my-1 bg-border" />
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <div 
                className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                onClick={() => setIsSelectOpen(false)}
              >
                <Plus className="h-4 w-4" />
                Create New Vault
              </div>
            </DialogTrigger>
            <DialogContent>
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold">Create New Vault</h2>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="vault-name">Vault Name</Label>
                  <Input
                    id="vault-name"
                    value={newVaultName}
                    onChange={(e) => {
                      setNewVaultName(e.target.value);
                      setError("");
                    }}
                    placeholder="My Notes"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateVault();
                      }
                    }}
                  />
                  {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} disabled={isCreating}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateVault} disabled={!newVaultName.trim() || isCreating}>
                    {isCreating ? "Creating..." : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </SelectContent>
      </Select>
      
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground"
        onClick={toggleSidebarCollapsed}
        title="Collapse sidebar (Ctrl+B)"
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}
