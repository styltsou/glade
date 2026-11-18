import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { toast } from "sonner";
import type { HomeData, Target } from "@/types";
import type { StoreState } from "../index";

export interface WorkspaceSlice {
  /** What this window shows; null means Home. */
  target: Target | null;
  /** Home drawn over the open target (Cmd/Ctrl+Shift+H). */
  homeOpen: boolean;
  home: HomeData | null;
  homeDir: string;
  workspaceReady: boolean;
  workspaceError: string | null;
  switcherOpen: boolean;
  /** Last change made to a note by another program (consumed by the editor). */
  externalEvent: { path: string; kind: "modified" | "removed"; seq: number } | null;
  handleExternalChange: (e: { path: string; kind: "modified" | "removed" }) => void;
  /** The open folder was deleted or moved. */
  rootMissing: boolean;
  setRootMissing: (missing: boolean) => void;
  /** File watching is unavailable; poll the open note instead. */
  pollExternal: boolean;
  setPollExternal: (poll: boolean) => void;
  refreshTree: () => Promise<void>;

  initWorkspace: () => Promise<void>;
  applyTarget: (target: Target | null) => Promise<void>;
  loadHome: () => Promise<void>;
  /** One-time prompt to strip keys older Glade versions wrote into notes. */
  offerLegacyCleanup: () => Promise<void>;
  /** Open via the backend so the one-window-per-root rule applies. */
  openPath: (path: string) => Promise<void>;
  closeTarget: () => Promise<void>;
  showHome: () => void;
  hideHome: () => void;
  pickFolder: () => Promise<void>;
  pickFile: () => Promise<void>;
  openSwitcher: () => void;
  closeSwitcher: () => void;
  pinFolder: (path: string) => Promise<void>;
  unpinFolder: (path: string) => Promise<void>;
  removeFromGlade: (path: string) => Promise<void>;
  locateFolder: (oldPath: string) => Promise<void>;
}

export const createWorkspaceSlice: StateCreator<StoreState, [], [], WorkspaceSlice> = (set, get) => ({
  target: null,
  homeOpen: false,
  home: null,
  homeDir: "",
  workspaceReady: false,
  workspaceError: null,
  switcherOpen: false,
  externalEvent: null,
  handleExternalChange: (e) => set({ externalEvent: { ...e, seq: Date.now() } }),
  rootMissing: false,
  setRootMissing: (missing) => set({ rootMissing: missing }),
  pollExternal: false,
  setPollExternal: (poll) => set({ pollExternal: poll }),
  refreshTree: async () => {
    await get().loadVault();
    get().loadTags();
    get().loadFolderNotes();
    get().loadPinned();
  },

  initWorkspace: async () => {
    try {
      await invoke("initialize_app");
      const [target, home] = await Promise.all([
        invoke<Target | null>("get_window_target"),
        homeDir().catch(() => ""),
      ]);
      set({ homeDir: home });
      await get().applyTarget(target);
    } catch (e) {
      set({ workspaceError: String(e) });
    } finally {
      set({ workspaceReady: true });
    }
  },

  applyTarget: async (target) => {
    // Start from a clean slate so nothing from the previous root leaks in.
    set({
      target,
      homeOpen: false,
      rootMissing: false,
      externalEvent: null,
      entries: [],
      idToPath: {},
      noteCache: {},
      tags: [],
      activeNote: null,
      backStack: [],
      currentFolder: null,
      pinnedNotes: [],
      folderNotes: [],
      isVaultLoaded: false,
    });

    if (!target) {
      await get().loadHome();
    } else if (target.kind === "folder") {
      get().loadHome();
      await get().loadVault();
      get().loadTags();
      get().loadAll();
      get().offerLegacyCleanup();
    } else {
      await get().selectNote(target.path);
    }
  },

  loadHome: async () => {
    try {
      const home = await invoke<HomeData>("get_home_data");
      set({ home });
    } catch (e) {
      set({ workspaceError: String(e) });
    }
  },

  offerLegacyCleanup: async () => {
    try {
      if (!(await invoke<boolean>("legacy_cleanup_pending"))) return;
      toast("Older versions of Glade added `id` and `pinned` lines to your notes' frontmatter.", {
        duration: Infinity,
        action: {
          label: "Remove them",
          onClick: async () => {
            const changed = await invoke<number>("cleanup_legacy");
            toast.success(`Cleaned ${changed} ${changed === 1 ? "note" : "notes"}`);
            get().loadVault();
          },
        },
        cancel: { label: "Keep", onClick: () => invoke("dismiss_legacy_cleanup") },
      });
    } catch {
      // Not critical.
    }
  },

  openPath: async (path) => {
    const { target } = get();
    try {
      // Re-selecting the folder this window already shows just leaves Home.
      if (target?.kind === "folder" && target.path === path) {
        set({ homeOpen: false });
        return;
      }
      await invoke("open_path_cmd", { path });
      // The backend may have opened it in another window; leave the Home overlay.
      set({ homeOpen: false });
      await get().loadHome();
    } catch (e) {
      set({ workspaceError: String(e) });
    }
  },

  closeTarget: async () => {
    await invoke("close_target");
    await get().applyTarget(null);
  },

  showHome: () => {
    get().loadHome();
    set({ homeOpen: true });
  },
  hideHome: () => set({ homeOpen: false }),

  pickFolder: async () => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") await get().openPath(selected);
  },

  pickFile: async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown", "mdx"] }],
    });
    if (typeof selected === "string") await get().openPath(selected);
  },

  openSwitcher: () => {
    get().loadHome();
    set({ switcherOpen: true });
  },
  closeSwitcher: () => set({ switcherOpen: false }),

  pinFolder: async (path) => {
    await invoke("pin_folder", { path });
    await get().loadHome();
  },
  unpinFolder: async (path) => {
    await invoke("unpin_folder", { path });
    await get().loadHome();
  },
  removeFromGlade: async (path) => {
    await invoke("remove_from_glade", { path });
    await get().loadHome();
  },
  locateFolder: async (oldPath) => {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;
    await invoke("locate_folder", { oldPath, newPath: selected });
    await get().loadHome();
  },
});
