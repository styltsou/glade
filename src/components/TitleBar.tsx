import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ArrowLeft, ArrowRight, Minus, Square, X, Maximize2, PanelLeft, PanelLeftClose } from "lucide-react";
import { useStore } from "@/store";
import { WorkspaceMenu } from "@/components/WorkspaceMenu";
import { TabStrip } from "@/components/TabStrip";
import { baseName, splitExtension } from "@/lib/paths";
import { historyTarget, type View } from "@/lib/tabs";
import { FRAME_GAP, useSidebarVisible } from "@/lib/surfaces";
import { Tip } from "@/components/ui/tooltip";
import type { SidebarPreview } from "@/hooks/useSidebarPreview";

const appWindow = getCurrentWindow();

export function TitleBar({ sidebarPreview }: { sidebarPreview: SidebarPreview }) {
  const [isMaximized, setIsMaximized] = useState(false);
  const target = useStore((state) => state.target);
  const homeOpen = useStore((state) => state.homeOpen);
  const sidebarWidth = useStore((s) => s.sidebarWidth);
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed);
  const toggleSidebarCollapsed = useStore((state) => state.toggleSidebarCollapsed);
  const back = useStore((s) => historyTarget(s.tabsState, "back")?.view ?? null);
  const forward = useStore((s) => historyTarget(s.tabsState, "forward")?.view ?? null);
  const goBack = useStore((s) => s.goBack);
  const goForward = useStore((s) => s.goForward);
  const noteCache = useStore((s) => s.noteCache);

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

  const folderOpen = target?.kind === "folder" && !homeOpen;
  // Back and Forward, for whatever is open (a folder, or a single file).
  const navOpen = !!target && !homeOpen;
  /** A place in history, as the tooltips name it. */
  const nameOf = (view: View) => {
    if (view.path !== null) return noteCache[view.path]?.title || splitExtension(view.path).stem;
    return baseName(view.folder ?? target?.path ?? "");
  };
  const sidebarVisible = useSidebarVisible();
  // The left section is as wide as the sidebar when it is open, and just fits
  // the toggle and the folder name when it is closed. Both widths are plain
  // pixels so CSS can transition between them in step with the sidebar itself.
  const label = folderOpen && target ? baseName(target.path) : "Glade";
  const measureRef = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState(80);
  useLayoutEffect(() => {
    if (measureRef.current) setLabelWidth(Math.ceil(measureRef.current.getBoundingClientRect().width));
  }, [label]);
  // The left section ends at its last control: the tab strip keeps the same gap
  // before its first tab as between its last tab and the + button. So: padding 6,
  // then the toggle (32) with a folder open, the arrows (2 × 32) with anything
  // open, and the menu (padding 20, gap 8, chevron 14, text ≤ 118) when no folder
  // is (with one, it is at the foot of the sidebar), 2 apart.
  const controls = [
    ...(folderOpen ? [32] : []),
    ...(navOpen ? [32, 32] : []),
    ...(folderOpen ? [] : [Math.min(42 + labelWidth, 160)]),
  ];
  const collapsedWidth = 6 + controls.reduce((sum, w) => sum + w, 0) + 2 * Math.max(controls.length - 1, 0);
  const leftWidth = sidebarVisible ? `var(--sidebar-live-width, ${sidebarWidth}px)` : collapsedWidth;
  const paneOffset = sidebarVisible ? 0 : FRAME_GAP - collapsedWidth;

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();
  const handleDragStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Menus and popups are portaled, but React still bubbles their events here.
    if (!e.currentTarget.contains(target)) return;
    if (e.button !== 0 || target.closest("button, [data-no-drag]")) return;
    e.preventDefault();
    if (e.detail === 2) appWindow.toggleMaximize();
    else appWindow.startDragging();
  };

  useEffect(() => {
    document.documentElement.dataset.maximized = String(isMaximized);
  }, [isMaximized]);

  const iconButton =
    "press flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground active:bg-foreground/[0.12]";
  const navButton = `${iconButton} shrink-0 disabled:pointer-events-none disabled:opacity-35`;

  return (
    <div
      className="relative z-[1] flex h-10 shrink-0 items-center select-none"
      onMouseDown={handleDragStart}
    >
      {/* Stops 1px short, so the pages' top edge shows in the last row. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 bottom-px -z-10 bg-sidebar" />
      <span ref={measureRef} aria-hidden className="pointer-events-none invisible absolute whitespace-nowrap text-[13px] font-semibold tracking-[-0.01em]">
        {label}
      </span>
      <div
        style={{ width: leftWidth }}
        // With the sidebar open, the arrows go to its right end, as far from the first
        // tab as the + button is from the last one (which starts at the sidebar's edge).
        className={`sidebar-motion flex h-full shrink-0 items-center gap-0.5 overflow-hidden pl-1.5 ${sidebarVisible ? "pr-1" : "pr-0"}`}
      >
      {/* Sidebar toggle */}
      {folderOpen && <Tip label={<span className="flex items-center gap-2">Toggle sidebar<span className="opacity-60">{formatShortcut(bindingFor("toggle-sidebar")!)}</span></span>}><button
        onClick={() => { sidebarPreview.dismiss(); toggleSidebarCollapsed(); }}
        data-sidebar-preview-zone
        onPointerEnter={sidebarPreview.enter}
        onPointerLeave={sidebarPreview.leave}
        aria-label="Toggle sidebar"
        aria-expanded={!sidebarCollapsed}
        className={iconButton}
      >
        {sidebarCollapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button></Tip>}
      {navOpen && (
        <div className={`flex shrink-0 items-center gap-0.5 ${sidebarVisible ? "ml-auto" : ""}`}>
          <Tip label={<ShortcutLabel text={back ? `Back to ${nameOf(back)}` : "Back"} command="go-back" />}>
            <button onClick={goBack} disabled={!back} aria-label="Back" className={navButton}>
              <ArrowLeft className="h-4 w-4" />
            </button>
          </Tip>
          <Tip label={<ShortcutLabel text={forward ? `Forward to ${nameOf(forward)}` : "Forward"} command="go-forward" />}>
            <button onClick={goForward} disabled={!forward} aria-label="Forward" className={navButton}>
              <ArrowRight className="h-4 w-4" />
            </button>
          </Tip>
        </div>
      )}
      {/* With a folder open, the menu is at the foot of the sidebar; this corner is for getting around. */}
      {!folderOpen && <WorkspaceMenu className="h-8 max-w-40 flex-none px-2.5 text-[13px]" />}

      </div>
      {target && !homeOpen ? <TabStrip trailingInset={114 - FRAME_GAP} paneOffset={paneOffset} /> : <div className="h-full flex-1" />}
      <div className="absolute right-1 top-0 flex h-full items-center">


      {/* Window controls */}
      <div className="flex shrink-0 items-center gap-1">
        <Tip label="Minimize"><button onClick={handleMinimize} aria-label="Minimize" className={iconButton}>
          <Minus className="h-4 w-4" />
        </button></Tip>
        <Tip label={isMaximized ? "Restore" : "Maximize"}><button
          onClick={handleMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          className={iconButton}
        >
          {isMaximized ? <Square className="h-3 w-3" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button></Tip>
        <Tip label="Close" align="end"><button
          onClick={handleClose}
          aria-label="Close"
          className="press flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
        >
          <X className="h-4 w-4" />
        </button></Tip>
      </div>
      </div>
    </div>
  );
}

/** A tooltip's text with its shortcut beside it, dimmed. */
function ShortcutLabel({ text, command }: { text: string; command: "go-back" | "go-forward" }) {
  const binding = bindingFor(command);
  return (
    <span className="flex items-center gap-2">
      {text}
      {binding && <span className="opacity-60">{formatShortcut(binding)}</span>}
    </span>
  );
}
