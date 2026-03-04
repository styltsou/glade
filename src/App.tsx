import { Sidebar } from "@/components/Sidebar";
import { Editor } from "@/components/Editor";
import { StatusBar } from "@/components/StatusBar";
import { CommandPalette } from "@/components/CommandPalette";

function App() {
  return (
    <main className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      <div className="flex flex-1 overflow-hidden w-full">
        <Sidebar />
        <Editor />
      </div>
      <StatusBar />
      <CommandPalette />
    </main>
  );
}

export default App;
