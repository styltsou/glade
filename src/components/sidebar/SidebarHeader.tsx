import { ChevronDown, Home, Pin, PinOff, FolderSearch, FolderOpen, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Top of the sidebar: app mark (back to Home) and the open folder's menu. */
export function SidebarHeader() {
  const target = useStore((s) => s.target);
  const home = useStore((s) => s.home);
  const showHome = useStore((s) => s.showHome);
  const openSwitcher = useStore((s) => s.openSwitcher);
  const pickFolder = useStore((s) => s.pickFolder);
  const pinFolder = useStore((s) => s.pinFolder);
  const unpinFolder = useStore((s) => s.unpinFolder);
  const closeTarget = useStore((s) => s.closeTarget);

  if (!target) return null;
  const pinned = !!home?.pinned_folders.some((f) => f.path === target.path);

  return (
    <div className="flex items-center gap-1 h-11 shrink-0 px-2">
      <button
        onClick={showHome}
        title="Home (Ctrl+Shift+H)"
        className="press flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <Home className="size-4" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-8 flex-1 items-center gap-2 rounded-lg px-2.5 text-[13px] font-semibold tracking-[-0.01em] outline-none hover:bg-foreground/[0.07] data-[state=open]:bg-foreground/[0.07]">
          <span className="truncate">{baseName(target.path)}</span>
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ease-[var(--ease-ui)] [[data-state=open]_&]:rotate-180" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-52">
          <DropdownMenuItem onSelect={openSwitcher}>
            <FolderOpen className="size-4" /> Open recent…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={pickFolder}>
            <FolderOpen className="size-4" /> Open folder…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {pinned ? (
            <DropdownMenuItem onSelect={() => unpinFolder(target.path)}>
              <PinOff className="size-4" /> Unpin folder
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => pinFolder(target.path)}>
              <Pin className="size-4" /> Pin folder
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() => {
              invoke("plugin:opener|reveal_item_in_dir", { paths: [target.path] }).catch(() => {});
            }}
          >
            <FolderSearch className="size-4" /> Reveal in file manager
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={closeTarget}>
            <X className="size-4" /> Close folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
