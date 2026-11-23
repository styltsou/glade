import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Command as CommandPrimitive, defaultFilter } from "cmdk";
import {
  ArrowDown as ArrowDownIcon,
  ArrowLeft as ArrowLeftIcon,
  Sparkles as SparklesIcon,
  ArrowRight as ArrowRightIcon,
  ArrowUp as ArrowUpIcon,
  Check as CheckIcon,
  Monitor as MonitorIcon,
  BookOpen as BookOpenIcon,
  Code as CodeIcon,
  Columns2 as Columns2Icon,
  Copy as CopyIcon,
  CornerDownLeft as CornerDownLeftIcon,
  Download as DownloadIcon,
  Keyboard as KeyboardIcon,
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
  PencilLine as PencilLineIcon,
  Search as SearchIcon,
  Sun as SunIcon,
  Trash2 as TrashIcon,
  X as XIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { HighlightedText } from "./command-palette/HighlightedText";
import { useStore } from "@/store";
import { useShallow } from "zustand/react/shallow";
import { activeTab, focusedGroup, historyTarget } from "@/lib/tabs";
import { flattenNotes } from "@/lib/notes";
import { isTagQuery, matchesTagQuery, parseTagQuery, tagToken } from "@/lib/tagQuery";
import { baseName } from "@/lib/paths";
import {
  KEYBINDINGS,
  bindingFor,
  formatShortcut,
  isMac,
  matchesShortcut,
  shortcutKeys,
  tabJumpTarget,
  type GlobalCommand,
} from "@/lib/keybindings";
import type { NoteSearchResult } from "@/types";
import { cn } from "@/lib/utils";
import { themes, type ThemeId, type ThemeMode } from "@/themes";
import { applyToDOM, resolveMode } from "@/store/slices/themeSlice";
import { ThemeSwatch } from "@/components/ThemeSwatch";
import { openShortcuts } from "@/components/ShortcutsDialog";

type PaletteMode = "search" | "commands" | "themes" | "modes";
const isPicker = (m: PaletteMode) => m === "themes" || m === "modes";

type CommandId =
  | Exclude<GlobalCommand, "toggle-command-palette">
  | "duplicate-note"
  | "add-property"
  | "export-note"
  | "close-folder"
  | "toggle-appearance"
  | "change-theme"
  | "change-mode"
  | "show-welcome";

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
      { id: "rename-file", label: "Rename file", icon: PencilLineIcon },
      { id: "add-property", label: "Add property", icon: ListPlusIcon },
      { id: "export-note", label: "Export note", icon: DownloadIcon },
    ],
  },
  {
    heading: "Navigate",
    items: [
      { id: "go-back", label: "Back", icon: ArrowLeftIcon },
      { id: "go-forward", label: "Forward", icon: ArrowRightIcon },
      { id: "toggle-home", label: "Go to Home", icon: HomeIcon },
      { id: "reopen-closed-tab", label: "Reopen closed tab", icon: HistoryIcon },
      { id: "open-recent", label: "Open recent", icon: HistoryIcon },
      { id: "open-folder", label: "Open folder", icon: FolderOpenIcon },
      { id: "open-file", label: "Open file", icon: FileTextIcon },
      { id: "close-folder", label: "Close folder", icon: XIcon },
    ],
  },
  {
    heading: "View",
    items: [
      { id: "toggle-sidebar", label: "Toggle sidebar", icon: PanelLeftIcon },
      { id: "split-right", label: "Split right", icon: Columns2Icon },
      { id: "toggle-toc", label: "Toggle table of contents", icon: BookOpenIcon },
      { id: "toggle-edit-mode", label: "Toggle reading mode", icon: EyeIcon },
      { id: "toggle-raw-mode", label: "Toggle raw markdown", icon: CodeIcon },
      { id: "change-theme", label: "Change theme…", icon: PaletteIcon },
      { id: "change-mode", label: "Light, dark or system…", icon: MoonIcon },
    ],
  },
  {
    heading: "Help",
    items: [
      { id: "show-shortcuts", label: "Keyboard shortcuts", icon: KeyboardIcon },
      { id: "show-welcome", label: "Welcome…", icon: SparklesIcon },
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
  const inWorkspace = !!s.target && !s.homeOpen;
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
    case "export-note":
    case "toggle-toc":
    case "toggle-edit-mode":
    case "toggle-raw-mode":
      return !!note;
    case "delete":
    case "rename-file":
      return !!note || (inWorkspace && inFolder && !!s.currentFolder);
    case "toggle-sidebar":
      return inFolder && !s.homeOpen;
    case "new-tab":
      return inWorkspace;
    case "close-tab":
      return inWorkspace && group.tabs.length > 0;
    case "reopen-closed-tab":
      return inWorkspace && s.closedTabs.length > 0;
    case "go-back":
      return inWorkspace && !!historyTarget(s.tabsState, "back");
    case "go-forward":
      return inWorkspace && !!historyTarget(s.tabsState, "forward");
    case "split-right":
      return inWorkspace && s.tabsState.groups.length < 2 && group.tabs.length > 0;
    case "close-folder":
      return !!s.target;
    case "show-welcome":
      // Only to look at the first-run screen while developing; release builds don't list it.
      return import.meta.env.DEV;
    default: {
      // Ctrl+1..9 only apply when that tab exists (9 is the last one).
      const jump = tabJumpTarget(id as GlobalCommand);
      if (jump !== null) return inWorkspace && (jump === "last" ? group.tabs.length > 0 : group.tabs.length >= jump);
      return true;
    }
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
    case "rename-file":
      return note ? "Rename file" : "Rename folder";
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
      if (!s.propertiesOpen) s.toggleProperties();
      s.setAddPropertyOpen(true);
      break;
    case "export-note":
      s.setExportOpen(true);
      break;
    case "rename-file":
      if (note) s.openRename(note.path);
      else if (s.currentFolder) s.openRename(s.currentFolder, true);
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
      if (note) {
        // The editor converts between rich text and source, so it does the toggling.
        const detail = { path: note.path, handled: false };
        window.dispatchEvent(new CustomEvent("glade:toggle-raw", { detail }));
        if (!detail.handled) s.toggleRawMode(note.path);
      }
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
    case "reopen-closed-tab":
      s.reopenClosedTab();
      break;
    case "go-back":
      s.goBack();
      break;
    case "go-forward":
      s.goForward();
      break;
    case "show-shortcuts":
      openShortcuts();
      break;
    case "show-welcome":
      s.setOnboarded(false);
      s.showHome();
      break;
    case "split-right":
      s.splitActive();
      break;
    case "toggle-home":
      if (s.homeOpen) s.hideHome();
      else s.showHome();
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
      paletteControls.openThemes();
      break;
    case "open-mode-picker":
    case "change-mode":
      paletteControls.openModes();
      break;
    case "toggle-appearance":
      s.toggleAppearance();
      break;
    default: {
      const jump = tabJumpTarget(id as GlobalCommand);
      if (jump !== null) {
        const tab = jump === "last" ? group.tabs[group.tabs.length - 1] : group.tabs[jump - 1];
        if (tab) s.activateTab(s.tabsState.focused, tab.id);
      }
    }
  }
  return true;
}

/** Set by the mounted palette, so commands can open it in a given mode. */
const paletteControls = { openThemes: () => {}, openModes: () => {} };

/** Open the palette on its theme or mode list (for menus elsewhere in the app). */
export const openThemePicker = () => paletteControls.openThemes();
export const openModePicker = () => paletteControls.openModes();

const MODE_OPTIONS: { id: ThemeMode; label: string; icon: Icon }[] = [
  { id: "light", label: "Light", icon: SunIcon },
  { id: "dark", label: "Dark", icon: MoonIcon },
  { id: "system", label: "System", icon: MonitorIcon },
];

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
  const [selectedTheme, setSelectedTheme] = useState("");
  // Delete asks again inline: the row turns into its own confirmation.
  const [confirmDelete, setConfirmDelete] = useState<"click" | "key" | null>(null);
  const pointerSelect = useRef(false);
  /** The command that closed the palette put the keyboard somewhere itself. */
  const keepFocus = useRef(false);
  // Re-render on store changes so labels and availability stay current.
  useStore(useShallow((s) => [s.target, s.homeOpen, s.theme, s.mode, s.activeNote, s.currentFolder, s.sidebarCollapsed, s.resolvedMode, s.tabsState, s.tocOpen, s.isRawMode, s.propertiesOpen, s.noteEditMode]));

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
      setSelectedTheme("");
      setConfirmDelete(null);
      clearSearch();
      // Drop any theme preview: show what is actually chosen.
      const st = useStore.getState();
      applyToDOM(st.theme, resolveMode(st.mode));
    }
  }

  function deleteTargetName(): string {
    const { note, s } = commandContext();
    return note ? note.title : s.currentFolder ? baseName(s.currentFolder) : "";
  }

  function deleteNow() {
    const { note, s } = commandContext();
    const path = note?.path ?? s.currentFolder;
    if (!path) return;
    const name = deleteTargetName();
    handleOpenChange(false);
    void s.deleteEntry(path);
    toast(`Moved “${name}” to the trash`);
  }
  const deleteNowRef = useRef(deleteNow);
  deleteNowRef.current = deleteNow;
  const confirmDeleteRef = useRef(confirmDelete);
  confirmDeleteRef.current = confirmDelete;

  function openThemes() {
    const st = useStore.getState();
    setQuery("");
    setSelectedTheme(`theme:${st.theme}`);
    setMode("themes");
    setOpen(true);
  }
  paletteControls.openThemes = openThemes;

  function openModes() {
    const st = useStore.getState();
    setQuery("");
    setSelectedTheme(`mode:${st.mode}`);
    setMode("modes");
    setOpen(true);
  }
  paletteControls.openModes = openModes;

  /** Show the highlighted theme or mode on the whole app without saving it. */
  function previewTheme(value: string) {
    const st = useStore.getState();
    const [kind, id] = value.split(":");
    if (kind === "theme") applyToDOM(id as ThemeId, resolveMode(st.mode));
    else if (kind === "mode") applyToDOM(st.theme, resolveMode(id as ThemeMode));
  }

  function commitTheme(value: string) {
    const [kind, id] = value.split(":");
    const st = useStore.getState();
    if (kind === "theme") st.setTheme(id as ThemeId);
    else if (kind === "mode") st.setMode(id as ThemeMode);
    handleOpenChange(false);
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
      if (open) {
        // Ctrl+D confirms a delete that is waiting in the palette.
        if (match.command === "delete" && confirmDeleteRef.current) {
          event.preventDefault();
          deleteNowRef.current();
        }
        return;
      }
      if (runCommand(match.command)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Full-text search for longer queries.
  useEffect(() => {
    if (!open || mode !== "search") return;
    const q = parseTagQuery(query).rest;
    const timer = setTimeout(() => (q.length >= 3 ? searchNotes(q) : clearSearch()), 120);
    return () => clearTimeout(timer);
  }, [open, mode, query, searchNotes, clearSearch]);

  const tagQuery = useMemo(() => parseTagQuery(query), [query]);
  const allTags = useStore((s) => s.tags);

  // While a tag is being typed after `tag:`, offer the matching tags, most used first.
  const tagSuggestions = useMemo(() => {
    if (mode !== "search" || tagQuery.partial === null) return [];
    const p = tagQuery.partial.toLowerCase();
    const used = new Set(tagQuery.tags.map((t) => t.toLowerCase()));
    return allTags
      .filter((t) => !used.has(t.name.toLowerCase()) && t.name.toLowerCase().includes(p))
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(p)) - Number(a.name.toLowerCase().startsWith(p)) || b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [mode, tagQuery, allTags]);

  function pickTag(name: string) {
    const start = query.toLowerCase().lastIndexOf("tag:");
    setQuery(query.slice(0, Math.max(start, 0)) + tagToken(name));
  }

  const allNotes = useMemo(() => (entries ? flattenNotes(entries) : []), [entries]);

  const noteRows: NoteRow[] = useMemo(() => {
    const tagged = isTagQuery(tagQuery);
    const q = tagQuery.rest.toLowerCase();
    if (!q && !tagged) {
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
      (n) =>
        matchesTagQuery(n.tags, tagQuery) &&
        (!q || n.title.toLowerCase().includes(q) || n.path.toLowerCase().includes(q) || (n.tags ?? []).some((t) => t.toLowerCase().includes(q))),
    );
    const seen = new Set(local.map((n) => n.path));
    return [...local, ...searchResults.filter((n) => !seen.has(n.path) && matchesTagQuery(n.tags, tagQuery))].slice(0, 50);
  }, [tagQuery, allNotes, recentFiles, rootPath, searchResults]);

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
    if (isPicker(mode)) {
      const st = useStore.getState();
      applyToDOM(st.theme, resolveMode(st.mode));
    }
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
        onCloseAutoFocus={(event) => {
          if (!keepFocus.current) return;
          keepFocus.current = false;
          event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          // Esc first cancels a pending delete, then closes.
          if (confirmDelete) {
            event.preventDefault();
            setConfirmDelete(null);
          }
        }}
        className="top-[13vh] w-[min(44rem,calc(100%-2rem))] max-w-none translate-y-0 gap-0 overflow-hidden p-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
      >
        <DialogTitle className="sr-only">{mode === "search" ? "Search notes" : mode === "themes" ? "Theme" : mode === "modes" ? "Mode" : "Actions"}</DialogTitle>
        <DialogDescription className="sr-only">
          {mode === "search" ? "Search notes in this folder." : mode === "themes" ? "Pick a theme. Moving through the list previews it." : mode === "modes" ? "Pick light, dark or system. Moving through the list previews it." : "Search app actions."}
        </DialogDescription>
        <CommandPrimitive
          key={mode}
          value={mode === "commands" ? selectedCommand : isPicker(mode) ? selectedTheme : undefined}
          shouldFilter={mode !== "search"}
          loop
          className="flex flex-col"
          onKeyDown={(event) => {
            if (event.key === "Tab") {
              event.preventDefault();
              changeMode(mode === "search" ? "commands" : "search");
              return;
            }
            if (event.key === "Backspace" && mode !== "search" && query.length === 0) {
              event.preventDefault();
              changeMode(isPicker(mode) ? "commands" : "search");
            }
          }}
          onValueChange={(value) => {
            if (isPicker(mode)) {
              setSelectedTheme(value);
              previewTheme(value);
              return;
            }
            if (mode !== "commands") return;
            if (query.trim() && defaultFilter(value, query.trim()) <= 0) return;
            if (value !== "Delete") setConfirmDelete(null);
            setSelectedCommand(value);
          }}
        >
          <div className="flex h-14 items-center gap-2.5 border-b border-border/50 px-4">
            {mode !== "search" ? (
              <span
                aria-label={isPicker(mode) ? "Picker. Press Backspace with an empty query to go back to actions." : "Actions mode. Press Backspace with an empty query to search notes."}
                className="inline-flex h-7 shrink-0 items-center rounded-md border border-border/70 bg-muted/70 px-2.5 text-[13px] font-medium text-foreground"
              >
                {mode === "themes" ? "Theme" : mode === "modes" ? "Mode" : "Actions"}
              </span>
            ) : (
              <SearchIcon aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
            )}
            <CommandPrimitive.Input
              autoFocus
              value={query}
              maxLength={200}
              onValueChange={(value) => {
                setQuery(value);
                setConfirmDelete(null);
                if (mode === "commands") setSelectedCommand(firstMatchingCommand(value));
              }}
              placeholder={mode === "search" ? "Search notes, or tag: to filter…" : mode === "themes" ? "Pick a theme…" : mode === "modes" ? "Light, dark or system…" : "Search actions…"}
              className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
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

          <CommandPrimitive.List className="max-h-[min(30rem,58vh)] scroll-py-2 overflow-y-auto overscroll-contain p-2 [&::-webkit-scrollbar]:hidden">
            {mode === "search" ? (
              noteRows.length === 0 && tagSuggestions.length === 0 ? (
                <p className="px-3 py-10 text-center text-[14px] text-muted-foreground">
                  {query.trim() ? "No notes match." : "No notes in this folder yet."}
                </p>
              ) : (
                <>
                {tagSuggestions.length > 0 ? (
                  <CommandPrimitive.Group heading="Tags" className={groupClass}>
                    {tagSuggestions.map((tag) => (
                      <CommandPrimitive.Item
                        key={tag.name}
                        value={`tag:${tag.name}`}
                        onSelect={() => pickTag(tag.name)}
                        className={cn(itemClass, "gap-4 py-2")}
                      >
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{tag.name}</span>
                        <span className="ml-auto shrink-0 text-[13px] text-muted-foreground/75">{tag.count}</span>
                      </CommandPrimitive.Item>
                    ))}
                  </CommandPrimitive.Group>
                ) : null}
                {noteRows.length > 0 ? (
                <CommandPrimitive.Group heading={query.trim() ? "Results" : noteRows[0]?.recent ? "Recent" : "Notes"} className={groupClass}>
                  {noteRows.map((note) => {
                    const folder = note.path.includes("/") ? note.path.split("/").slice(0, -1).join("/") : "";
                    return (
                      <CommandPrimitive.Item
                        key={note.path}
                        value={note.path}
                        data-path={note.path}
                        onSelect={() => openNoteFrom(note.path, "active")}
                        className={cn(itemClass, "gap-4 py-2")}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">
                            <HighlightedText text={note.title} query={tagQuery.rest} />
                          </span>
                          {tagQuery.rest && note.preview ? (
                            <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
                              <HighlightedText text={note.preview} query={tagQuery.rest} />
                            </span>
                          ) : null}
                        </span>
                        {folder ? (
                          <span className="ml-auto max-w-48 shrink-0 truncate text-right text-[13px] text-muted-foreground/75">{folder}</span>
                        ) : null}
                      </CommandPrimitive.Item>
                    );
                  })}
                </CommandPrimitive.Group>
                ) : null}
                </>
              )
            ) : mode === "modes" ? (
              <ModeList currentMode={useStore.getState().mode} onSelect={commitTheme} />
            ) : mode === "themes" ? (
              <ThemeList
                current={useStore.getState().theme}
                currentMode={useStore.getState().mode}
                onSelect={commitTheme}
              />
            ) : (
              <>
                <CommandPrimitive.Empty className="py-10 text-center text-[14px] text-muted-foreground">No actions found.</CommandPrimitive.Empty>
                {availableGroups.map((group, index) => (
                  <div key={group.heading}>
                    {index > 0 ? <CommandPrimitive.Separator className="mx-2 my-1.5 h-px bg-border/60" /> : null}
                    <CommandPrimitive.Group heading={group.heading} className={groupClass}>
                      {group.items.map((item) => {
                        const Icon = liveIcon(item);
                        const binding = bindingFor((item.id === "change-theme" ? "open-settings" : item.id === "change-mode" ? "open-mode-picker" : item.id) as GlobalCommand);
                        return (
                          <CommandPrimitive.Item
                            key={item.id}
                            value={item.label}
                            keywords={[liveLabel(item)]}
                            onPointerDown={() => { pointerSelect.current = true; }}
                            onSelect={() => {
                              const byPointer = pointerSelect.current;
                              pointerSelect.current = false;
                              if (item.id === "change-theme") {
                                openThemes();
                                return;
                              }
                              if (item.id === "change-mode") {
                                openModes();
                                return;
                              }
                              if (item.id === "delete") {
                                if (confirmDelete) deleteNow();
                                else setConfirmDelete(byPointer ? "click" : "key");
                                return;
                              }
                              keepFocus.current = item.id === "new-note" || item.id === "rename-file";
                              handleOpenChange(false);
                              runCommand(item.id);
                            }}
                            className={cn(
                              itemClass,
                              item.id === "delete" && "text-destructive data-[selected=true]:text-destructive",
                              item.id === "delete" && confirmDelete && "bg-destructive/10 data-[selected=true]:bg-destructive/15",
                            )}
                          >
                            <Icon className={cn("size-[18px] shrink-0", item.id === "delete" ? "text-destructive" : "text-muted-foreground [[data-selected=true]_&]:text-foreground")} />
                            <span className="truncate">
                              {item.id === "delete" && confirmDelete
                                ? `${confirmDelete === "click" ? "Click" : `Press Enter or ${formatShortcut(bindingFor("delete")!)}`} again to move “${deleteTargetName()}” to the trash`
                                : liveLabel(item)}
                            </span>
                            {binding && !(item.id === "delete" && confirmDelete) ? <KbdGroup keys={shortcutKeys(binding)} className="ml-auto" /> : null}
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 px-4 py-2.5 text-xs leading-5 text-muted-foreground">
          {mode === "search" ? (
            <span className="inline-flex items-center gap-1">
              <Kbd>Tab</Kbd>
              <span>for actions</span>
            </span>
          ) : isPicker(mode) ? (
            <span className="inline-flex items-center gap-1">
              <Kbd aria-label="Backspace">
                <DeleteKeyIcon aria-hidden />
              </Kbd>
              <span>back to actions</span>
              <Kbd className="ml-2">Esc</Kbd>
              <span>to cancel</span>
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

/** Themes, then modes. Highlighting one previews it; Enter keeps it. */
function ThemeList({ current, currentMode, onSelect }: { current: ThemeId; currentMode: ThemeMode; onSelect: (value: string) => void }) {
  const resolved = resolveMode(currentMode);
  return (
    <>
      <CommandPrimitive.Empty className="py-10 text-center text-[14px] text-muted-foreground">No themes found.</CommandPrimitive.Empty>
      <CommandPrimitive.Group heading="Theme" className={groupClass}>
        {themes.map((t) => (
          <CommandPrimitive.Item key={t.id} value={`theme:${t.id}`} keywords={[t.label]} onSelect={onSelect} className={itemClass}>
            <ThemeSwatch theme={t.id} mode={resolved} className="size-[18px]" />
            <span className="truncate">{t.label}</span>
            {t.id === current ? <CheckIcon className="ml-auto size-4 text-muted-foreground" /> : null}
          </CommandPrimitive.Item>
        ))}
      </CommandPrimitive.Group>
    </>
  );
}

/** Light, dark or system. Highlighting one previews it; Enter keeps it. */
function ModeList({ currentMode, onSelect }: { currentMode: ThemeMode; onSelect: (value: string) => void }) {
  return (
    <>
      <CommandPrimitive.Empty className="py-10 text-center text-[14px] text-muted-foreground">No modes found.</CommandPrimitive.Empty>
      <CommandPrimitive.Group heading="Mode" className={groupClass}>
        {MODE_OPTIONS.map((m) => (
          <CommandPrimitive.Item key={m.id} value={`mode:${m.id}`} keywords={[m.label, "appearance"]} onSelect={onSelect} className={itemClass}>
            <m.icon className="size-[18px] shrink-0 text-muted-foreground [[data-selected=true]_&]:text-foreground" />
            <span className="truncate">{m.label}</span>
            {m.id === currentMode ? <CheckIcon className="ml-auto size-4 text-muted-foreground" /> : null}
          </CommandPrimitive.Item>
        ))}
      </CommandPrimitive.Group>
    </>
  );
}

const groupClass =
  "text-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

const itemClass =
  "relative flex min-h-10 cursor-default items-center gap-3 rounded-lg px-3 py-2 text-[14px] text-foreground outline-hidden select-none data-[selected=true]:bg-foreground/[0.08] [&_svg]:pointer-events-none";
