import { useEffect } from "react";
import {
  PlusIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { useVaultStore } from "@/stores/useVaultStore";
import type { VaultEntry } from "@/types";

export function Sidebar() {
  const {
    entries,
    activeNote,
    isLoading,
    loadVault,
    selectNote,
    createNote,
    tags,
    loadTags,
    activeTagFilters,
    toggleTagFilter,
    clearTagFilters,
  } = useVaultStore();

  useEffect(() => {
    loadVault();
    loadTags();
  }, [loadVault, loadTags]);

  // Flatten notes
  const allNotes = flattenNotes(entries);

  return (
    <aside className="sidebar flex flex-col w-[260px] h-full bg-sidebar select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-foreground">Notes</span>
          <span className="text-[11px] text-muted-foreground/50 tabular-nums">
            {allNotes.length}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-sidebar-accent transition-all">
            <MagnifyingGlassIcon className="h-3.5 w-3.5" />
          </button>
          <button
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-sidebar-accent transition-all"
            onClick={() => createNote()}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-auto px-2 py-1">
        {isLoading ? (
          <div className="px-2.5 py-4 text-[12px] text-muted-foreground/40 text-center">
            Loading…
          </div>
        ) : allNotes.length === 0 ? (
          <div className="px-2.5 py-8 text-center">
            <p className="text-[12px] text-muted-foreground/40 mb-2">No notes yet</p>
            <button
              onClick={() => createNote()}
              className="text-[12px] text-muted-foreground/60 hover:text-foreground transition-colors"
            >
              Create your first note
            </button>
          </div>
        ) : (
          <div className="space-y-px">
            {allNotes.map((note) => (
              <NoteItem
                key={note.path}
                name={note.name}
                path={note.path}
                modified={note.modified}
                active={activeNote?.path === note.path}
                onClick={() => selectNote(note.path)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tags Panel */}
      <div className="shrink-0 overflow-auto border-t border-border px-2 py-2">
        <div className="flex items-center justify-between px-2 pb-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-widest">
            Tags
          </span>
          {activeTagFilters.length > 0 && (
            <button
              onClick={clearTagFilters}
              className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <div className="space-y-px">
          {tags.length === 0 ? (
            <div className="px-2.5 py-1 text-[12px] text-muted-foreground/30 italic">
              No tags yet
            </div>
          ) : (
            tags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => toggleTagFilter(tag.name)}
                className={`group flex items-center justify-between w-full rounded-md px-2.5 py-[5px] text-[13px] transition-all cursor-default ${
                  activeTagFilters.includes(tag.name)
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-sidebar-accent"
                }`}
              >
                <span className="truncate">
                  <span className="text-muted-foreground/30 mr-0.5">#</span>
                  {tag.name}
                </span>
                <span className="text-[11px] text-muted-foreground/30 tabular-nums group-hover:text-muted-foreground/50 transition-colors">
                  {tag.count}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}

function NoteItem({
  name,
  path,
  modified,
  active,
  onClick,
}: {
  name: string;
  path: string;
  modified: string | null;
  active?: boolean;
  onClick: () => void;
}) {
  const timeLabel = modified ? formatRelativeTime(modified) : "";
  // Use the folder path if the note is nested
  const folder = path.includes("/")
    ? path.split("/").slice(0, -1).join("/")
    : null;

  return (
    <button
      onClick={onClick}
      className={`group flex flex-col gap-0.5 w-full rounded-lg px-2.5 py-2 text-left transition-all cursor-default ${
        active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2 w-full">
        <span
          className={`text-[13px] truncate ${
            active
              ? "font-semibold text-foreground"
              : "font-medium text-foreground/90"
          }`}
        >
          {name}
        </span>
        <span className="text-[11px] text-muted-foreground/40 shrink-0 tabular-nums">
          {timeLabel}
        </span>
      </div>
      {folder && (
        <span className="text-[11px] text-muted-foreground/30 truncate w-full leading-snug">
          {folder}
        </span>
      )}
    </button>
  );
}

/** Recursively flatten vault entries to get all .md note files. */
function flattenNotes(entries: VaultEntry[]): VaultEntry[] {
  const notes: VaultEntry[] = [];
  for (const entry of entries) {
    if (entry.is_dir) {
      notes.push(...flattenNotes(entry.children));
    } else {
      notes.push(entry);
    }
  }
  // Sort by modified date (newest first)
  notes.sort((a, b) => {
    if (!a.modified || !b.modified) return 0;
    return new Date(b.modified).getTime() - new Date(a.modified).getTime();
  });
  return notes;
}

/** Format an ISO date string as a relative time label. */
function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
