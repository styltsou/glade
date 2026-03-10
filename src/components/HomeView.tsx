import { useEffect, useRef } from "react";
import { useStore } from "@/store";
import { NoteCard } from "@/components/NoteCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { NoteCard as NoteCardType } from "@/types";

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
  const pinnedNotes = useStore((state) => state.pinnedNotes);
  const recentNotes = useStore((state) => state.recentNotes);
  const isHomeLoading = useStore((state) => state.isHomeLoading);
  const loadAll = useStore((state) => state.loadAll);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reload home data whenever we come back to the home view
    loadAll();
  }, [loadAll]);

  const hasPinned = pinnedNotes.length > 0;
  const hasRecents = recentNotes.length > 0;
  const hasData = hasPinned || hasRecents;

  // Optimized loading: Only show skeleton if we are loading AND have no data yet.
  // This enables "stale-while-revalidate" feel.
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
      <div className="px-4 py-10 max-w-6xl mx-auto w-full">
        {/* Pinned section */}
        {hasPinned && (
          <section className="mb-10">
            <SectionHeader label="Pinned" />
            <div className="grid grid-cols-3 gap-4">
              {pinnedNotes.map((card: NoteCardType) => (
                <NoteCard key={card.path} card={card} showPin={false} />
              ))}
            </div>
          </section>
        )}

        {/* Recently Opened section */}
        {hasRecents && (
          <section className="mb-10">
            <SectionHeader label="Recently Opened" />
            <div className="grid grid-cols-3 gap-4">
              {recentNotes.map((card: NoteCardType) => (
                <NoteCard key={card.path} card={card} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!hasPinned && !hasRecents && (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              Your notes will appear here
            </p>
            <p className="text-xs text-muted-foreground">
              Open a note to add it to recents, or pin a note to keep it at the top.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
      {label}
    </h2>
  );
}
