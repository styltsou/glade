import { useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TitleBar } from "@/components/TitleBar";
import { WindowResizeHandles } from "@/components/WindowResizeHandles";
import { focusedGroup } from "@/lib/tabs";
import { CommandPalette } from "@/components/CommandPalette";
import { useImageDrop } from "@/hooks/useImageDrop";
import { Lightbox } from "@/components/Lightbox";
import { DragGhost } from "@/components/dnd/DragGhost";
import { ExportDialog } from "@/components/editor/ExportDialog";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { WelcomeHome } from "@/components/WelcomeHome";
import { PaneArea } from "@/components/PaneArea";
import { FRAME_GAP, pageCorner, useSidebarVisible } from "@/lib/surfaces";
import { FolderSwitcher } from "@/components/FolderSwitcher";
import { MissingLinkDialog } from "@/components/MissingLinkDialog";
import { ShortcutsDialog } from "@/components/ShortcutsDialog";
import { RootMissing } from "@/components/RootMissing";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { relativeTo } from "@/lib/paths";
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


  const createFolder = useStore((state) => state.createFolder);
  const renameFile = useStore((state) => state.renameFile);
  const renameFolder = useStore((state) => state.renameFolder);
  const deleteEntry = useStore((state) => state.deleteEntry);
  const exportOpen = useStore((state) => state.exportOpen);
  const setExportOpen = useStore((state) => state.setExportOpen);
  const activeNote = useStore((state) => state.activeNote);

  return (
    <>
      {activeNote && (
        <ExportDialog open={exportOpen} onOpenChange={setExportOpen} notePath={activeNote.path} noteTitle={activeNote.title} />
      )}
      <RenameDialog
        isOpen={renameOpen}
        onOpenChange={(open) => { if (!open) closeRename(); }}
        path={renamePath}
        isFolder={renameIsFolder}
        onRename={async (name) => {
          if (!renamePath) return null;
          return renameIsFolder ? renameFolder(renamePath, name) : renameFile(renamePath, name);
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
      <ErrorBoundary>
        <FolderSwitcher />
      </ErrorBoundary>
      <MissingLinkDialog />
      <ShortcutsDialog />
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
  const selectNote = useStore((state) => state.selectNote);
  const openPath = useStore((state) => state.openPath);
  const isReady = workspaceReady;
  const showWelcome = !target || homeOpen;
  const sidebarVisible = useSidebarVisible();
  const firstGroup = useStore((state) => state.tabsState.groups[0]);

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
  // A large folder can take a while to scan: don't keep the window hidden for
  // it. The tree and tabs have their own loading states.
  useEffect(() => {
    const timer = setTimeout(() => void showWindowOnce(), 150);
    return () => clearTimeout(timer);
  }, []);

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
        s.closedTabs === prev.closedTabs &&
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

  useImageDrop(!showWelcome);

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

      // Tabs and splits (only when a folder or file is open).
      const st = useStore.getState();
      if (st.target && !st.homeOpen && !e.altKey) {
        if (e.key === "Tab") {
          e.preventDefault();
          const { tabs, activeId } = focusedGroup(st.tabsState);
          const i = tabs.findIndex((t) => t.id === activeId);
          const next = tabs[(i + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length];
          if (!next) return;
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
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!isReady) {
    return (
      // Plain background while the folder loads: no text to flash by.
      <main className="app-frame flex flex-col h-screen w-full bg-background text-foreground">
        <WindowResizeHandles />
      </main>
    );
  }

  return (
    <TooltipProvider disableHoverableContent>
      <main className="app-frame flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
        <TitleBar />
        {/* The frame. Pulled up 1px so the pages' top edge runs under the tabs. */}
        <div className="-mt-px flex min-h-0 w-full flex-1 overflow-hidden bg-sidebar">
          {!showWelcome && target?.kind === "folder" && <Sidebar />}
          <div
            key={showWelcome ? "home" : "doc"}
            style={{ marginLeft: sidebarVisible ? 0 : FRAME_GAP, marginRight: FRAME_GAP, marginBottom: FRAME_GAP }}
            className="sidebar-motion flex min-w-0 flex-1 flex-col overflow-hidden"
          >
              {showWelcome || rootMissing || restoring ? (
                <div
                  {...pageCorner(sidebarVisible, showWelcome ? undefined : firstGroup)}
                  className="surface-page flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  {/* While saved tabs load the page stays blank rather than flashing the overview. */}
                  {showWelcome ? <WelcomeHome /> : rootMissing ? <RootMissing /> : null}
                </div>
              ) : (
                <PaneArea />
              )}
          </div>
        </div>
        <CommandPalette />
        <DragGhost />
        <Lightbox />
        <SharedDialogs />
        <Toaster />
        <WindowResizeHandles />
      </main>
    </TooltipProvider>
  );
}

export default App;
