import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { NoteCard } from "@/components/NoteCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { VaultEntry } from "@/types";
import { PlusIcon, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderCard } from "@/components/FolderCard";
import { Breadcrumbs } from "@/components/Breadcrumbs";

function NoteCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50">
      <Skeleton className="h-4 w-3/4 mb-1" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex justify-between mt-auto pt-3">
        <div className="flex gap-1">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-10" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function HomeView() {
  const entries = useStore((state) => state.entries);
  const folderNotes = useStore((state) => state.folderNotes);
  const isHomeLoading = useStore((state) => state.isHomeLoading);
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
    ? findEntryByPath(entries, currentFolder)?.children.some(e => e.is_dir)
    : entries.some(e => e.is_dir);
  
  const currentEntry = currentFolder ? findEntryByPath(entries, currentFolder) : null;
  const subFolders = currentFolder 
    ? (currentEntry?.children.filter(e => e.is_dir) || [])
    : entries.filter(e => e.is_dir);

  const hasData = hasNotes || hasFolders;

  if (isHomeLoading && !hasData) {
    return (
      <div className="flex-1 overflow-auto px-4 py-10 max-w-6xl mx-auto w-full">
        <section className="mb-10">
          <Skeleton className="h-3 w-16 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <NoteCardSkeleton key={i} />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="flex-1 overflow-auto w-full"
    >
      <div className="px-4 py-10 max-w-6xl mx-auto w-full h-full flex flex-col">
        {currentFolder && <Breadcrumbs className="mb-6" />}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {currentEntry ? currentEntry.name : "Home"}
            </h1>
            {currentEntry && (
               <p className="text-sm text-muted-foreground mt-1">
                  {currentEntry.children.length} item{currentEntry.children.length !== 1 ? 's' : ''}
               </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreateFolder(currentFolder || undefined)}
              className="shadow-sm active:scale-95 font-semibold"
            >
              <FolderPlus className="mr-2 h-4 w-4" strokeWidth={2} />
              New folder
            </Button>
            <Button
              size="sm"
              onClick={() => createNote(currentFolder || undefined)}
              className="shadow-md active:scale-95 font-semibold"
            >
              <PlusIcon className="mr-2 h-4 w-4" strokeWidth={3} />
              New note
            </Button>
          </div>
        </div>

        <div className="space-y-12">
          {/* Folders section */}
          {subFolders.length > 0 && (
            <section>
              <SectionHeader label="Folders" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {subFolders.map((folder) => (
                  <FolderCard key={folder.path} folder={folder} />
                ))}
              </div>
            </section>
          )}

          {/* Notes section */}
          {hasNotes && (
            <section>
              <SectionHeader label="Notes" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...folderNotes]
                  .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                  .map((card) => (
                    <NoteCard key={card.path} card={card} />
                ))}
              </div>
            </section>
          )}

          {/* Empty state */}
          {!hasData && (
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center max-w-md mx-auto py-12">
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {currentFolder ? "This folder is empty" : "Your vault is ready"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {currentFolder 
                    ? "Start by creating a note or a subfolder here."
                    : "Capture your thoughts, plan projects, or just babble. Everything is stored locally."}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => createNote(currentFolder || undefined)}
                  className="shadow-md active:scale-95 font-semibold"
                >
                  <PlusIcon className="mr-2 h-4 w-4" strokeWidth={3} />
                  Create note
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openCreateFolder(currentFolder || undefined)}
                  className="shadow-sm active:scale-95 font-semibold"
                >
                  <FolderPlus className="mr-2 h-4 w-4" strokeWidth={2} />
                  New folder
                </Button>
              </div>
              
              {!currentFolder && (
                <div className="pt-4 grid grid-cols-2 gap-4 w-full">
                   <div className="p-4 rounded-xl border border-border bg-card/50 space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground uppercase">Organize</div>
                      <p className="text-xs text-muted-foreground/80">Use folders and #tags to keep things tidy.</p>
                   </div>
                   <div className="p-4 rounded-xl border border-border bg-card/50 space-y-1">
                      <div className="text-xs font-semibold text-muted-foreground uppercase">Search</div>
                      <p className="text-xs text-muted-foreground/80">Ctrl + P to find anything instantly.</p>
                   </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function findEntryByPath(entries: VaultEntry[], path: string): VaultEntry | null {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    if (entry.children && entry.children.length > 0) {
      const found = findEntryByPath(entry.children, path);
      if (found) return found;
    }
  }
  return null;
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
      {label}
    </h2>
  );
}
