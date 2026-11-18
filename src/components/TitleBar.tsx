import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Maximize2, PanelLeft, PanelLeftClose } from "lucide-react";
import { useStore } from "@/store";
import { TabStrip } from "@/components/TabStrip";

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
    const target = e.target as HTMLElement;
    if (target.closest("button")) return;
    // Tabs are interactive; the empty space after them drags the window.
    if (target.closest("[data-no-drag]") && !target.closest("[data-drag-spacer]")) return;
    appWindow.startDragging();
  };

  useEffect(() => {
    document.documentElement.dataset.maximized = String(isMaximized);
  }, [isMaximized]);

  const iconButton =
    "press flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground active:bg-foreground/[0.12]";

  return (
    <div
      className="relative flex h-9 shrink-0 items-center bg-background px-1.5 select-none"
      onMouseDown={handleDragStart}
    >
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebarCollapsed}
        title="Toggle sidebar (Ctrl+B)"
        className={iconButton}
      >
        {sidebarCollapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>

      <TabStrip />

      {/* Window controls */}
      <div className="flex shrink-0 items-center gap-0.5">
        <button onClick={handleMinimize} title="Minimize" className={iconButton}>
          <Minus className="h-4 w-4" />
        </button>
        <button
          onClick={handleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
          className={iconButton}
        >
          {isMaximized ? <Square className="h-3 w-3" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
        <button
          onClick={handleClose}
          title="Close"
          className="press flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
