import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, FileText, ArrowLeft } from "lucide-react";
import { bindingFor, formatShortcut, isEditableTarget } from "@/lib/keybindings";
import { useStore } from "@/store";
import { filterHome, flattenHome } from "@/lib/fuzzy";
import { HomeSection } from "@/components/HomeList";
import type { HomeData, HomeEntry } from "@/types";

const EMPTY: HomeData = { pinned_folders: [], recent_folders: [], recent_files: [] };

/** Filter box + grouped lists. Shared by the Home screen and the quick switcher. */
export function useHomeList(active: boolean, afterOpen?: () => void, highlightFirst = true) {
  const home = useStore((s) => s.home) ?? EMPTY;
  const openPath = useStore((s) => s.openPath);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  // While the pointer drives the list, hover styling comes from CSS alone, so it
  // clears when the pointer leaves; only keyboard navigation draws a "selected" row.
  const [pointer, setPointer] = useState(!highlightFirst);

  const filtered = useMemo(() => filterHome(home, query), [home, query]);
  const flat = useMemo(() => flattenHome(filtered), [filtered]);

  useEffect(() => {
    setIndex(0);
    setPointer(!highlightFirst);
  }, [query, highlightFirst]);
  useEffect(() => {
    if (active) setQuery("");
  }, [active]);

  const open = (entry: HomeEntry) => {
    if (!entry.exists) return;
    afterOpen?.();
    openPath(entry.path);
  };

  const onKeyDown = (e: { key: string; preventDefault(): void }) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      // The first arrow press just shows where the keyboard is.
      if (pointer) {
        setPointer(false);
        return;
      }
      setIndex((i) => (e.key === "ArrowDown" ? Math.min(i + 1, flat.length - 1) : Math.max(i - 1, 0)));
    } else if (e.key === "Enter" && !pointer && flat[index]) {
      e.preventDefault();
      open(flat[index]);
    }
  };

  useEffect(() => {
    document.querySelector('[data-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [index, filtered]);

  const hover = (i: number) => {
    setIndex(i);
    setPointer(true);
  };

  return { query, setQuery, index, setIndex: hover, selected: pointer ? -1 : index, filtered, flat, open, onKeyDown };
}

export function HomeLists({ list }: { list: ReturnType<typeof useHomeList> }) {
  const { filtered, selected, setIndex, open, flat, query } = list;
  const pinnedN = filtered.pinned_folders.length;
  const foldersN = filtered.recent_folders.length;
  return (
    <>
      <HomeSection title="Pinned folders" group="pinned" entries={filtered.pinned_folders} offset={0} selectedIndex={selected} onOpen={open} onHover={setIndex} />
      <HomeSection title="Recent folders" group="folders" entries={filtered.recent_folders} offset={pinnedN} selectedIndex={selected} onOpen={open} onHover={setIndex} />
      <HomeSection title="Recent files" group="files" entries={filtered.recent_files} offset={pinnedN + foldersN} selectedIndex={selected} onOpen={open} onHover={setIndex} />
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
  const list = useHomeList(true, undefined, false);

  // No filter box: the lists are short. Arrow keys and Enter still work
  // anywhere on Home, unless something else (a dialog, an input) has the keyboard.
  const onKeyDownRef = useRef(list.onKeyDown);
  onKeyDownRef.current = list.onKeyDown;
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isEditableTarget(e)) return;
      if (document.querySelector('[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]')) return;
      onKeyDownRef.current(e);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [homeOpen]);

  const empty =
    !home || (home.pinned_folders.length + home.recent_folders.length + home.recent_files.length === 0);

  return (
    <div className="flex flex-1 justify-center overflow-y-auto px-6 pt-[10vh] pb-12">
      <div className="w-full max-w-xl">
        {target && (
          <button
            onClick={hideHome}
            className="press mb-5 flex items-center gap-1 rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Back to {target.path.split("/").pop()}
          </button>
        )}

        <div className="mb-8">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground">Glade</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open a folder or a file, or pick up where you left off.</p>
        </div>

        {empty ? (
          <p className="mb-8 px-1 text-sm text-muted-foreground">
            Nothing here yet. Folders and files you open will be listed here.
          </p>
        ) : (
          <div>
            <HomeLists list={list} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={pickFolder}
            className="press flex items-center gap-3 rounded-lg border border-border/70 bg-card/50 px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-card hover:border-foreground/15"
          >
            <FolderOpen className="size-4 text-muted-foreground" />
            <span className="flex-1">Open folder</span>
            <kbd className="text-xs text-muted-foreground">{formatShortcut(bindingFor("open-folder")!)}</kbd>
          </button>
          <button
            onClick={pickFile}
            className="press flex items-center gap-3 rounded-lg border border-border/70 bg-card/50 px-3.5 py-3 text-left text-sm font-medium transition-colors hover:bg-card hover:border-foreground/15"
          >
            <FileText className="size-4 text-muted-foreground" />
            <span className="flex-1">Open file</span>
            <kbd className="text-xs text-muted-foreground">{formatShortcut(bindingFor("open-file")!)}</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
