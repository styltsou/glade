import { StateCreator } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { offerLinkUpdates } from "@/lib/linkUpdates";
import { changeFiles, isWithin, relocatePath, scheduleWrite } from "@/lib/fileChanges";
import * as T from "@/lib/tabs";
import { isAbsolutePath } from "@/lib/links";
import type { VaultEntry, NoteData, PropertyValue } from "@/types";

export interface MissingLink {
  from: string;
  href: string;
  abs: string;
  outside: boolean;
}
import { 
  addEntryToTree, 
  removeEntryFromTree, 
  moveEntryInTree, 
  updateEntryInTree 
} from "@/lib/tree";

export interface NoteSlice {
  selectNote: (path: string, partial?: Partial<NoteData>) => Promise<void>;
  /** Load a note into the cache and make it the active note (tab state is set by the caller). */
  loadNote: (path: string, partial?: Partial<NoteData>) => Promise<void>;
  saveNote: (path: string, content: string, force?: boolean) => Promise<void>;
  /** Re-read a note from disk and replace what is shown (body included). */
  reloadNote: (path: string) => Promise<void>;
  createNote: (folder?: string) => Promise<void>;
  renameNote: (path: string, newTitle: string) => Promise<void>;
  renameFolder: (path: string, newName: string) => Promise<void>;
  duplicateNote: (path: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  createFolder: (path: string) => Promise<void>;
  updateNoteTags: (tags: string[], path?: string) => Promise<void>;
  moveEntry: (fromPath: string, toPath: string) => Promise<void>;
  tocOpen: Record<string, boolean>;
  toggleToc: (path: string) => void;
  tocInitialized: Record<string, boolean>;
  markTocInitialized: (path: string) => void;
  tocWidth: number;
  setTocWidth: (width: number) => void;
  noteEditMode: Record<string, boolean>;
  setNoteEditMode: (path: string, isEditMode: boolean) => void;
  isRawMode: Record<string, boolean>;
  toggleRawMode: (path: string) => void;
  mermaidFullscreenOpen: boolean;
  setMermaidFullscreenOpen: (open: boolean) => void;
  /** Properties panel collapsed (one setting for every note). */
  propertiesOpen: boolean;
  toggleProperties: () => void;
  /** Asks the properties section to open and start an inline new-property row. */
  addPropertyOpen: boolean;
  setAddPropertyOpen: (open: boolean) => void;
  /** The export dialog for the active note (opened from the command palette). */
  exportOpen: boolean;
  setExportOpen: (open: boolean) => void;
  /** Re-read a note's frontmatter-derived fields without touching its body. */
  /** Notes visited through links, so "Back" can return after following one. */
  backStack: string[];
  linkNavigate: (path: string) => Promise<void>;
  goBack: () => Promise<void>;
  missingLink: MissingLink | null;
  setMissingLink: (link: MissingLink | null) => void;
  refreshNoteMeta: (path: string) => Promise<void>;
  applyNoteMeta: (note: NoteData) => void;
  setProperty: (key: string, value: PropertyValue, path?: string) => Promise<void>;
  removeProperty: (key: string, path?: string) => Promise<void>;
  setFrontmatterText: (text: string, path?: string) => Promise<void>;
}

import type { StoreState } from "../index";

/** The most recently requested note; stale reads must not replace it. */
let latestSelect = "";

const errorText = (e: unknown) => String(e).replace(/^(Error|Invalid path): /, "");

/** Every piece of state that refers to a note or folder by path, after a move. */
function movedState(s: StoreState, from: string, to: string): Partial<StoreState> {
  const move = (path: string) => relocatePath(path, from, to);
  const moveKeys = <V,>(map: Record<string, V>): Record<string, V> =>
    Object.fromEntries(Object.entries(map).map(([path, value]) => [move(path), value]));
  return {
    tabsState: T.renamePath(s.tabsState, from, to),
    closedTabs: T.renameClosed(s.closedTabs, from, to),
    expandedFolders: s.expandedFolders.map(move),
    pinnedNotePaths: s.pinnedNotePaths.map(move),
    backStack: s.backStack.map(move),
    currentFolder: s.currentFolder === null ? null : move(s.currentFolder),
    noteEditMode: moveKeys(s.noteEditMode),
    noteScrollPositions: moveKeys(s.noteScrollPositions),
    isRawMode: moveKeys(s.isRawMode),
    tocOpen: moveKeys(s.tocOpen),
    tocInitialized: moveKeys(s.tocInitialized),
  };
}

type SetState = Parameters<StateCreator<StoreState>>[0];
type GetState = Parameters<StateCreator<StoreState>>[1];

/** The file operations the note actions share. */
function createFileOps(set: SetState, get: GetState) {
  const readNote = (path: string) => invoke<NoteData>("read_note", { path });

  const writeNote = async (path: string, content: string, force = false) => {
    await invoke("write_note", { path, content, force });
    const note = await readNote(path);
    set((state: StoreState) => ({
      activeNote: state.activeNote?.path === path ? note : state.activeNote,
      noteCache: { ...state.noteCache, [path]: note },
      vaultError: null,
    }));
  };

  /** Change files without losing or undoing what open editors hold. */
  const changeOpenFiles = (scope: string | null, apply: () => Promise<string | null>) =>
    changeFiles<NoteData>({
      scope,
      apply,
      save: writeNote,
      read: readNote,
      commit: (to, notes) =>
        set((state: StoreState) => {
          // Cached copies of what changed are stale; only the re-read ones stay.
          const noteCache = Object.fromEntries(
            Object.entries(state.noteCache).filter(([path]) => !isWithin(path, scope)),
          );
          for (const [path, note] of notes) noteCache[path] = note;

          const moved = scope !== null && to !== null && to !== scope;
          let activeNote = state.activeNote;
          if (activeNote && isWithin(activeNote.path, scope)) {
            const path = moved ? relocatePath(activeNote.path, scope, to) : activeNote.path;
            activeNote = notes.get(path) ?? { ...activeNote, id: path, path };
          }
          return { ...(moved ? movedState(state, scope, to) : {}), noteCache, activeNote };
        }),
    });

  /** After `from` became `to`: refresh the tree, then offer to fix links to it. */
  const afterMove = async (from: string, to: string) => {
    await get().refreshTree();
    await offerLinkUpdates(from, to, async (update) => {
      await changeOpenFiles(null, async () => {
        await update();
        return null;
      });
    });
  };

  return { writeNote, changeOpenFiles, afterMove };
}

export const createNoteSlice: StateCreator<StoreState, [], [], NoteSlice> = (set, get) =>
  noteActions(set, get, createFileOps(set, get));

const noteActions = (
  set: SetState,
  get: GetState,
  { writeNote, changeOpenFiles, afterMove }: ReturnType<typeof createFileOps>,
): NoteSlice => ({
  selectNote: async (path: string, partial?: Partial<NoteData>) => {
    await get().openNote(path, "active", partial);
  },

  loadNote: async (path: string, partial?: Partial<NoteData>) => {
    latestSelect = path;
    const { noteCache } = get();
    
    if (partial || noteCache[path]) {
      const cached = noteCache[path];
      set({ 
        activeNote: {
          id: partial?.id || cached?.id || "",
          path,
          title: partial?.title || cached?.title || path.split("/").pop()?.replace(".md", "") || "Untitled",
          body: cached?.body || "",
          tags: partial?.tags || cached?.tags || [],
          preview: partial?.preview || cached?.preview || "",
          created: cached?.created || null,
          updated: cached?.updated || null,
          ...partial,
        } as NoteData,
        vaultError: null,
        currentFolder: null
      });
    }

    try {
      const note = await invoke<NoteData>("read_note", { path });
      
      set((state: StoreState) => ({ 
        noteCache: { ...state.noteCache, [path]: note } 
      }));

      // Show it unless another note was requested while this one was loading.
      // (Callers without preview data, e.g. link navigation and loose files,
      // have no placeholder note yet, so the read result is what appears.)
      if (latestSelect === path) {
        set({ activeNote: note, currentFolder: null, vaultError: null });
      }
    } catch (e) {
      if (!get().activeNote) {
        set({ vaultError: String(e) });
      }
    }
  },

  reloadNote: async (path: string) => {
    try {
      const note = await invoke<NoteData>("read_note", { path });
      set((state: StoreState) => ({
        noteCache: { ...state.noteCache, [path]: note },
        activeNote: state.activeNote?.path === path ? note : state.activeNote,
      }));
    } catch {
      // Gone or unreadable; the external-change handling reports removal.
    }
  },

  saveNote: (path: string, content: string, force?: boolean) =>
    scheduleWrite(path, async (current) => {
      try {
        await writeNote(current, content, force);
      } catch (e) {
        set({ vaultError: String(e) });
        // The file changed or went away since it was loaded: let the editor
        // ask, instead of silently overwriting it or bringing it back.
        const changed = String(e).startsWith("Conflict");
        if (changed || String(e).startsWith("Not found")) {
          const root = get().target;
          const abs = isAbsolutePath(current) ? current : `${root?.path ?? ""}/${current}`;
          get().handleExternalChange({ path: abs, kind: changed ? "modified" : "removed" });
        }
        throw e;
      }
    }),

  createNote: async (folder?: string) => {
    try {
      const note = await invoke<NoteData>("create_note", { folder: folder ?? null });
      
      const newEntry: VaultEntry = {
        id: note.id,
        name: note.title,
        path: note.path,
        is_dir: false,
        children: [],
        modified: note.updated,
        created_at: note.created,
        tags: note.tags,
      };
      
      const newEntries = addEntryToTree(get().entries, folder, newEntry);
      
      set((state: StoreState) => ({
        entries: newEntries,
        idToPath: { ...state.idToPath, [note.id]: note.path },
        noteCache: { ...state.noteCache, [note.path]: note },
        vaultError: null
      }));
      get().hideHome();
      await get().openNote(note.path, "active", note);
    } catch (e) {
      set({ vaultError: String(e) });
      toast.error("Couldn't create the note", { description: errorText(e) });
    }
  },

  renameNote: async (path: string, newTitle: string) => {
    set({ entries: updateEntryInTree(get().entries, path, { name: newTitle }) });
    try {
      const to = (await changeOpenFiles(path, () => invoke<string>("rename_note", { path, newTitle })))!;
      // A different path means the title came from the file name.
      if (to !== path) await afterMove(path, to);
      else await get().refreshTree();
    } catch (e) {
      await get().loadVault();
      set({ vaultError: String(e) });
      toast.error("Couldn't rename the note", { description: errorText(e) });
    }
  },

  renameFolder: async (path: string, newName: string) => {
    try {
      const to = (await changeOpenFiles(path, () => invoke<string>("rename_folder", { path, newName })))!;
      if (to !== path) await afterMove(path, to);
    } catch (e) {
      await get().loadVault();
      set({ vaultError: String(e) });
      toast.error("Couldn't rename the folder", { description: errorText(e) });
    }
  },

  duplicateNote: async (path: string) => {
    try {
      const note = await invoke<NoteData>("duplicate_note", { path });
      
      const newEntry: VaultEntry = {
        id: note.id,
        name: note.title,
        path: note.path,
        is_dir: false,
        children: [],
        modified: note.updated,
        created_at: note.created,
        tags: note.tags,
      };
      
      const parentPath = note.path.includes('/') 
        ? note.path.substring(0, note.path.lastIndexOf('/'))
        : undefined;
      
      const newEntries = addEntryToTree(get().entries, parentPath, newEntry);
      set({ entries: newEntries });
      get().loadFolderNotes();
      
      await get().selectNote(note.path);
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  deleteEntry: async (path: string) => {
    const { activeNote, entries, noteCache, pinnedNotes, folderNotes } = get();
    
    const newEntries = removeEntryFromTree(entries, path);

    const newCache = { ...noteCache };
    delete newCache[path];
    if (path.includes('/')) {
      const folderPrefix = path + '/';
      for (const cachePath of Object.keys(newCache)) {
        if (cachePath.startsWith(folderPrefix)) {
          delete newCache[cachePath];
        }
      }
    }

    const newPinned = pinnedNotes.filter((n: { path: string }) => {
      if (n.path === path) return false;
      if (path.includes('/')) {
        const folderPrefix = path + '/';
        if (n.path.startsWith(folderPrefix)) return false;
      }
      return true;
    });

    const newFolderNotes = folderNotes.filter((n: { path: string }) => {
      if (n.path === path) return false;
      if (path.includes('/')) {
        const folderPrefix = path + '/';
        if (n.path.startsWith(folderPrefix)) return false;
      }
      return true;
    });

    set({
      entries: newEntries,
      activeNote: activeNote?.path === path ? null : activeNote,
      noteCache: newCache,
      pinnedNotes: newPinned,
      folderNotes: newFolderNotes,
    });
    get().tabsRemovePath(path);
    
    try {
      await invoke("delete_entry", { path });
      get().loadFolderNotes();
    } catch (e) {
      await get().loadVault();
      set({ vaultError: String(e) });
    }
  },

  createFolder: async (path: string) => {
    try {
      await invoke("create_folder", { path });
      await get().loadVault();
      get().loadFolderNotes();
    } catch (e) {
      set({ vaultError: String(e) });
      await get().loadVault();
    }
  },

  updateNoteTags: async (tags: string[], path?: string) => {
    const { entries, noteCache } = get();
    const target = path ?? get().activeNote?.path;
    const activeNote = target ? noteCache[target] ?? (get().activeNote?.path === target ? get().activeNote : null) : null;
    if (!activeNote) return;

    // 1. Optimistic update of activeNote and cache
    const updatedNote = { ...activeNote, tags };
    set({
      activeNote: get().activeNote?.path === activeNote.path ? updatedNote : get().activeNote,
      noteCache: { ...noteCache, [activeNote.path]: updatedNote },
    });

    // 2. Optimistic update of the entries tree
    const newEntries = updateEntryInTree(entries, activeNote.path, { tags });
    set({ entries: newEntries });

    try {
      // 3. Persist to backend
      await invoke("update_tags", { path: activeNote.path, tags });
      get().refreshNoteMeta(activeNote.path);
      
      // 4. Refresh global tags list (this is usually fast and non-disruptive)
      await get().loadTags();
      
      // We skip loadVault() on success since entries are updated optimistically above.
      // This avoids the flash caused by toggling isVaultLoading.
    } catch (e) {
      set({ vaultError: String(e) });
      // On error, reload vault to ensure consistency
      await get().loadVault();
    }
  },

  moveEntry: async (fromPath: string, toPath: string) => {
    const originalEntries = get().entries;
    const newEntries = moveEntryInTree(originalEntries, fromPath, toPath);
    
    set({ entries: newEntries });
    
    try {
      await changeOpenFiles(fromPath, async () => {
        await invoke("move_entry", { fromPath, toPath });
        return toPath;
      });
    } catch (e) {
      set({ entries: originalEntries, vaultError: String(e) });
      toast.error(`Couldn't move "${fromPath.split("/").pop()}"`, { description: errorText(e) });
      return;
    }
    await afterMove(fromPath, toPath);
  },

  tocOpen: {},

  toggleToc: (path: string) => {
    set((state: StoreState) => ({
      tocOpen: {
        ...state.tocOpen,
        [path]: !state.tocOpen[path],
      },
    }));
  },

  tocInitialized: {},

  markTocInitialized: (path: string) => {
    set((state: StoreState) => ({
      tocInitialized: {
        ...state.tocInitialized,
        [path]: true,
      },
    }));
  },

  tocWidth: 280,

  setTocWidth: (width: number) => {
    set({ tocWidth: width });
  },

  noteEditMode: {},

  setNoteEditMode: (path: string, isEditMode: boolean) => {
    set((state: StoreState) => ({
      noteEditMode: {
        ...state.noteEditMode,
        [path]: isEditMode,
      },
    }));
  },

  isRawMode: {},

  toggleRawMode: (path: string) => {
    set((state: StoreState) => ({
      isRawMode: {
        ...state.isRawMode,
        [path]: !state.isRawMode[path],
      },
    }));
  },

  mermaidFullscreenOpen: false,

  setMermaidFullscreenOpen: (open: boolean) => {
    set({ mermaidFullscreenOpen: open });
  },

  backStack: [],
  linkNavigate: async (path: string) => {
    const current = get().activeNote?.path;
    if (current) set((s: StoreState) => ({ backStack: [...s.backStack, current] }));
    get().hideHome();
    await get().selectNote(path);
  },
  goBack: async () => {
    const stack = get().backStack;
    const prev = stack[stack.length - 1];
    if (!prev) return;
    set({ backStack: stack.slice(0, -1) });
    await get().selectNote(prev);
  },
  missingLink: null,
  setMissingLink: (link: MissingLink | null) => set({ missingLink: link }),

  propertiesOpen: false,
  toggleProperties: () => set((s: StoreState) => ({ propertiesOpen: !s.propertiesOpen })),
  addPropertyOpen: false,
  setAddPropertyOpen: (open: boolean) => set({ addPropertyOpen: open }),
  exportOpen: false,
  setExportOpen: (open: boolean) => set({ exportOpen: open }),

  refreshNoteMeta: async (path: string) => {
    try {
      const note = await invoke<NoteData>("read_note", { path });
      get().applyNoteMeta(note);
    } catch {
      // The note may have been moved or deleted; the tree refresh handles that.
    }
  },

  setProperty: async (key: string, value: PropertyValue, path?: string) => {
    const target = path ?? get().activeNote?.path;
    if (!target) return;
    try {
      const note = await invoke<NoteData>("set_property", { path: target, key, value });
      get().applyNoteMeta(note);
      get().loadTags();
    } catch (e) {
      set({ vaultError: String(e) });
      throw e;
    }
  },

  removeProperty: async (key: string, path?: string) => {
    const target = path ?? get().activeNote?.path;
    if (!target) return;
    try {
      const note = await invoke<NoteData>("remove_property", { path: target, key });
      get().applyNoteMeta(note);
      get().loadTags();
    } catch (e) {
      set({ vaultError: String(e) });
    }
  },

  setFrontmatterText: async (text: string, path?: string) => {
    const target = path ?? get().activeNote?.path;
    if (!target) return;
    const note = await invoke<NoteData>("set_frontmatter_text", { path: target, text });
    get().applyNoteMeta(note);
    get().loadTags();
  },

  applyNoteMeta: (note: NoteData) => {
    // Only frontmatter-derived fields: the body in the editor may hold unsaved edits.
    set((state: StoreState) => {
      const merge = (n: NoteData): NoteData => ({
        ...n,
        title: note.title,
        tags: note.tags,
        properties: note.properties,
        updated: note.updated,
      });
      return {
        activeNote: state.activeNote?.path === note.path ? merge(state.activeNote) : state.activeNote,
        noteCache: state.noteCache[note.path]
          ? { ...state.noteCache, [note.path]: merge(state.noteCache[note.path]) }
          : state.noteCache,
      };
    });
  },
});
