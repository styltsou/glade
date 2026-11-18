import { Folder, FileText, Pin, PinOff, FolderSearch, X, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortenPath } from "@/lib/paths";
import type { HomeEntry } from "@/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";

export type HomeGroup = "pinned" | "folders" | "files";

interface RowProps {
  entry: HomeEntry;
  group: HomeGroup;
  selected: boolean;
  onOpen: (entry: HomeEntry) => void;
  onHover: () => void;
}

function Row({ entry, group, selected, onOpen, onHover }: RowProps) {
  const home = useStore((s) => s.homeDir);
  const pinFolder = useStore((s) => s.pinFolder);
  const unpinFolder = useStore((s) => s.unpinFolder);
  const removeFromGlade = useStore((s) => s.removeFromGlade);
  const locateFolder = useStore((s) => s.locateFolder);
  const isFolder = group !== "files";

  const reveal = () => {
    invoke("plugin:opener|reveal_item_in_dir", { paths: [entry.path] }).catch(() => {});
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          data-selected={selected}
          onClick={() => onOpen(entry)}
          onMouseMove={onHover}
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
            selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            !entry.exists && "opacity-50",
          )}
        >
          {isFolder ? (
            <Folder className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate text-sm font-medium">{entry.name}</span>
          <span className="ml-auto truncate pl-4 text-xs text-muted-foreground">
            {entry.exists ? shortenPath(entry.path, home) : "Missing — " + shortenPath(entry.path, home)}
          </span>
        </button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {entry.exists && (
          <ContextMenuItem onSelect={() => onOpen(entry)}>
            <FolderOpen className="size-4" /> Open
          </ContextMenuItem>
        )}
        {!entry.exists && isFolder && (
          <ContextMenuItem onSelect={() => locateFolder(entry.path)}>
            <FolderSearch className="size-4" /> Locate…
          </ContextMenuItem>
        )}
        {isFolder && group === "pinned" && (
          <ContextMenuItem onSelect={() => unpinFolder(entry.path)}>
            <PinOff className="size-4" /> Unpin
          </ContextMenuItem>
        )}
        {isFolder && group !== "pinned" && (
          <ContextMenuItem onSelect={() => pinFolder(entry.path)}>
            <Pin className="size-4" /> Pin
          </ContextMenuItem>
        )}
        {entry.exists && (
          <ContextMenuItem onSelect={reveal}>
            <FolderSearch className="size-4" /> Reveal in file manager
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => removeFromGlade(entry.path)}>
          <X className="size-4" /> Remove from Glade
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface SectionProps {
  title: string;
  group: HomeGroup;
  entries: HomeEntry[];
  /** Index of the first entry of this section in the flattened list. */
  offset: number;
  selectedIndex: number;
  onOpen: (entry: HomeEntry) => void;
  onHover: (index: number) => void;
}

export function HomeSection({ title, group, entries, offset, selectedIndex, onOpen, onHover }: SectionProps) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-5">
      <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      {entries.map((entry, i) => (
        <Row
          key={entry.path}
          entry={entry}
          group={group}
          selected={selectedIndex === offset + i}
          onOpen={onOpen}
          onHover={() => onHover(offset + i)}
        />
      ))}
    </section>
  );
}
