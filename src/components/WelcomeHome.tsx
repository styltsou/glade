import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, FileText, ArrowLeft } from "lucide-react";
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
    <div className="flex flex-1 justify-center overflow-y-auto px-6 py-12" onKeyDown={list.onKeyDown}>
      <div className="w-full max-w-2xl">
        {target && (
          <button
            onClick={hideHome}
            className="mb-4 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Back to {target.path.split("/").pop()}
          </button>
        )}
        <input
          ref={inputRef}
          autoFocus
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          placeholder="Filter folders and files…"
          className="mb-6 h-10 w-full rounded-md border border-border bg-transparent px-3 text-sm outline-none focus:border-ring"
        />

        {empty ? (
          <p className="mb-6 px-3 text-sm text-muted-foreground">
            Open a folder or a markdown file to get started. Folders you open will be listed here.
          </p>
        ) : (
          <HomeLists list={list} />
        )}

        <div className="flex flex-col gap-1 border-t border-border pt-4">
          <button onClick={pickFolder} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent/60">
            <FolderOpen className="size-4 text-muted-foreground" /> Open folder…
            <kbd className="ml-auto text-xs text-muted-foreground">{MOD}⇧O</kbd>
          </button>
          <button onClick={pickFile} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent/60">
            <FileText className="size-4 text-muted-foreground" /> Open file…
            <kbd className="ml-auto text-xs text-muted-foreground">{MOD}⌥O</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
