import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Vault } from "@/types";

export interface VaultsSlice {
  vaults: Vault[];
  activeVault: Vault | null;
  isVaultsLoading: boolean;
  vaultsError: string | null;

  initializeApp: () => Promise<void>;
  loadVaults: () => Promise<void>;
  setActiveVault: (vaultId: string) => Promise<void>;
  createVault: (name: string, slug: string) => Promise<Vault>;
  renameVault: (vaultId: string, name: string, slug: string) => Promise<Vault>;
  deleteVault: (vaultId: string) => Promise<void>;
  updateVaultGitRemote: (vaultId: string, gitRemote: string | null) => Promise<Vault>;
}

import type { StoreState } from "../index";

export const createVaultsSlice: StateCreator<StoreState, [], [], VaultsSlice> = (set, get) => ({
  vaults: [],
  activeVault: null,
  isVaultsLoading: false,
  vaultsError: null,

  initializeApp: async () => {
    set({ isVaultsLoading: true, vaultsError: null });
    try {
      await invoke("initialize_app");
      await get().loadVaults();
    } catch (e) {
      set({ vaultsError: String(e), isVaultsLoading: false });
    }
  },

  loadVaults: async () => {
    set({ isVaultsLoading: true, vaultsError: null });
    try {
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = await invoke<Vault | null>("get_active_vault");
      set({ vaults, activeVault, isVaultsLoading: false });
    } catch (e) {
      set({ vaultsError: String(e), isVaultsLoading: false });
    }
  },

  setActiveVault: async (vaultId: string) => {
    set({ isVaultsLoading: true, vaultsError: null });
    try {
      await invoke("set_active_vault", { vaultId });
      await invoke("update_vault_last_opened", { vaultId });
      const activeVault = get().vaults.find((v: Vault) => v.id === vaultId) || null;
      
      // Clear caches and reset state for the new vault
      get().clearCache();
      get().clearTags();
      get().goHome();
      
      // Reload tags for the new vault
      get().loadTags();
      
      set({ activeVault, isVaultsLoading: false });
    } catch (e) {
      set({ vaultsError: String(e), isVaultsLoading: false });
    }
  },

  createVault: async (name: string, slug: string) => {
    set({ vaultsError: null });
    
    const prevVaults = get().vaults;
    const prevActive = get().activeVault;
    
    const optimisticVault: Vault = {
      id: slug,
      name,
      slug,
      git_remote: null,
      created_at: new Date().toISOString(),
      last_opened: new Date().toISOString(),
    };
    
    set({ 
      vaults: [...prevVaults, optimisticVault], 
      activeVault: optimisticVault 
    });

    try {
      const vault = await invoke<Vault>("create_vault", { name, slug });
      const vaults = await invoke<Vault[]>("list_vaults");
      const newVault = vaults.find(v => v.slug === slug);
      set({ vaults, activeVault: newVault || vault });
      return newVault || vault;
    } catch (e) {
      set({ vaults: prevVaults, activeVault: prevActive, vaultsError: String(e) });
      throw e;
    }
  },

  renameVault: async (vaultId: string, name: string, slug: string) => {
    set({ vaultsError: null });
    
    // Optimistic update
    const prevVaults = get().vaults;
    const prevActive = get().activeVault;
    
    const optimisticVaults = prevVaults.map(v => v.id === vaultId ? { ...v, name, slug } : v);
    const optimisticActive = prevActive?.id === vaultId ? { ...prevActive, name, slug } : prevActive;
    set({ vaults: optimisticVaults, activeVault: optimisticActive });

    try {
      const vault = await invoke<Vault>("rename_vault", { vaultId, name, slug });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = get().activeVault?.id === vaultId ? vault : get().activeVault;
      set({ vaults, activeVault });
      return vault;
    } catch (e) {
      set({ vaults: prevVaults, activeVault: prevActive, vaultsError: String(e) });
      throw e;
    }
  },

  deleteVault: async (vaultId: string) => {
    set({ vaultsError: null });
    
    // Optimistic update
    const prevVaults = get().vaults;
    const prevActive = get().activeVault;
    
    const isActiveVaultDeleted = prevActive?.id === vaultId;
    const optimisticVaults = prevVaults.filter(v => v.id !== vaultId);
    let optimisticActive = prevActive;
    
    if (isActiveVaultDeleted) {
      if (optimisticVaults.length > 0) {
        const sorted = [...optimisticVaults].sort((a, b) => 
          new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime()
        );
        optimisticActive = sorted[0];
      } else {
        optimisticActive = null;
      }
    }
    
    set({ vaults: optimisticVaults, activeVault: optimisticActive });

    try {
      await invoke("delete_vault", { vaultId });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = await invoke<Vault | null>("get_active_vault");
      
      if (isActiveVaultDeleted) {
        get().clearCache();
        get().clearTags();
        get().goHome();
        if (activeVault) {
           get().loadTags();
        }
      }
      
      set({ vaults, activeVault });
    } catch (e) {
      set({ vaults: prevVaults, activeVault: prevActive, vaultsError: String(e) });
      throw e;
    }
  },

  updateVaultGitRemote: async (vaultId: string, gitRemote: string | null) => {
    set({ vaultsError: null });
    
    // Optimistic update
    const prevVaults = get().vaults;
    const prevActive = get().activeVault;
    
    const optimisticVaults = prevVaults.map(v => v.id === vaultId ? { ...v, git_remote: gitRemote } : v);
    const optimisticActive = prevActive?.id === vaultId ? { ...prevActive, git_remote: gitRemote } : prevActive;
    set({ vaults: optimisticVaults, activeVault: optimisticActive });

    try {
      await invoke("update_vault_git_remote", { vaultId, gitRemote });
      const vaults = await invoke<Vault[]>("list_vaults");
      const vault = vaults.find(v => v.id === vaultId);
      const activeVault = get().activeVault?.id === vaultId ? vault || get().activeVault : get().activeVault;
      set({ vaults, activeVault });
      return vault as Vault;
    } catch (e) {
      set({ vaults: prevVaults, activeVault: prevActive, vaultsError: String(e) });
      throw e;
    }
  },
});
