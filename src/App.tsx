import { lazy, Suspense, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { EditorSkeleton } from "@/components/editor/EditorSkeleton";
import { HomeView } from "@/components/HomeView";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeHome } from "@/components/WelcomeHome";
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
import type { Target } from "@/types";

const Editor = lazy(() => import("@/components/Editor").then(m => ({ default: m.Editor })));

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
  const activeNote = useStore((state) => state.activeNote);
  const initWorkspace = useStore((state) => state.initWorkspace);
  const applyTarget = useStore((state) => state.applyTarget);
  const workspaceReady = useStore((state) => state.workspaceReady);
  const target = useStore((state) => state.target);
  const homeOpen = useStore((state) => state.homeOpen);
  const rootMissing = useStore((state) => state.rootMissing);
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
  }, [initWorkspace]);

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
      </main>
    );
  }

  return (
    <TooltipProvider delayDuration={0} disableHoverableContent>
      <main className="app-frame flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden w-full">
          {currentView !== "settings" && !showWelcome && target?.kind === "folder" && <Sidebar />}
          <div key={showWelcome ? "home" : currentView === "settings" ? "settings" : "doc"} className="view-in flex-1 overflow-hidden flex flex-col">
              {currentView === "settings" ? (
                <SettingsPage />
              ) : showWelcome ? (
                <WelcomeHome />
              ) : rootMissing ? (
                <RootMissing />
              ) : activeNote ? (
                <Suspense fallback={<EditorSkeleton />}>
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <Editor />
                  </div>
                </Suspense>
              ) : target?.kind === "file" ? (
                <EditorSkeleton />
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <HomeView />
                </div>
              )}
          </div>
        </div>
        <StatusBar />
        {currentView !== "settings" && target && <CommandPalette />}
        <SharedDialogs />
        <Toaster />
      </main>
    </TooltipProvider>
  );
}

export default App;
