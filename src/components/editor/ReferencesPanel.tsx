import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { X } from "lucide-react";
import { useStore } from "@/store";
import { MarqueeText } from "@/components/ui/marquee-text";
import { usePanelResize } from "@/hooks/usePanelResize";
import { PanelResizeHandle, PANEL_CARD } from "./PanelResizeHandle";

/** Space around the floating card, as for the table of contents; the drawer is this much wider than its card. */
export const REFERENCES_GUTTER = 12;

interface NoteRef {
  path: string;
  title: string;
}

/** The notes a command returns for `path`: none until it answers, or when it can't. */
function useNotes(command: string, path: string | undefined, version: unknown): NoteRef[] {
  const inFolder = useStore((s) => s.target?.kind === "folder");
  const [notes, setNotes] = useState<NoteRef[]>([]);

  useEffect(() => {
    if (!inFolder || !path) {
      setNotes([]);
      return;
    }
    let cancelled = false;
    // Saves come in bursts while typing; ask once they settle.
    const timer = setTimeout(() => {
      invoke<NoteRef[]>(command, { path })
        .then((r) => !cancelled && setNotes(r))
        .catch(() => !cancelled && setNotes([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [command, path, inFolder, version]);

  return notes;
}

export interface NoteLinks {
  /** Notes that link to this one. */
  referencedIn: NoteRef[];
  /** Notes this one links to. */
  linksTo: NoteRef[];
}

/** The note's links both ways, asked again when `version` (its last save) changes. */
export function useNoteLinks(path: string | undefined, version: unknown): NoteLinks {
  const referencedIn = useNotes("get_backlinks", path, version);
  const linksTo = useNotes("get_outgoing_links", path, version);
  return { referencedIn, linksTo };
}

const folderOf = (p: string) => p.split("/").slice(0, -1).join("/");

function NoteList({ notes }: { notes: NoteRef[] }) {
  const selectNote = useStore((s) => s.selectNote);

  // Titles can repeat across folders; show the folder only to tell them apart.
  const titleCount = new Map<string, number>();
  for (const n of notes) titleCount.set(n.title, (titleCount.get(n.title) ?? 0) + 1);

  return (
    <ul className="space-y-px">
      {notes.map((n) => {
        const folder = (titleCount.get(n.title) ?? 0) > 1 ? folderOf(n.path) : "";
        return (
          <li key={n.path}>
            <button
              type="button"
              onClick={() => selectNote(n.path)}
              className="flex w-full min-w-0 cursor-pointer items-center rounded-lg px-2.5 py-[7px] text-left text-sm tracking-[-0.005em] text-sidebar-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.09]"
            >
              {/* The folder scrolls with the title: a cut-off name fades, and slides into view on hover. */}
              <MarqueeText>
                {n.title}
                {folder && <span className="ml-2 text-xs text-muted-foreground">{folder}</span>}
              </MarqueeText>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="mb-3">
      <h3 className="flex items-baseline gap-1.5 px-2.5 pb-1 pt-1.5 text-xs font-medium text-muted-foreground">
        {title}
        <span className="tabular-nums text-muted-foreground/70">{count}</span>
      </h3>
      {children}
    </section>
  );
}

/**
 * A card beside the note with the notes that link to it and the notes it links
 * to, one click from each. Looks like the table of contents card. Only shown
 * while there is something to list.
 */
export function ReferencesPanel({ links: { referencedIn, linksTo }, onClose }: { links: NoteLinks; onClose: () => void }) {
  const width = useStore((s) => s.referencesWidth);
  const setWidth = useStore((s) => s.setReferencesWidth);
  const panelRef = useRef<HTMLDivElement>(null);
  const { isResizing, onPointerDown } = usePanelResize(width, setWidth, panelRef, REFERENCES_GUTTER);

  return (
    <div ref={panelRef} className="relative h-full shrink-0 select-none py-2 pr-2 pl-1" style={{ width: width + REFERENCES_GUTTER }}>
      <PanelResizeHandle dragging={isResizing} onPointerDown={onPointerDown} />
      <div className={`flex h-full flex-col overflow-hidden rounded-xl border bg-sidebar shadow-sm ${PANEL_CARD}`}>
        <div className="flex h-9 shrink-0 items-center justify-between pl-4 pr-2">
          <span className="truncate text-[13px] font-medium tracking-[-0.005em] text-muted-foreground">Links</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close links"
            className="press flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-2 overlay-scroll">
          {/* A list with nothing in it isn't shown. */}
          {referencedIn.length > 0 && (
            <Section title="Referenced in" count={referencedIn.length}>
              <NoteList notes={referencedIn} />
            </Section>
          )}
          {linksTo.length > 0 && (
            <Section title="Links to" count={linksTo.length}>
              <NoteList notes={linksTo} />
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
