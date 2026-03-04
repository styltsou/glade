import { useEffect } from "react";
import { useHomeStore } from "@/stores/useHomeStore";
import { useVaultStore } from "@/stores/useVaultStore";
import { NoteCard } from "@/components/NoteCard";

export function HomeView() {
  const { pinnedNotes, recentNotes, isLoading, loadAll } = useHomeStore();
  const { activeNote } = useVaultStore();

  useEffect(() => {
    // Reload home data whenever we come back to the home view
    if (!activeNote) {
      loadAll();
    }
  }, [activeNote, loadAll]);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-[13px]">
        Loading…
      </div>
    );
  }

  const hasPinned = pinnedNotes.length > 0;
  const hasRecents = recentNotes.length > 0;

  return (
    <div className="flex-1 overflow-auto px-8 py-10 max-w-5xl mx-auto w-full">
      {/* Pinned section */}
      {hasPinned && (
        <section className="mb-10">
          <SectionHeader label="Pinned" />
          <div className="grid grid-cols-3 gap-3">
            {pinnedNotes.map((card) => (
              <NoteCard key={card.path} card={card} showPin={false} />
            ))}
          </div>
        </section>
      )}

      {/* Recently Opened section */}
      {hasRecents && (
        <section className="mb-10">
          <SectionHeader label="Recently Opened" />
          <div className="grid grid-cols-3 gap-3">
            {recentNotes.map((card) => (
              <NoteCard key={card.path} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {!hasPinned && !hasRecents && (
        <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
          <p className="text-[14px] font-medium text-muted-foreground">
            Your notes will appear here
          </p>
          <p className="text-[12px] text-muted-foreground">
            Open a note to add it to recents, or pin a note to keep it at the top.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
      {label}
    </h2>
  );
}
