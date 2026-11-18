import { useEffect, useMemo, useState } from "react";
import { Command as CommandPrimitive, defaultFilter } from "cmdk";
import {
  ArrowDown as ArrowDownIcon,
  ArrowUp as ArrowUpIcon,
  BookOpen as BookOpenIcon,
  Code as CodeIcon,
  Columns2 as Columns2Icon,
  Copy as CopyIcon,
  CornerDownLeft as CornerDownLeftIcon,
  Delete as DeleteKeyIcon,
  Eye as EyeIcon,
  FilePlus as FilePlusIcon,
  FileText as FileTextIcon,
  FolderOpen as FolderOpenIcon,
  FolderPlus as FolderPlusIcon,
  History as HistoryIcon,
  Home as HomeIcon,
  ListPlus as ListPlusIcon,
  Moon as MoonIcon,
  Palette as PaletteIcon,
  PanelLeft as PanelLeftIcon,
  Pencil as PencilIcon,
  Plus as PlusIcon,
  Search as SearchIcon,
  Settings2 as SettingsIcon,
  Sun as SunIcon,
  Trash2 as TrashIcon,
  X as XIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { HighlightedText } from "./command-palette/HighlightedText";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { activeTab, focusedGroup } from "@/lib/tabs";
import { flattenNotes } from "@/lib/notes";
import { baseName } from "@/lib/paths";
import {
  KEYBINDINGS,
  bindingFor,
  isMac,
  matchesShortcut,
  shortcutKeys,
  type GlobalCommand,
} from "@/lib/keybindings";
import type { NoteSearchResult } from "@/types";
import { cn } from "@/lib/utils";

type PaletteMode = "search" | "commands";

type CommandId =
  | Exclude<GlobalCommand, "toggle-command-palette">
  | "duplicate-note"
  | "add-property"
  | "close-folder"
  | "toggle-appearance"
  | "change-theme";

type Icon = typeof FileTextIcon;

interface CommandDef {
  id: CommandId;
  /** Stable label used for filtering and selection. */
  label: string;
  icon: Icon;
}

const COMMAND_GROUPS: { heading: string; items: CommandDef[] }[] = [
  {
    heading: "Create",
    items: [
      { id: "new-note", label: "New note", icon: FilePlusIcon },
      { id: "new-folder", label: "New folder", icon: FolderPlusIcon },
      { id: "duplicate-note", label: "Duplicate note", icon: CopyIcon },
      { id: "add-property", label: "Add property", icon: ListPlusIcon },
    ],
  },
  {
    heading: "Navigate",
    items: [
      { id: "toggle-home", label: "Go to Home", icon: HomeIcon },
      { id: "open-recent", label: "Open recent", icon: HistoryIcon },
      { id: "open-folder", label: "Open folder", icon: FolderOpenIcon },
      { id: "open-file", label: "Open file", icon: FileTextIcon },
      { id: "close-folder", label: "Close folder", icon: XIcon },
      { id: "open-settings", label: "Open settings", icon: SettingsIcon },
    ],
  },
  {
    heading: "Tabs",
    items: [
      { id: "new-tab", label: "New tab", icon: PlusIcon },
      { id: "close-tab", label: "Close tab", icon: XIcon },
      { id: "split-right", label: "Split right", icon: Columns2Icon },
    ],
  },
  {
    heading: "View",
    items: [
      { id: "toggle-sidebar", label: "Toggle sidebar", icon: PanelLeftIcon },
      { id: "toggle-toc", label: "Toggle table of contents", icon: BookOpenIcon },
      { id: "toggle-edit-mode", label: "Toggle reading mode", icon: EyeIcon },
      { id: "toggle-raw-mode", label: "Toggle raw markdown", icon: CodeIcon },
      { id: "toggle-appearance", label: "Toggle light and dark mode", icon: MoonIcon },
      { id: "change-theme", label: "Change theme", icon: PaletteIcon },
    ],
  },
  {
    heading: "Danger",
    items: [{ id: "delete", label: "Delete", icon: TrashIcon }],
  },
];


/** Where the window is, as far as commands care. */
function commandContext() {
  const s = useStore.getState();
  const inFolder = s.target?.kind === "folder";
  const inWorkspace = !!s.target && !s.homeOpen && s.currentView !== "settings";
  const note = inWorkspace ? s.activeNote : null;
  const group = focusedGroup(s.tabsState);
  return { s, inFolder, inWorkspace, note, group };
}

function isAvailable(id: CommandId): boolean {
  const { s, inFolder, inWorkspace, note, group } = commandContext();
  switch (id) {
    case "new-note":
    case "new-folder":
      return inFolder;
    case "duplicate-note":
    case "add-property":
    case "toggle-toc":
    case "toggle-edit-mode":
    case "toggle-raw-mode":
      return !!note;
    case "delete":
      return !!note || (inWorkspace && inFolder && !!s.currentFolder);
    case "toggle-sidebar":
      return inFolder && !s.homeOpen && s.currentView !== "settings";
    case "new-tab":
      return inWorkspace;
    case "close-tab":
      return inWorkspace && group.tabs.length > 0;
    case "split-right":
      return inWorkspace && s.tabsState.groups.length < 2 && group.tabs.length > 0;
    case "close-folder":
      return !!s.target;
    default:
      return true;
  }
}

/** Label that says what the command will do now. */
function liveLabel(def: CommandDef): string {
  const { s, note } = commandContext();
  switch (def.id) {
    case "toggle-sidebar":
      return s.sidebarCollapsed ? "Show sidebar" : "Hide sidebar";
    case "toggle-toc":
      return note && s.tocOpen[note.path] ? "Hide table of contents" : "Show table of contents";
    case "toggle-edit-mode":
      return note && (s.noteEditMode[note.path] ?? false) ? "Switch to reading mode" : "Switch to editing mode";
    case "toggle-raw-mode":
      return note && s.isRawMode[note.path] ? "Show rich text" : "Show raw markdown";
    case "toggle-appearance":
      return s.resolvedMode === "dark" ? "Switch to light mode" : "Switch to dark mode";
    case "toggle-home":
      return s.homeOpen ? "Close Home" : "Go to Home";
    case "delete":
      return note ? "Delete note" : "Delete folder";
    default:
      return def.label;
  }
}

function liveIcon(def: CommandDef): Icon {
  const { s, note } = commandContext();
  if (def.id === "toggle-appearance") return s.resolvedMode === "dark" ? SunIcon : MoonIcon;
  if (def.id === "toggle-edit-mode") return note && (s.noteEditMode[note.path] ?? false) ? EyeIcon : PencilIcon;
  return def.icon;
}

/** Run a command if it applies right now. Returns whether it ran. */
function runCommand(id: CommandId): boolean {
  if (!isAvailable(id)) return false;
  const { s, note, group } = commandContext();
  switch (id) {
    case "new-note":
      void s.createNote(s.currentFolder || undefined);
      break;
    case "new-folder":
      s.openCreateFolder(s.currentFolder || undefined);
      break;
    case "duplicate-note":
      if (note) void s.duplicateNote(note.path);
      break;
    case "add-property":
      s.setAddPropertyOpen(true);
      break;
    case "delete":
      if (note) s.openDelete(note.path, note.title);
      else if (s.currentFolder) s.openDelete(s.currentFolder, baseName(s.currentFolder), true);
      break;
    case "toggle-toc":
      if (note) s.toggleToc(note.path);
      break;
    case "toggle-edit-mode":
      if (note) s.setNoteEditMode(note.path, !(s.noteEditMode[note.path] ?? false));
      break;
    case "toggle-raw-mode":
      if (note) s.toggleRawMode(note.path);
      break;
    case "toggle-sidebar":
      s.toggleSidebarCollapsed();
      break;
    case "new-tab":
      s.newTab();
      break;
    case "close-tab":
      s.closeTab(s.tabsState.focused, activeTab(s.tabsState).id || group.activeId);
      break;
    case "split-right":
      s.splitActive();
      break;
    case "toggle-home":
      if (s.homeOpen) s.hideHome();
      else {
        s.closeSettingsPage();
        s.showHome();
      }
      break;
    case "open-recent":
      s.openSwitcher();
      break;
    case "open-folder":
      void s.pickFolder();
      break;
    case "open-file":
      void s.pickFile();
      break;
    case "close-folder":
      void s.closeTarget();
      break;
    case "open-settings":
    case "change-theme":
      s.openSettingsPage("appearance");
      break;
    case "toggle-appearance":
      s.toggleAppearance();
      break;
  }
  return true;
}

/** Another dialog (rename, delete, ...) owns the keyboard while it is open. */
function otherModalOpen(): boolean {
  return !!document.querySelector(
    '[data-slot="dialog-content"][data-state="open"]:not([data-command-palette]), [data-slot="alert-dialog-content"][data-state="open"]',
  );
}

type NoteRow = NoteSearchResult & { recent?: boolean };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PaletteMode>("search");
  const [query, setQuery] = useState("");
  const [selectedCommand, setSelectedCommand] = useState("");
  // Re-render on store changes so labels and availability stay current.
  useStore(useShallow((s) => [s.target, s.homeOpen, s.currentView, s.activeNote, s.currentFolder, s.sidebarCollapsed, s.resolvedMode, s.tabsState, s.tocOpen, s.isRawMode, s.noteEditMode]));

  const entries = useStore((s) => s.entries);
  const recentFiles = useStore((s) => s.home?.recent_files);
  const rootPath = useStore((s) => (s.target?.kind === "folder" ? s.target.path : null));
  const searchResults = useStore((s) => s.searchResults);
  const searchNotes = useStore((s) => s.searchNotes);
  const clearSearch = useStore((s) => s.clearSearch);
  const openNote = useStore((s) => s.openNote);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setMode("search");
      setQuery("");
      setSelectedCommand("");
      clearSearch();
    }
  }

  // Global shortcuts: one listener, driven by the registry.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!open && otherModalOpen()) return;
      const match = KEYBINDINGS.find((kb) => matchesShortcut(event, kb));
      if (!match) return;
      if (match.command === "toggle-command-palette") {
        event.preventDefault();
        if (open) handleOpenChange(false);
        else setOpen(true);
        return;
      }
      if (open) return;
      if (runCommand(match.command)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Full-text search for longer queries.
  useEffect(() => {
    if (!open || mode !== "search") return;
    const q = query.trim();
    const timer = setTimeout(() => (q.length >= 3 ? searchNotes(q) : clearSearch()), 120);
    return () => clearTimeout(timer);
  }, [open, mode, query, searchNotes, clearSearch]);

  const allNotes = useMemo(() => (entries ? flattenNotes(entries) : []), [entries]);

  const noteRows: NoteRow[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Recent files from this folder first, then the rest.
      const prefix = rootPath ? `${rootPath.replace(/\/$/, "")}/` : null;
      const recentPaths = (recentFiles ?? [])
        .filter((f) => prefix && f.path.startsWith(prefix))
        .map((f) => f.path.slice(prefix!.length));
      const byPath = new Map(allNotes.map((n) => [n.path, n]));
      const recent = recentPaths.flatMap((p) => (byPath.has(p) ? [{ ...byPath.get(p)!, recent: true }] : []));
      const seen = new Set(recent.map((n) => n.path));
      return [...recent, ...allNotes.filter((n) => !seen.has(n.path))].slice(0, 50);
    }
    const local = allNotes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.path.toLowerCase().includes(q) || (n.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
    const seen = new Set(local.map((n) => n.path));
    return [...local, ...searchResults.filter((n) => !seen.has(n.path))].slice(0, 50);
  }, [query, allNotes, recentFiles, rootPath, searchResults]);

  const availableGroups = COMMAND_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAvailable(i.id)) })).filter(
    (g) => g.items.length > 0,
  );
  const availableCommands = availableGroups.flatMap((g) => g.items);

  function firstMatchingCommand(search: string) {
    return (
      availableCommands
        .map((item) => ({ label: item.label, score: search.trim() ? defaultFilter(item.label, search.trim()) : 1 }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.label ?? ""
    );
  }

  function changeMode(next: PaletteMode) {
    setSelectedCommand(next === "commands" ? firstMatchingCommand(query) : "");
    setMode(next);
  }

  function openNoteFrom(path: string, how: "active" | "tab" | "side") {
    handleOpenChange(false);
    void openNote(path, how);
  }

  function selectedNotePath(root: Element | null): string | null {
    return root?.querySelector('[cmdk-item][aria-selected="true"]')?.getAttribute("data-path") ?? null;
  }

  const modKey = isMac() ? "⌘" : "Ctrl";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-command-palette
        showCloseButton={false}
        className="top-[13vh] w-[min(44rem,calc(100%-2rem))] max-w-none translate-y-0 gap-0 overflow-hidden p-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
      >
        <DialogTitle className="sr-only">{mode === "search" ? "Search notes" : "Actions"}</DialogTitle>
        <DialogDescription className="sr-only">
          {mode === "search" ? "Search notes in this folder." : "Search app actions."}
        </DialogDescription>
        <CommandPrimitive
          key={mode}
          value={mode === "commands" ? selectedCommand : undefined}
          shouldFilter={mode === "commands"}
          loop
          className="flex flex-col"
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              changeMode(mode === "search" ? "commands" : "search");
              return;
            }
            if (event.key === "Backspace" && mode === "commands" && query.length === 0) {
              event.preventDefault();
              changeMode("search");
            }
          }}
          onValueChange={(value) => {
            if (mode !== "commands") return;
            if (query.trim() && defaultFilter(value, query.trim()) <= 0) return;
            setSelectedCommand(value);
          }}
        >
          <div className="flex h-12 items-center gap-2 border-b border-border/50 px-3">
            {mode === "commands" ? (
              <span
                aria-label="Actions mode. Press Backspace with an empty query to search notes."
                className="inline-flex h-6 shrink-0 items-center rounded-md border border-border/70 bg-muted/70 px-2 text-xs font-medium text-foreground"
              >
                Actions
              </span>
            ) : (
              <SearchIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            )}
            <CommandPrimitive.Input
              autoFocus
              value={query}
              maxLength={200}
              onValueChange={(value) => {
                setQuery(value);
                if (mode === "commands") setSelectedCommand(firstMatchingCommand(value));
              }}
              placeholder={mode === "search" ? "Search notes…" : "Search actions…"}
              className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(event) => {
                if (mode !== "search" || event.key !== "Enter") return;
                const how = event.altKey ? "side" : event.metaKey || event.ctrlKey ? "tab" : null;
                if (!how) return;
                const path = selectedNotePath(event.currentTarget.closest("[cmdk-root]"));
                if (!path) return;
                event.preventDefault();
                event.stopPropagation();
                openNoteFrom(path, how);
              }}
            />
            <Kbd>Esc</Kbd>
          </div>

          <CommandPrimitive.List className="max-h-[min(26rem,55vh)] scroll-py-1.5 overflow-y-auto overscroll-contain p-1.5 [&::-webkit-scrollbar]:hidden">
            {mode === "search" ? (
              noteRows.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                  {query.trim() ? "No notes match." : "No notes in this folder yet."}
                </p>
              ) : (
                <CommandPrimitive.Group heading={query.trim() ? "Results" : noteRows[0]?.recent ? "Recent" : "Notes"} className={groupClass}>
                  {noteRows.map((note) => {
                    const folder = note.path.includes("/") ? note.path.split("/").slice(0, -1).join("/") : "";
                    return (
                      <CommandPrimitive.Item
                        key={note.path}
                        value={note.path}
                        data-path={note.path}
                        onSelect={() => openNoteFrom(note.path, "active")}
                        className={cn(itemClass, "gap-3 py-2")}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileTextIcon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            <HighlightedText text={note.title} query={query} />
                          </span>
                          {query.trim() && note.preview ? (
                            <span className="block truncate text-xs text-muted-foreground">
                              <HighlightedText text={note.preview} query={query} />
                            </span>
                          ) : null}
                        </span>
                        {folder ? (
                          <span className="ml-auto max-w-40 shrink-0 truncate text-right text-[11px] text-muted-foreground/75">{folder}</span>
                        ) : null}
                      </CommandPrimitive.Item>
                    );
                  })}
                </CommandPrimitive.Group>
              )
            ) : (
              <>
                <CommandPrimitive.Empty className="py-8 text-center text-sm text-muted-foreground">No actions found.</CommandPrimitive.Empty>
                {availableGroups.map((group, index) => (
                  <div key={group.heading}>
                    {index > 0 ? <CommandPrimitive.Separator className="mx-1 my-1 h-px bg-border/60" /> : null}
                    <CommandPrimitive.Group heading={group.heading} className={groupClass}>
                      {group.items.map((item) => {
                        const Icon = liveIcon(item);
                        const binding = bindingFor(item.id as GlobalCommand);
                        return (
                          <CommandPrimitive.Item
                            key={item.id}
                            value={item.label}
                            keywords={[liveLabel(item)]}
                            onSelect={() => {
                              handleOpenChange(false);
                              runCommand(item.id);
                            }}
                            className={cn(itemClass, item.id === "delete" && "text-destructive data-[selected=true]:text-destructive")}
                          >
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{liveLabel(item)}</span>
                            {binding ? <KbdGroup keys={shortcutKeys(binding)} className="ml-auto" /> : null}
                          </CommandPrimitive.Item>
                        );
                      })}
                    </CommandPrimitive.Group>
                  </div>
                ))}
              </>
            )}
          </CommandPrimitive.List>
        </CommandPrimitive>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/50 px-3 py-2 text-[11px] leading-4 text-muted-foreground">
          {mode === "search" ? (
            <span className="inline-flex items-center gap-1">
              <Kbd>Tab</Kbd>
              <span>for actions</span>
            </span>
          ) : query.length === 0 ? (
            <span className="inline-flex items-center gap-1">
              <Kbd>Tab</Kbd>
              <span>or</span>
              <Kbd aria-label="Backspace">
                <DeleteKeyIcon aria-hidden />
              </Kbd>
              <span>to search</span>
            </span>
          ) : null}
          {mode === "search" ? (
            <span className="inline-flex items-center gap-1">
              <Kbd>{modKey}</Kbd>
              <Kbd aria-label="Enter">
                <CornerDownLeftIcon aria-hidden />
              </Kbd>
              <span>new tab</span>
            </span>
          ) : null}
          <span className="ml-auto inline-flex items-center gap-1">
            <Kbd aria-label="Up arrow">
              <ArrowUpIcon aria-hidden />
            </Kbd>
            <Kbd aria-label="Down arrow">
              <ArrowDownIcon aria-hidden />
            </Kbd>
            <span>to navigate</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd aria-label="Enter">
              <CornerDownLeftIcon aria-hidden />
            </Kbd>
            <span>to select</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const groupClass =
  "text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

const itemClass =
  "relative flex cursor-default items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-foreground outline-hidden select-none data-[selected=true]:bg-foreground/[0.08] [&_svg]:pointer-events-none";
