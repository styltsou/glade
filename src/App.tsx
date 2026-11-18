import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { WindowResizeHandles } from "@/components/WindowResizeHandles";
import { focusedGroup, activeTab } from "@/lib/tabs";
import { CommandPalette } from "@/components/CommandPalette";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeHome } from "@/components/WelcomeHome";
import { PaneArea } from "@/components/PaneArea";
import { FolderSwitcher } from "@/components/FolderSwitcher";
import { MissingLinkDialog } from "@/components/MissingLinkDialog";
import { RootMissing } from "@/components/RootMissing";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { AddPropertyDialog, EditFrontmatterDialog } from "@/components/editor/PropertyDialogs";
import { relativeTo } from "@/lib/paths";
import { SettingsPage } from "@/components/SettingsPage";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { useStore } from "@/store";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { showWindowOnce } from "@/lib/showWindow";
import type { Target } from "@/types";

function SharedDialogs() {
  const renameOpen = useStore((state) => state.renameOpen);
  const renamePath = useStore((state) => state.renamePath);
  const renameInitialTitle = useStore((state) => state.renameInitialTitle);
  const renameIsFolder = useStore((state) => state.renameIsFolder);
  const closeRename = useStore((state) => state.closeRename);

  const deleteOpen = useStore((state) => state.deleteOpen);
  const deletePath = useStore((state) => state.deletePath);
  const deleteName = useStore((state) => state.deleteName);
  const deleteIsFolder = useStore((state) => state.deleteIsFolder);
  const closeDelete = useStore((state) => state.closeDelete);

  const createFolderOpen = useStore((state) => state.createFolderOpen);
  const createFolderParentPath = useStore((state) => state.createFolderParentPath);
  const closeCreateFolder = useStore((state) => state.closeCreateFolder);

  const settingsOpen = useStore((state) => state.settingsOpen);
  const closeSettings = useStore((state) => state.closeSettings);

  const createFolder = useStore((state) => state.createFolder);
  const renameNote = useStore((state) => state.renameNote);
  const renameFolder = useStore((state) => state.renameFolder);
  const deleteEntry = useStore((state) => state.deleteEntry);

  return (
    <>
      <RenameDialog
        isOpen={renameOpen}
        onOpenChange={(open) => { if (!open) closeRename(); }}
        initialTitle={renameInitialTitle}
        isFolder={renameIsFolder}
        onRename={(newTitle) => {
          if (renamePath) {
            if (renameIsFolder) {
              renameFolder(renamePath, newTitle);
            } else {
              renameNote(renamePath, newTitle);
            }
          }
          closeRename();
        }}
      />
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => { if (!open) closeDelete(); }}
        name={deleteName}
        type={deleteIsFolder ? "folder" : "note"}
        onConfirm={() => {
          if (deletePath) deleteEntry(deletePath);
          closeDelete();
        }}
      />
      <CreateFolderDialog
        isOpen={createFolderOpen}
        onOpenChange={(open) => { if (!open) closeCreateFolder(); }}
        onCreate={(folderName) => {
          const newPath = createFolderParentPath 
            ? `${createFolderParentPath}/${folderName}`
            : folderName;
          createFolder(newPath);
        }}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={(open) => { if (!open) closeSettings(); }} />
      <ErrorBoundary>
        <FolderSwitcher />
      </ErrorBoundary>
      <MissingLinkDialog />
      <AddPropertyDialog />
      <EditFrontmatterDialog />
    </>
  );
}

function App() {
  const initWorkspace = useStore((state) => state.initWorkspace);
  const applyTarget = useStore((state) => state.applyTarget);
  const workspaceReady = useStore((state) => state.workspaceReady);
  const target = useStore((state) => state.target);
  const homeOpen = useStore((state) => state.homeOpen);
  const rootMissing = useStore((state) => state.rootMissing);
  const restoring = useStore((state) => state.target?.kind === "folder" && state.uiLoadedFor !== state.target.path);
  const currentView = useStore((state) => state.currentView);
  const openSettingsPage = useStore((state) => state.openSettingsPage);
  const selectNote = useStore((state) => state.selectNote);
  const openPath = useStore((state) => state.openPath);
  const showHome = useStore((state) => state.showHome);
  const hideHome = useStore((state) => state.hideHome);
  const openSwitcher = useStore((state) => state.openSwitcher);
  const pickFolder = useStore((state) => state.pickFolder);
  const pickFile = useStore((state) => state.pickFile);
  const isReady = workspaceReady;
  const showWelcome = !target || homeOpen;

  useEffect(() => {
    initWorkspace();
    // Warm the editor chunk so the first note doesn't flash a skeleton.
    void import("@/components/Editor");
  }, [initWorkspace]);

  // Windows start hidden (no white flash); show once the first screen is ready.
  useEffect(() => {
    if (!isReady) return;
    const frame = requestAnimationFrame(() => void showWindowOnce());
    return () => cancelAnimationFrame(frame);
  }, [isReady]);

  // The backend routes opens (CLI, file manager, Home) to this window.
  useEffect(() => {
    let treeTimer: ReturnType<typeof setTimeout> | null = null;
    const unlisten = [
      listen<Target>("workspace-changed", (e) => applyTarget(e.payload)),
      listen<{ path: string; kind: "modified" | "removed" }>("external-change", (e) => {
        useStore.getState().handleExternalChange(e.payload);
      }),
      listen("tree-changed", () => {
        if (treeTimer) clearTimeout(treeTimer);
        treeTimer = setTimeout(() => useStore.getState().refreshTree(), 200);
      }),
      listen("root-removed", () => useStore.getState().setRootMissing(true)),
      listen("watch-unavailable", () => {
        useStore.getState().setPollExternal(true);
        toast("Can't watch this folder for changes; checking the open note instead.");
      }),
      listen<string>("show-file", (e) => {
        const root = useStore.getState().target;
        const rel = root?.kind === "folder" ? relativeTo(root.path, e.payload) : null;
        useStore.getState().hideHome();
        selectNote(rel ?? e.payload);
      }),
    ];
    return () => {
      if (treeTimer) clearTimeout(treeTimer);
      unlisten.forEach((p) => p.then((fn) => fn()));
    };
  }, [applyTarget, selectNote]);

  // Remember this folder's tree, last note and per-note modes (outside its files).
  const rootKind = useStore((state) => state.target?.kind);
  const rootPathForUi = useStore((state) => state.target?.path);
  useEffect(() => {
    if (rootKind !== "folder") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = useStore.subscribe((s, prev) => {
      if (
        s.expandedFolders === prev.expandedFolders &&
        s.noteEditMode === prev.noteEditMode &&
        s.noteScrollPositions === prev.noteScrollPositions &&
        s.tabsState === prev.tabsState &&
        s.activeNote?.path === prev.activeNote?.path
      ) {
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => useStore.getState().saveWorkspaceUi(), 600);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [rootKind, rootPathForUi]);

  // Fallback when the OS watcher can't be used: poll the open note.
  const pollExternal = useStore((state) => state.pollExternal);
  useEffect(() => {
    if (!pollExternal) return;
    const timer = setInterval(async () => {
      const { activeNote: note, target: t } = useStore.getState();
      if (!note) return;
      try {
        const state = await invoke<string>("check_external", { path: note.path });
        if (state === "unchanged") return;
        const abs = note.path.startsWith("/") ? note.path : `${t?.path ?? ""}/${note.path}`;
        useStore.getState().handleExternalChange({ path: abs, kind: state === "removed" ? "removed" : "modified" });
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [pollExternal]);

  // Dropping a folder or markdown file opens it.
  useEffect(() => {
    if (!showWelcome) return;
    const unlisten = getCurrentWebview().onDragDropEvent((event) => {
      if (event.payload.type === "drop" && event.payload.paths.length > 0) {
        openPath(event.payload.paths[0]);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [showWelcome, openPath]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (e.altKey && e.key === "ArrowLeft" && useStore.getState().backStack.length > 0) {
        e.preventDefault();
        useStore.getState().goBack();
        return;
      }
      if (!mod) return;
      const key = e.key.toLowerCase();

      // Tabs and splits (only when a folder or file is open).
      const st = useStore.getState();
      if (st.target && !st.homeOpen && st.currentView !== "settings" && !e.altKey) {
        if (key === "t" && !e.shiftKey) {
          e.preventDefault();
          st.newTab();
          return;
        }
        if (key === "w" && !e.shiftKey) {
          e.preventDefault();
          st.closeTab(st.tabsState.focused, activeTab(st.tabsState).id);
          return;
        }
        if (e.key === "\\") {
          e.preventDefault();
          if (st.tabsState.groups.length > 1) st.closeTab(st.tabsState.focused, focusedGroup(st.tabsState).activeId);
          else st.splitActive();
          return;
        }
        if (e.key === "Tab") {
          e.preventDefault();
          const { tabs, activeId } = focusedGroup(st.tabsState);
          const i = tabs.findIndex((t) => t.id === activeId);
          const next = tabs[(i + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length];
          st.activateTab(st.tabsState.focused, next.id);
          return;
        }
        if (/^[1-9]$/.test(e.key) && !e.shiftKey) {
          const tab = focusedGroup(st.tabsState).tabs[Number(e.key) - 1];
          if (tab) {
            e.preventDefault();
            st.activateTab(st.tabsState.focused, tab.id);
            return;
          }
        }
      }
      if (key === ",") {
        e.preventDefault();
        openSettingsPage("appearance");
      } else if (key === "h" && e.shiftKey) {
        e.preventDefault();
        if (useStore.getState().homeOpen) hideHome();
        else showHome();
      } else if (key === "o" && e.shiftKey) {
        e.preventDefault();
        pickFolder();
      } else if (key === "o" && e.altKey) {
        e.preventDefault();
        pickFile();
      } else if (key === "o") {
        e.preventDefault();
        openSwitcher();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSettingsPage, showHome, hideHome, openSwitcher, pickFolder, pickFile]);

  if (!isReady) {
    return (
      <main className="app-frame flex flex-col h-screen w-full bg-background text-foreground items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
        <WindowResizeHandles />
      </main>
    );
  }

  return (
    <TooltipProvider delayDuration={0} disableHoverableContent>
      <main className="app-frame flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden w-full">
          {currentView !== "settings" && !showWelcome && target?.kind === "folder" && <Sidebar />}
          <div key={showWelcome ? "home" : currentView === "settings" ? "settings" : "doc"} className="flex-1 overflow-hidden flex flex-col">
              {currentView === "settings" ? (
                <SettingsPage />
              ) : showWelcome ? (
                <WelcomeHome />
              ) : rootMissing ? (
                <RootMissing />
              ) : restoring ? (
                // Saved tabs are still loading: show nothing rather than a flash of the overview.
                <div className="flex-1" />
              ) : (
                <PaneArea />
              )}
          </div>
        </div>
        {currentView !== "settings" && target && <CommandPalette />}
        <SharedDialogs />
        <Toaster />
        <WindowResizeHandles />
      </main>
    </TooltipProvider>
  );
}

export default App;
