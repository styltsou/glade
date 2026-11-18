import { ChevronDown, FileText, Home, Pin, PinOff, FolderSearch, FolderOpen, Settings2, X } from "lucide-react";
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

const MOD = /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl+";

/** Workspace actions, shared by the sidebar and its window-bar fallback. */
export function WorkspaceMenu({ folder = false, className }: { folder?: boolean; className?: string }) {
  const target = useStore((s) => s.target);
  const home = useStore((s) => s.home);
  const showHome = useStore((s) => s.showHome);
  const closeSettingsPage = useStore((s) => s.closeSettingsPage);
  const openSwitcher = useStore((s) => s.openSwitcher);
  const pickFolder = useStore((s) => s.pickFolder);
  const pickFile = useStore((s) => s.pickFile);
  const pinFolder = useStore((s) => s.pinFolder);
  const unpinFolder = useStore((s) => s.unpinFolder);
  const closeTarget = useStore((s) => s.closeTarget);
  const openSettingsPage = useStore((s) => s.openSettingsPage);
  const folderTarget = folder && target?.kind === "folder" ? target : null;
  const pinned = !!folderTarget && !!home?.pinned_folders.some((f) => f.path === folderTarget.path);
  const label = folderTarget ? baseName(folderTarget.path) : "Glade";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${label} menu`}
        className={cn(
          "flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2.5 text-[13px] font-semibold tracking-[-0.01em] outline-none hover:bg-foreground/[0.07] data-[state=open]:bg-foreground/[0.07]",
          className,
        )}
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-100 ease-[var(--ease-ui)] [[data-state=open]_&]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56" data-no-drag>
        <DropdownMenuItem onSelect={() => { closeSettingsPage(); showHome(); }}>
          <Home className="size-4" /> Home
          <DropdownMenuShortcut>{MOD}⇧H</DropdownMenuShortcut>
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
        <DropdownMenuItem onSelect={() => openSettingsPage("appearance")}>
          <Settings2 className="size-4" /> Settings…
          <DropdownMenuShortcut>{MOD},</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
