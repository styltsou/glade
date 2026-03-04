import { Sidebar, SidebarCollapseToggle } from "@/components/Sidebar";
import { Editor } from "@/components/Editor";
import { HomeView } from "@/components/HomeView";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";
import { useVaultStore } from "@/stores/useVaultStore";
import { useSidebarStore } from "@/stores/useSidebarStore";
import { motion, AnimatePresence } from "framer-motion";

function App() {
  const { activeNote } = useVaultStore();
  const { collapsed } = useSidebarStore();

  return (
    <main className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      <div className="flex flex-1 overflow-hidden w-full relative">
        <Sidebar />
        {/* Expand button shown when sidebar is fully collapsed */}
        {collapsed && <SidebarCollapseToggle />}
        <div className="flex-1 overflow-hidden flex flex-col relative">
          <AnimatePresence mode="wait">
            {activeNote ? (
              <motion.div
                key="editor"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <Editor />
              </motion.div>
            ) : (
              <motion.div
                key="home"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
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
    </main>
  );
}

export default App;
