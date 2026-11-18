import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, FileText, ArrowLeft, Search } from "lucide-react";
import { useStore } from "@/store";
import { filterHome, flattenHome } from "@/lib/fuzzy";
import { HomeSection } from "@/components/HomeList";
import type { HomeData, HomeEntry } from "@/types";

const EMPTY: HomeData = { pinned_folders: [], recent_folders: [], recent_files: [] };
const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

/** Filter box + grouped lists. Shared by the Home screen and the quick switcher. */
export function useHomeList(active: boolean, afterOpen?: () => void) {
  const home = useStore((s) => s.home) ?? EMPTY;
  const openPath = useStore((s) => s.openPath);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const filtered = useMemo(() => filterHome(home, query), [home, query]);
  const flat = useMemo(() => flattenHome(filtered), [filtered]);

  useEffect(() => setIndex(0), [query]);
  useEffect(() => {
    if (active) setQuery("");
  }, [active]);

  const open = (entry: HomeEntry) => {
    if (!entry.exists) return;
    afterOpen?.();
    openPath(entry.path);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && flat[index]) {
      e.preventDefault();
      open(flat[index]);
    }
  };

  useEffect(() => {
    document.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index, filtered]);

  return { query, setQuery, index, setIndex, filtered, flat, open, onKeyDown };
}

export function HomeLists({ list }: { list: ReturnType<typeof useHomeList> }) {
  const { filtered, index, setIndex, open, flat, query } = list;
  const pinnedN = filtered.pinned_folders.length;
  const foldersN = filtered.recent_folders.length;
  return (
    <>
      <HomeSection title="Pinned folders" group="pinned" entries={filtered.pinned_folders} offset={0} selectedIndex={index} onOpen={open} onHover={setIndex} />
      <HomeSection title="Recent folders" group="folders" entries={filtered.recent_folders} offset={pinnedN} selectedIndex={index} onOpen={open} onHover={setIndex} />
      <HomeSection title="Recent files" group="files" entries={filtered.recent_files} offset={pinnedN + foldersN} selectedIndex={index} onOpen={open} onHover={setIndex} />
      {flat.length === 0 && query && (
        <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nothing matches “{query}”.</p>
      )}
    </>
  );
}

export function WelcomeHome() {
  const target = useStore((s) => s.target);
  const homeOpen = useStore((s) => s.homeOpen);
  const hideHome = useStore((s) => s.hideHome);
  const pickFolder = useStore((s) => s.pickFolder);
  const pickFile = useStore((s) => s.pickFile);
  const home = useStore((s) => s.home);
  const list = useHomeList(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [homeOpen]);

  const empty =
    !home || (home.pinned_folders.length + home.recent_folders.length + home.recent_files.length === 0);

  return (
    <div className="flex flex-1 justify-center overflow-y-auto px-6 pt-[10vh] pb-12" onKeyDown={list.onKeyDown}>
      <div className="w-full max-w-xl">
        {target && (
          <button
            onClick={hideHome}
            className="press mb-5 flex items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Back to {target.path.split("/").pop()}
          </button>
        )}

        <div className="rise mb-7">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground">Glade</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open a folder or a file, or pick up where you left off.</p>
        </div>

        <div className="rise relative mb-8" style={{ "--i": 1 } as React.CSSProperties}>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            autoFocus
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            placeholder="Filter folders and files…"
            className="h-11 w-full rounded-xl border border-border/80 bg-card/60 pl-10 pr-4 text-sm shadow-xs outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-ring/60 focus:ring-2 focus:ring-ring/20"
          />
        </div>

        {empty ? (
          <p className="rise mb-8 px-1 text-sm text-muted-foreground" style={{ "--i": 2 } as React.CSSProperties}>
            Nothing here yet. Folders and files you open will be listed here.
          </p>
        ) : (
          <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
            <HomeLists list={list} />
          </div>
        )}

        <div className="rise grid grid-cols-2 gap-2 pt-2" style={{ "--i": 3 } as React.CSSProperties}>
          <button
            onClick={pickFolder}
            className="press flex items-center gap-3 rounded-xl border border-border/70 bg-card/50 px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-card hover:border-foreground/15"
          >
            <FolderOpen className="size-4 text-muted-foreground" />
            <span className="flex-1">Open folder</span>
            <kbd className="text-[11px] text-muted-foreground">{MOD}⇧O</kbd>
          </button>
          <button
            onClick={pickFile}
            className="press flex items-center gap-3 rounded-xl border border-border/70 bg-card/50 px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-card hover:border-foreground/15"
          >
            <FileText className="size-4 text-muted-foreground" />
            <span className="flex-1">Open file</span>
            <kbd className="text-[11px] text-muted-foreground">{MOD}⌥O</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
