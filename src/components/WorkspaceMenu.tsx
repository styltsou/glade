import { useState } from "react";
import { ChevronDown, FileText, Home, Info, Monitor, Moon, Palette, Pin, PinOff, FolderSearch, FolderOpen, Sun, X } from "lucide-react";
import { themes, type ThemeId, type ThemeMode } from "@/themes";
import { ThemeSwatch } from "@/components/ThemeSwatch";
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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Workspace actions, shared by the sidebar and its window-bar fallback. */
export function WorkspaceMenu({ folder = false, className }: { folder?: boolean; className?: string }) {
  const target = useStore((s) => s.target);
  const home = useStore((s) => s.home);
  const showHome = useStore((s) => s.showHome);
  const openSwitcher = useStore((s) => s.openSwitcher);
  const pickFolder = useStore((s) => s.pickFolder);
  const pickFile = useStore((s) => s.pickFile);
  const pinFolder = useStore((s) => s.pinFolder);
  const unpinFolder = useStore((s) => s.unpinFolder);
  const closeTarget = useStore((s) => s.closeTarget);
  const theme = useStore((s) => s.theme);
  const mode = useStore((s) => s.mode);
  const resolvedMode = useStore((s) => s.resolvedMode);
  const setTheme = useStore((s) => s.setTheme);
  const setMode = useStore((s) => s.setMode);
  const [aboutOpen, setAboutOpen] = useState(false);
  const folderTarget = folder && target?.kind === "folder" ? target : null;
  const pinned = !!folderTarget && !!home?.pinned_folders.some((f) => f.path === folderTarget.path);
  const label = folderTarget ? baseName(folderTarget.path) : "Glade";

  return (
    <>
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
      <DropdownMenuContent align="start" className="min-w-[max(14rem,var(--radix-dropdown-menu-trigger-width))]" data-no-drag>
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
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="size-4" /> Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-48">
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemeId)}>
              {themes.map((t) => (
                <DropdownMenuRadioItem key={t.id} value={t.id} onSelect={(e) => e.preventDefault()}>
                  <ThemeSwatch theme={t.id} mode={resolvedMode} /> {t.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuRadioGroup value={mode} onValueChange={(v) => setMode(v as ThemeMode)}>
              <DropdownMenuRadioItem value="light" onSelect={(e) => e.preventDefault()}><Sun className="size-4" /> Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" onSelect={(e) => e.preventDefault()}><Moon className="size-4" /> Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" onSelect={(e) => e.preventDefault()}><Monitor className="size-4" /> System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-xs">
              More themes in the palette
              <DropdownMenuShortcut>{formatShortcut(bindingFor("open-settings")!)}</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => setAboutOpen(true)}>
          <Info className="size-4" /> About Glade
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
