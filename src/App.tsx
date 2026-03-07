import { Sidebar, SidebarCollapseToggle } from "@/components/Sidebar";
import { Editor } from "@/components/Editor";
import { HomeView } from "@/components/HomeView";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useStore } from "@/store";
import { useEffect, useState } from "react";

function SharedDialogs() {
  const renameOpen = useStore((state) => state.renameOpen);
  const renamePath = useStore((state) => state.renamePath);
  const renameInitialTitle = useStore((state) => state.renameInitialTitle);
  const closeRename = useStore((state) => state.closeRename);

  const deleteOpen = useStore((state) => state.deleteOpen);
  const deletePath = useStore((state) => state.deletePath);
  const deleteName = useStore((state) => state.deleteName);
  const deleteIsFolder = useStore((state) => state.deleteIsFolder);
  const closeDelete = useStore((state) => state.closeDelete);

  const settingsOpen = useStore((state) => state.settingsOpen);
  const closeSettings = useStore((state) => state.closeSettings);

  const renameNote = useStore((state) => state.renameNote);
  const deleteEntry = useStore((state) => state.deleteEntry);

  return (
    <>
      <RenameDialog
        isOpen={renameOpen}
        onOpenChange={(open) => { if (!open) closeRename(); }}
        initialTitle={renameInitialTitle}
        onRename={(newTitle) => {
          if (renamePath) renameNote(renamePath, newTitle);
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
        <Sidebar />
        {sidebarCollapsed && <SidebarCollapseToggle />}
        <div className="flex-1 overflow-hidden flex flex-col relative">
            {activeNote ? (
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
      <CommandPalette />
      <SharedDialogs />
    </main>
  );
}

export default App;
