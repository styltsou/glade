import { useState } from "react";
import { ChevronDown, ChevronsUpDown, FileText, Folder, Home, Info, Palette, Pin, PinOff, FolderSearch, FolderOpen, Sun, X } from "lucide-react";
import { openModePicker, openThemePicker } from "@/components/CommandPalette";
import { AboutDialog } from "@/components/AboutDialog";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Workspace actions: at the foot of the sidebar, opening upward, and in the
 * window bar when there is no sidebar to show it (it is collapsed, or no folder
 * is open).
 */
export function WorkspaceMenu({
  folder = false,
  className,
  placement = "bar",
  onOpenChange,
}: {
  folder?: boolean;
  className?: string;
  placement?: "bar" | "sidebar";
  onOpenChange?: (open: boolean) => void;
}) {
  const inSidebar = placement === "sidebar";
  const target = useStore((s) => s.target);
  const home = useStore((s) => s.home);
  const showHome = useStore((s) => s.showHome);
  const openSwitcher = useStore((s) => s.openSwitcher);
  const pickFolder = useStore((s) => s.pickFolder);
  const pickFile = useStore((s) => s.pickFile);
  const pinFolder = useStore((s) => s.pinFolder);
  const unpinFolder = useStore((s) => s.unpinFolder);
  const closeTarget = useStore((s) => s.closeTarget);
  const [aboutOpen, setAboutOpen] = useState(false);
  const folderTarget = folder && target?.kind === "folder" ? target : null;
  const pinned = !!folderTarget && !!home?.pinned_folders.some((f) => f.path === folderTarget.path);
  const label = folderTarget ? baseName(folderTarget.path) : "Glade";

  return (
    <>
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        aria-label={`${label} menu`}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-[13px] font-semibold tracking-[-0.01em] outline-none hover:bg-foreground/[0.07] data-[state=open]:bg-foreground/[0.07]",
          className,
        )}
      >
        {inSidebar && <Folder className="size-4 shrink-0 text-muted-foreground" />}
        <span className="truncate">{label}</span>
        {inSidebar ? (
          <ChevronsUpDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ease-[var(--ease-ui)] [[data-state=open]_&]:rotate-180" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={inSidebar ? "top" : "bottom"}
        align="start"
        className="min-w-[max(14rem,var(--radix-dropdown-menu-trigger-width))]"
        data-no-drag
      >
        <DropdownMenuItem onSelect={showHome}>
          <Home className="size-4" /> Home
          <DropdownMenuShortcut>{formatShortcut(bindingFor("toggle-home")!)}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openSwitcher}>
          <FolderOpen className="size-4" /> Open recent…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={pickFolder}>
          <FolderOpen className="size-4" /> Open folder…
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={pickFile}>
          <FileText className="size-4" /> Open file…
        </DropdownMenuItem>
        {folderTarget && (
          <>
            <DropdownMenuSeparator />
            {pinned ? (
              <DropdownMenuItem onSelect={() => unpinFolder(folderTarget.path)}>
                <PinOff className="size-4" /> Unpin folder
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => pinFolder(folderTarget.path)}>
                <Pin className="size-4" /> Pin folder
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => {
              invoke("plugin:opener|reveal_item_in_dir", { paths: [folderTarget.path] }).catch(() => {});
            }}>
              <FolderSearch className="size-4" /> Reveal in file manager
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={closeTarget}>
              <X className="size-4" /> Close folder
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openThemePicker}>
          <Palette className="size-4" /> Theme…
          <DropdownMenuShortcut>{formatShortcut(bindingFor("open-settings")!)}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={openModePicker}>
          <Sun className="size-4" /> Mode…
          <DropdownMenuShortcut>{formatShortcut(bindingFor("open-mode-picker")!)}</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
          <Info className="size-4" /> About Glade
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
