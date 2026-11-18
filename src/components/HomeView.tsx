import { FolderPlus, PlusIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { FolderCard } from "@/components/FolderCard";
import { NoteCard } from "@/components/NoteCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useStore } from "@/store";
import { baseName } from "@/lib/paths";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import type { VaultEntry } from "@/types";

function NoteCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50">
      <Skeleton className="h-4 w-3/4 mb-1 bg-foreground/10" />
      <Skeleton className="h-3 w-full bg-foreground/10" />
      <Skeleton className="h-3 w-5/6 bg-foreground/10" />
      <div className="flex justify-between mt-auto pt-3">
        <div className="flex gap-1">
          <Skeleton className="h-3 w-10 bg-foreground/10" />
          <Skeleton className="h-3 w-10 bg-foreground/10" />
        </div>
        <Skeleton className="h-3 w-12 bg-foreground/10" />
      </div>
    </div>
  );
}

function FolderCardSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 text-left w-full rounded-lg p-3 bg-card border border-border">
      <div className="flex items-center gap-2 mb-0.5">
        <Skeleton className="h-4 w-4 shrink-0 rounded-[3px] bg-foreground/10" />
        <Skeleton className="h-3 w-1/2 bg-foreground/10" />
      </div>
      <div className="flex items-center justify-between mt-1">
        <Skeleton className="h-2 w-16 bg-foreground/10" />
        <Skeleton className="h-2 w-12 bg-foreground/10" />
      </div>
    </div>
  );
}

export function HomeView() {
  const entries = useStore((state) => state.entries);
  const rootName = useStore((state) => (state.target ? baseName(state.target.path) : "Home"));
  const folderNotes = useStore((state) => state.folderNotes);
  const isHomeLoading = useStore((state) => state.isHomeLoading);
  const isFolderNotesLoading = useStore((state) => state.isFolderNotesLoading);
  const isVaultLoading = useStore((state) => state.isVaultLoading);
  const currentFolder = useStore((state) => state.currentFolder);
  const loadAll = useStore((state) => state.loadAll);
  const openCreateFolder = useStore((state) => state.openCreateFolder);
  const createNote = useStore((state) => state.createNote);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const hasNotes = folderNotes.length > 0;
  const hasFolders = currentFolder
    ? findEntryByPath(entries, currentFolder)?.children.some((e) => e.is_dir)
    : entries.some((e) => e.is_dir);

  const currentEntry = currentFolder
    ? findEntryByPath(entries, currentFolder)
    : null;
  const subFolders = (currentFolder
    ? currentEntry?.children.filter((e) => e.is_dir) || []
    : entries.filter((e) => e.is_dir)
  ).sort((a, b) => a.name.localeCompare(b.name));

  const expectedNoteCount = currentFolder
    ? currentEntry?.children.filter((e) => !e.is_dir).length || 0
    : entries.filter((e) => !e.is_dir).length; // Depending on how home notes are fetched, this might just be 0 if home only shows pinned, but we'll assume folder notes if any exist. Just for skeletons.

  const hasData = hasNotes || hasFolders || expectedNoteCount > 0;
  const isLoadingAny = isVaultLoading || isHomeLoading || isFolderNotesLoading;

  // Show skeletons only while data is actively loading, never when vault is confirmed empty.
  const shouldShowFolderSkeletons = isVaultLoading && subFolders.length === 0;
  const shouldShowNoteSkeletons =
    (isVaultLoading && !hasNotes) ||
    (isFolderNotesLoading && expectedNoteCount > 0 && !hasNotes) ||
    (isHomeLoading && !currentFolder && !hasNotes);

  return (
    <div className="flex flex-col flex-1 h-full w-full bg-background overflow-hidden relative">
      {/* Folder Header */}
      {currentFolder && (
        <div className="flex items-center justify-between h-10 shrink-0 select-none border-b w-full bg-background">
          <div className="flex items-center pl-3 h-full min-w-0">
            <Breadcrumbs />
          </div>

          <div className="flex items-center gap-1 pr-3 h-full shrink-0 text-[13px] sm:text-[14px] text-muted-foreground self-center -mt-px">
          </div>
        </div>
      )}

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 overflow-auto w-full">
        <div className="px-4 py-10 max-w-6xl mx-auto w-full h-full flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {currentEntry ? currentEntry.name : rootName}
              </h1>
              {currentEntry && (
                <p className="text-sm text-muted-foreground mt-1">
                  {currentEntry.children.length} item
                  {currentEntry.children.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

        <div className="space-y-12">
          {/* Folders section */}
          {(hasData || !isLoadingAny) && (
            <section>
              <SectionHeader label="Folders" />
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,13rem),1fr))] gap-4">
                {shouldShowFolderSkeletons
                  ? [...Array(4)].map((_, i) => <FolderCardSkeleton key={i} />)
                  : subFolders.map((folder) => <FolderCard key={folder.path} folder={folder} />)}
                {!shouldShowFolderSkeletons && (
                  <CreateCard
                    icon={<FolderPlus className="size-4" />}
                    label="New folder"
                    shortcut={formatShortcut(bindingFor("new-folder")!)}
                    onClick={() => openCreateFolder(currentFolder || undefined)}
                  />
                )}
              </div>
            </section>
          )}

          {/* Notes section */}
          {(hasData || !isLoadingAny) && (
            <section>
              <SectionHeader label="Notes" />
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-4">
                {shouldShowNoteSkeletons
                  ? [...Array(Math.min(6, !isVaultLoading ? expectedNoteCount : 6))].map((_, i) => <NoteCardSkeleton key={i} />)
                  : [...folderNotes]
                      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.title.localeCompare(b.title))
                      .map((card) => <NoteCard key={card.path} card={card} />)}
                {!shouldShowNoteSkeletons && (
                  <CreateCard
                    icon={<PlusIcon className="size-4" />}
                    label="New note"
                    shortcut={formatShortcut(bindingFor("new-note")!)}
                    onClick={() => createNote(currentFolder || undefined)}
                    tall
                  />
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
    </div>
  );
}

function findEntryByPath(
  entries: VaultEntry[],
  path: string,
): VaultEntry | null {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    if (entry.children && entry.children.length > 0) {
      const found = findEntryByPath(entry.children, path);
      if (found) return found;
    }
  }
  return null;
}

/** A dashed card at the end of a grid that creates a new item there. */
function CreateCard({
  icon,
  label,
  shortcut,
  onClick,
  tall = false,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut: string;
  onClick: () => void;
  tall?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`press group flex h-full w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 text-sm text-muted-foreground hover:border-foreground/25 hover:bg-foreground/[0.03] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        tall ? "min-h-28" : "min-h-[4.5rem]"
      }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="ml-1 text-xs text-muted-foreground/70 opacity-0 transition-opacity group-hover:opacity-100">{shortcut}</span>
    </button>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-xs font-medium text-muted-foreground mb-4">
      {label}
    </h2>
  );
}
