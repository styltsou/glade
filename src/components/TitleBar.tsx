import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Maximize2, PanelLeft, PanelLeftClose } from "lucide-react";
import { useStore } from "@/store";

const appWindow = getCurrentWindow();

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useStore((state) => state.toggleSidebarCollapsed);

  useEffect(() => {
    const checkMaximized = async () => {
      setIsMaximized(await appWindow.isMaximized());
    };
    checkMaximized();

    const unlisten = appWindow.onResized(async () => {
      setIsMaximized(await appWindow.isMaximized());
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();
  const handleDragStart = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    appWindow.startDragging();
  };

  return (
    <div
      className="flex items-center h-8 bg-background border-b border-border select-none"
      onMouseDown={handleDragStart}
    >
      {/* Sidebar toggle */}
      <div className="flex-shrink-0 w-8">
        <button
          onClick={toggleSidebarCollapsed}
          title="Toggle sidebar (Ctrl+B)"
          className="flex items-center justify-center h-8 w-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {sidebarCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* App title - centered in full window width */}
      <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <span className="text-sm text-muted-foreground font-medium">Glade</span>
      </div>

      {/* Window controls - positioned at right */}
      <div className="absolute right-0 flex items-center h-8">
        <button
          onClick={handleMinimize}
          title="Minimize"
          className="flex items-center justify-center h-8 w-8 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <Minus className="h-4 w-4" />
        </button>

        <button
          onClick={handleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
          className="flex items-center justify-center h-8 w-8 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          {isMaximized ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={handleClose}
          title="Close"
          className="flex items-center justify-center h-8 w-8 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}