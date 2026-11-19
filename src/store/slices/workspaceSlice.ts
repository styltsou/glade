import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { toast } from "sonner";
import type { HomeData, Target } from "@/types";
import * as T from "@/lib/tabs";
import { relativeTo } from "@/lib/paths";
import { findEntryByPath } from "@/components/sidebar/file-tree-helpers";
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
  /** A loose file to open as a tab once its containing folder has loaded. */
  pendingFile: string | null;
  /** Folder whose saved UI state (tree, last note...) has been restored. */
  uiLoadedFor: string | null;
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
  /** Restore tree expansion, per-note modes/scroll and the last open note. */
  restoreWorkspaceUi: (root: string) => Promise<void>;
  /** Save them (debounced by the caller). */
  saveWorkspaceUi: () => Promise<void>;

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
  pendingFile: null,
  uiLoadedFor: null,
  externalEvent: null,
  handleExternalChange: (e) => set({ externalEvent: { ...e, seq: Date.now() } }),
  rootMissing: false,
  setRootMissing: (missing) => set({ rootMissing: missing }),
  pollExternal: false,
  setPollExternal: (poll) => set({ pollExternal: poll }),
  restoreWorkspaceUi: async (root) => {
    try {
      const ui = await invoke<{
        expanded_folders: string[];
        last_file: string | null;
        edit_mode: Record<string, boolean>;
        scroll: Record<string, number>;
        tabs: (string | null)[][];
        active_tab: number;
        focused_pane: number;
        tab_layout_version?: number;
        active_tabs?: number[];
        split_ratio?: number;
      }>("get_workspace_ui");
      // The window may have moved on to another folder while this loaded.
      if (get().target?.path !== root) return;
      set({
        expandedFolders: ui.expanded_folders,
        noteEditMode: ui.edit_mode,
        noteScrollPositions: ui.scroll,
        uiLoadedFor: root,
      });
      const idToPath = get().idToPath;
      const restored = T.fromSaved(
        { groups: ui.tabs ?? [], activeIndex: ui.active_tabs ?? [], focused: ui.focused_pane ?? 0, ratio: ui.split_ratio || 0.5 },
        (p) => !!idToPath[p],
        (folder) => !!findEntryByPath(get().entries, folder)?.is_dir,
      );
      if (restored && T.isPristine(get().tabsState)) {
        set({ tabsState: restored });
        await get().syncFocusedNote();
      } else if (ui.last_file && idToPath[ui.last_file] && !get().activeNote) {
        await get().openNote(ui.last_file);
      }
    } catch {
      set({ uiLoadedFor: root });
    }
  },

  saveWorkspaceUi: async () => {
    const { target, uiLoadedFor, expandedFolders, noteEditMode, noteScrollPositions, activeNote } = get();
    if (target?.kind !== "folder" || uiLoadedFor !== target.path) return;
    const relative = <T,>(m: Record<string, T>) =>
      Object.fromEntries(Object.entries(m).filter(([k]) => !k.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(k)));
    const last = activeNote && !activeNote.path.startsWith("/") ? activeNote.path : null;
    const saved = T.toSaved(get().tabsState);
    const relativeTabs = saved.groups.map((tabs) => tabs.map((p) => (p && !p.startsWith("/") ? p : null)));
    await invoke("save_workspace_ui", {
      ui: {
        tabs: relativeTabs,
        tab_layout_version: 3,
        active_tabs: saved.activeIndex,
        split_ratio: saved.ratio,
        active_tab: saved.activeIndex[saved.focused] ?? 0,
        focused_pane: saved.focused,
        expanded_folders: expandedFolders,
        last_file: last,
        edit_mode: relative(noteEditMode),
        scroll: relative(noteScrollPositions),
      },
    }).catch(() => {});
  },

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
      uiLoadedFor: null,
      expandedFolders: [],
      noteEditMode: {},
      noteScrollPositions: {},
      entries: [],
      idToPath: {},
      noteCache: {},
      tags: [],
      activeNote: null,
      tabsState: target?.kind === "folder" ? T.rootTabs() : T.initialTabs(),
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
      await get().restoreWorkspaceUi(target.path);
      const pending = get().pendingFile;
      if (pending) {
        set({ pendingFile: null });
        const rel = relativeTo(target.path, pending);
        if (rel) await get().openNote(rel, T.focusedPath(get().tabsState) ? "tab" : "active");
      }
    } else {
      await get().openNote(target.path);
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
      // Opening the folder around a loose file: keep that file open afterwards.
      if (target?.kind === "file" && target.path.startsWith(path.endsWith("/") ? path : `${path}/`)) {
        set({ pendingFile: target.path });
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
