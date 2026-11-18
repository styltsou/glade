import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X, Maximize2, PanelLeft, PanelLeftClose } from "lucide-react";
import { useStore } from "@/store";
import { WorkspaceMenu } from "@/components/WorkspaceMenu";
import { TabStrip } from "@/components/TabStrip";
import { AmbientSounds } from "@/components/AmbientSounds";

const appWindow = getCurrentWindow();

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const target = useStore((state) => state.target);
  const homeOpen = useStore((state) => state.homeOpen);
  const currentView = useStore((state) => state.currentView);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
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

  const folderOpen = target?.kind === "folder" && !homeOpen && currentView !== "settings";
  const sidebarVisible = folderOpen && !sidebarCollapsed;

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();
  const handleDragStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || target.closest("button, [data-no-drag]")) return;
    e.preventDefault();
    if (e.detail === 2) appWindow.toggleMaximize();
    else appWindow.startDragging();
  };

  useEffect(() => {
    document.documentElement.dataset.maximized = String(isMaximized);
  }, [isMaximized]);

  const iconButton =
    "press flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground active:bg-foreground/[0.12]";

  return (
    <div
      className="relative flex h-9 shrink-0 items-center border-b border-border/70 bg-background pl-1.5 select-none"
      onMouseDown={handleDragStart}
    >
      <div className={sidebarVisible ? "flex h-full shrink-0 items-center" : "absolute left-1.5 top-0 z-10 flex h-full items-center bg-background"} style={sidebarVisible ? { width: sidebarWidth - 6 } : undefined}>
      {/* Sidebar toggle */}
      {folderOpen && <button
        onClick={toggleSidebarCollapsed}
        title="Toggle sidebar (Ctrl+B)"
        className={iconButton}
      >
        {sidebarCollapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>}
      {!sidebarVisible && <WorkspaceMenu folder={folderOpen} className="h-7 max-w-32 flex-none px-2 text-xs" />}

      </div>
      {target && !homeOpen && currentView !== "settings" ? <TabStrip leadingInset={sidebarVisible ? 0 : folderOpen ? 176 : 112} trailingInset={128} /> : <div className="h-full flex-1" />}
      <div className="absolute right-1.5 top-0 flex h-full items-center bg-background">

      <AmbientSounds />

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
    </div>
  );
}
