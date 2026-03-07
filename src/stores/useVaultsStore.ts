import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { Vault } from "@/types";

interface VaultsState {
  vaults: Vault[];
  activeVault: Vault | null;
  isLoading: boolean;
  error: string | null;

  initializeApp: () => Promise<void>;
  loadVaults: () => Promise<void>;
  setActiveVault: (vaultId: string) => Promise<void>;
  createVault: (name: string, slug: string) => Promise<Vault>;
  renameVault: (vaultId: string, name: string, slug: string) => Promise<Vault>;
  deleteVault: (vaultId: string) => Promise<void>;
}

export const useVaultsStore = create<VaultsState>((set, get) => ({
  vaults: [],
  activeVault: null,
  isLoading: false,
  error: null,

  initializeApp: async () => {
    set({ isLoading: true, error: null });
    try {
      await invoke("initialize_app");
      await get().loadVaults();
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  loadVaults: async () => {
    set({ isLoading: true, error: null });
    try {
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = await invoke<Vault | null>("get_active_vault");
      set({ vaults, activeVault, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  setActiveVault: async (vaultId: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("set_active_vault", { vaultId });
      await invoke("update_vault_last_opened", { vaultId });
      const activeVault = get().vaults.find((v) => v.id === vaultId) || null;
      set({ activeVault, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  createVault: async (name: string, slug: string) => {
    set({ isLoading: true, error: null });
    try {
      const vault = await invoke<Vault>("create_vault", { name, slug });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = await invoke<Vault | null>("get_active_vault");
      set({ vaults, activeVault, isLoading: false });
      return vault;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  renameVault: async (vaultId: string, name: string, slug: string) => {
    set({ isLoading: true, error: null });
    try {
      const vault = await invoke<Vault>("rename_vault", { vaultId, name, slug });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = get().activeVault?.id === vaultId
        ? vault
        : get().activeVault;
      set({ vaults, activeVault, isLoading: false });
      return vault;
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },

  deleteVault: async (vaultId: string) => {
    set({ isLoading: true, error: null });
    try {
      await invoke("delete_vault", { vaultId });
      const vaults = await invoke<Vault[]>("list_vaults");
      const activeVault = await invoke<Vault | null>("get_active_vault");
      set({ vaults, activeVault, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
      throw e;
    }
  },
}));
