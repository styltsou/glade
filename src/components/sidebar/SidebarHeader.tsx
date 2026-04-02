import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { PanelLeft, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
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

  useEffect(() => {
    if (isCreateDialogOpen) {
      const timer = setTimeout(() => {
        const input = document.getElementById("vault-name");
        if (input) {
          input.focus();
          if (input instanceof HTMLInputElement) {
            input.select();
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isCreateDialogOpen]);

  useEffect(() => {
    if (isCreateDialogOpen) {
      setIsCreating(false);
      setError("");
    }
  }, [isCreateDialogOpen]);

  const handleSelectVault = async (vaultId: string) => {
    if (vaultId !== activeVault?.id) {
      await setActiveVault(vaultId);
      goHome();
    }
  };

  const handleCreateVault = async () => {
    if (!newVaultName.trim()) return;
    
    setIsCreating(true);
    setError("");

    const slug = newVaultName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    
    if (vaults.some((v: Vault) => v.slug === slug)) {
      setError("A vault with this name already exists");
      setIsCreating(false);
      return;
    }
    
    try {
      await createVault(newVaultName.trim(), slug);
      goHome();
      setNewVaultName("");
      setError("");
      setIsCreateDialogOpen(false);
    } catch (e) {
      setError(String(e));
      setIsCreating(false);
    }
  };

  return (
    <div className="flex items-center h-10 shrink-0 border-b">
      <Select value={activeVault?.id} onValueChange={handleSelectVault} open={isSelectOpen} onOpenChange={setIsSelectOpen}>
        <SelectTrigger 
          style={{ background: isSelectOpen ? 'hsl(0 0% 91%)' : 'transparent', transition: 'background 150ms ease-out' }}
          className={cn(
            "flex-1 !h-10 !font-medium !border-0 !border-r !focus:ring-0 !focus:ring-offset-0 !rounded-none !text-foreground [&>svg]:!text-foreground [&>svg]:transition-transform [&>svg]:duration-150 [&>svg]:ease-out",
            isSelectOpen && "[&>svg]:rotate-180",
            "cursor-pointer"
          )}
        >
          <SelectValue placeholder="Select Vault" />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-[70vh]" onCloseAutoFocus={(e) => e.preventDefault()}>
          {vaults.map((vault: Vault) => (
            <SelectItem key={vault.id} value={vault.id}>
              <span>{vault.name}</span>
            </SelectItem>
          ))}
          <SelectSeparator />
          <div 
            className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent focus:bg-accent focus:text-accent-foreground cursor-pointer rounded-sm"
            onClick={() => {
              setIsSelectOpen(false);
              setIsCreateDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            <span>Create New Vault</span>
          </div>
        </SelectContent>
      </Select>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateVault} disabled={!newVaultName.trim() || isCreating}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Button
        variant="ghost"
        className="h-10 w-10 rounded-none border-l text-muted-foreground hover:text-foreground"
        onClick={toggleSidebarCollapsed}
        title="Collapse sidebar (Ctrl+B)"
      >
        <PanelLeft className="h-4 w-4" />
      </Button>
    </div>
  );
}