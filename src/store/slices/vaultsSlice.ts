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
}

export const createVaultsSlice: StateCreator<any, [], [], VaultsSlice> = (set, get) => ({
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
      
      // Clear caches for the new vault
      get().clearCache();
      
      set({ activeVault, isVaultsLoading: false });
    } catch (e) {
      set({ vaultsError: String(e), isVaultsLoading: false });
    }
  },

  createVault: async (name: string, slug: string) => {
    set({ isVaultsLoading: true, vaultsError: null });
    try {
      const vault = await invoke<Vault>("create_vault", { name, slug });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = await invoke<Vault | null>("get_active_vault");
      set({ vaults, activeVault, isVaultsLoading: false });
      return vault;
    } catch (e) {
      set({ vaultsError: String(e), isVaultsLoading: false });
      throw e;
    }
  },

  renameVault: async (vaultId: string, name: string, slug: string) => {
    set({ isVaultsLoading: true, vaultsError: null });
    try {
      const vault = await invoke<Vault>("rename_vault", { vaultId, name, slug });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = get().activeVault?.id === vaultId ? vault : get().activeVault;
      set({ vaults, activeVault, isVaultsLoading: false });
      return vault;
    } catch (e) {
      set({ vaultsError: String(e), isVaultsLoading: false });
      throw e;
    }
  },

  deleteVault: async (vaultId: string) => {
    set({ isVaultsLoading: true, vaultsError: null });
    try {
      await invoke("delete_vault", { vaultId });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = await invoke<Vault | null>("get_active_vault");
      set({ vaults, activeVault, isVaultsLoading: false });
    } catch (e) {
      set({ vaultsError: String(e), isVaultsLoading: false });
      throw e;
    }
  },
});
