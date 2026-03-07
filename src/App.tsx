import { Sidebar, SidebarCollapseToggle } from "@/components/Sidebar";
import { Editor } from "@/components/Editor";
import { HomeView } from "@/components/HomeView";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { RenameDialog } from "@/components/RenameDialog";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { SettingsDialog } from "@/components/SettingsDialog";
import { useVaultStore } from "@/stores/useVaultStore";
import { useVaultsStore } from "@/stores/useVaultsStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { useDialogStore } from "@/stores/useDialogStore";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useHomeStore } from "@/stores/useHomeStore";

function SharedDialogs() {
  const {
    renameOpen, renamePath, renameInitialTitle, closeRename,
    deleteOpen, deletePath, deleteName, deleteIsFolder, closeDelete,
    settingsOpen, closeSettings,
  } = useDialogStore();
  const { renameNote, deleteEntry } = useVaultStore();

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
  const { activeNote } = useVaultStore();
  const { collapsed } = useSidebarStore();
  const { loadAll } = useHomeStore();
  const { initializeApp, activeVault } = useVaultsStore();
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
        {collapsed && <SidebarCollapseToggle />}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="popLayout">
            {activeNote ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <Editor />
              </motion.div>
            ) : (
              <motion.div
                key="home"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <HomeView />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <StatusBar />
      <CommandPalette />
      <SharedDialogs />
    </main>
  );
}

export default App;
