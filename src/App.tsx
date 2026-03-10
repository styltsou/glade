import { Sidebar, SidebarCollapseToggle } from "@/components/Sidebar";
import { Editor } from "@/components/Editor";
import { HomeView } from "@/components/HomeView";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SettingsPage } from "@/components/SettingsPage";
import { useStore } from "@/store";
import { useEffect, useState } from "react";

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
        isFolder={deleteIsFolder}
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
    </>
  );
}

function App() {
  const activeNote = useStore((state) => state.activeNote);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const loadAll = useStore((state) => state.loadAll);
  const initializeApp = useStore((state) => state.initializeApp);
  const activeVault = useStore((state) => state.activeVault);
  const currentView = useStore((state) => state.currentView);
  const openSettingsPage = useStore((state) => state.openSettingsPage);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      await initializeApp();
      setIsReady(true);
    };
    init();
  }, [initializeApp]);

  useEffect(() => {
    if (isReady && activeVault) {
      loadAll();
    }
  }, [isReady, activeVault, loadAll]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        openSettingsPage("appearance");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openSettingsPage]);

  if (!isReady) {
    return (
      <main className="flex flex-col h-screen w-full bg-background text-foreground items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      <div className="flex flex-1 overflow-hidden w-full relative">
        {currentView !== "settings" && (
          <>
            <Sidebar />
            {sidebarCollapsed && <SidebarCollapseToggle />}
          </>
        )}
        <div className="flex-1 overflow-hidden flex flex-col relative">
            {currentView === "settings" ? (
              <SettingsPage />
            ) : activeNote ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <Editor />
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                <HomeView />
              </div>
            )}
        </div>
      </div>
      <StatusBar />
      {currentView !== "settings" && <CommandPalette />}
      <SharedDialogs />
    </main>
  );
}

export default App;
