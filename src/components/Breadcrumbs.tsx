import { useStore } from "@/store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React, { cloneElement, useLayoutEffect, useRef, type ReactElement, type ReactNode } from "react";
import { HoverCard } from "radix-ui";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { baseName, dirName, shortenPath } from "@/lib/paths";
import { isAbsolutePath } from "@/lib/links";
import { usePanePath } from "@/components/editor/PaneContext";
import { Tip, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { bindingFor, formatShortcut } from "@/lib/keybindings";
import { ChevronDown, ClipboardCopy, Copy, Ellipsis, Folder, FolderSearch, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { copyPath, revealInFileManager } from "@/lib/fileActions";
import { useNoteLabel } from "@/lib/noteLabel";
import { findEntryByPath } from "@/components/sidebar/file-tree-helpers";

interface BreadcrumbsProps {
  path?: string | null;
  /** The note this trail ends in, named as the "show notes by" setting says. */
  file?: string;
  className?: string;
}

const CRUMB =
  "flex h-7 cursor-pointer items-center rounded-lg px-2 outline-none transition-colors";
const FOLDER_CRUMB = "text-muted-foreground hover:text-foreground focus-visible:text-foreground";

/** What the pointer or focus is on is measured before the tooltip may open, so it shows only for text that is cut off. */
function measureTruncation(element: HTMLElement): boolean {
  const text = element.querySelector<HTMLElement>("[data-truncate]") ?? element;
  return text.scrollWidth > text.clientWidth + 1;
}

/**
 * A tooltip with the full name, for text that is cut off. Where all of it shows,
 * there is nothing more to say, so none opens (`always`: the text is not shown at all).
 */
function TruncatedTip({ label, always, children }: { label: ReactNode; always?: boolean; children: ReactElement }) {
  const worth = useRef(!!always);
  const [open, setOpen] = useState(false);
  const measure = (e: { currentTarget: HTMLElement }) => {
    worth.current = !!always || measureTruncation(e.currentTarget);
  };
  return (
    <Tooltip open={open} onOpenChange={(next) => setOpen(next && worth.current)}>
      <TooltipTrigger asChild>{cloneElement(children, { onPointerEnter: measure, onFocus: measure })}</TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The note's actions, from its name in the trail, as in a chat's title menu.
 * A single opened file has no folder around it to pin, copy or delete it in.
 */
function NoteMenu({ file, label, loose }: { file: string; label: string; loose?: boolean }) {
  const openRename = useStore((state) => state.openRename);
  const openDelete = useStore((state) => state.openDelete);
  const duplicateNote = useStore((state) => state.duplicateNote);
  const pinNote = useStore((state) => state.pinNote);
  const unpinNote = useStore((state) => state.unpinNote);
  const pinned = useStore((state) => state.pinnedNotePaths.includes(file));
  // Set when an item is chosen: focus then goes where the action takes it (the rename
  // dialog, the note), not back to the crumb, which made the two fight over it.
  const chose = useRef(false);

  return (
    <DropdownMenu>
      <TruncatedTip label={label}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-current={loose ? undefined : "page"}
            // Open from aria-expanded: the tooltip shares this element and writes its own data-state over the menu's.
            className={cn(CRUMB, "group/crumb max-w-[480px] gap-1 font-semibold text-foreground hover:bg-foreground/[0.07] focus-visible:bg-foreground/[0.07] aria-expanded:bg-foreground/[0.11]")}
          >
            <span data-truncate className="min-w-0 truncate">{label}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground transition-[color,rotate] duration-100 ease-[var(--ease-ui)] group-hover/crumb:text-foreground group-aria-expanded/crumb:rotate-180 group-aria-expanded/crumb:text-foreground" />
          </button>
        </DropdownMenuTrigger>
      </TruncatedTip>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-52"
        onClick={() => (chose.current = true)}
        onCloseAutoFocus={(event) => {
          if (!chose.current) return;
          chose.current = false;
          event.preventDefault();
        }}
      >
        {!loose && (
          <>
            {pinned ? (
              <DropdownMenuItem onSelect={() => unpinNote(file)}>
                <PinOff /> Unpin note
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onSelect={() => pinNote(file)}>
                <Pin /> Pin note
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => openRename(file)}>
          <Pencil /> Rename file
          <DropdownMenuShortcut>{formatShortcut(bindingFor("rename-file")!)}</DropdownMenuShortcut>
        </DropdownMenuItem>
        {!loose && (
          <DropdownMenuItem onSelect={() => duplicateNote(file)}>
            <Copy /> Duplicate
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => revealInFileManager(file)}>
          <FolderSearch /> Reveal in file manager
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void copyPath(file)}>
          <ClipboardCopy /> Copy path
        </DropdownMenuItem>
        {!loose && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => openDelete(file, label)}>
              <Trash2 /> Delete note
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Breadcrumb for a single opened file: its real path, plus ways to open around it. */
function LooseFileCrumb({ filePath, className }: { filePath: string; className?: string }) {
  const openPath = useStore((state) => state.openPath);
  const home = useStore((state) => state.homeDir);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const dir = dirName(filePath);

  useEffect(() => {
    invoke<string | null>("repo_root_of", { path: filePath })
      .then(setRepoRoot)
      .catch(() => setRepoRoot(null));
  }, [filePath]);

  return (
    <div className={cn("flex items-center gap-3 select-none overflow-hidden text-[14px]", className)}>
      <Tip label={filePath}><span className="truncate text-muted-foreground">
        {shortenPath(dir, home)}/
        <NoteMenu file={filePath} label={baseName(filePath)} loose />
      </span></Tip>
      <button className="shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => openPath(dir)}>
        Open containing folder
      </button>
      {repoRoot && repoRoot !== dir && (
        <button className="shrink-0 text-xs text-muted-foreground hover:text-foreground" onClick={() => openPath(repoRoot)}>
          Open repository root
        </button>
      )}
    </div>
  );
}

export function Breadcrumbs({ path, file, className }: BreadcrumbsProps) {
  const currentFolder = useStore((state) => state.currentFolder);
  const navigateToFolder = useStore((state) => state.navigateToFolder);
  const rootName = useStore((state) => (state.target ? baseName(state.target.path) : "Folder"));
  const labelOf = useNoteLabel();
  const fileTitle = useStore((state) =>
    file ? state.noteCache[file]?.title || findEntryByPath(state.entries, file)?.name : undefined,
  );

  const panePath = usePanePath();
  const looseFile = useStore((state) => {
    if (state.target?.kind === "file") return panePath ?? state.target.path;
    // A note reached through a link to a file outside the open folder.
    return panePath && isAbsolutePath(panePath) ? panePath : null;
  });
  if (looseFile) return <LooseFileCrumb filePath={looseFile} className={className} />;

  const targetPath = path !== undefined ? path : currentFolder;
  const segments = targetPath ? targetPath.split("/") : [];

  // Everything between the root and the last item can collapse.
  const items: Crumb[] = [
    { key: "root", label: rootName, folderPath: null },
    ...segments.map((folder, i) => ({ key: segments.slice(0, i + 1).join("/"), label: folder, folderPath: segments.slice(0, i + 1).join("/") })),
    ...(file ? [{ key: "active", label: labelOf(file, fileTitle), folderPath: undefined, file }] : []),
  ];

  return (
    <CollapsingCrumbs
      items={items}
      className={className}
      onNavigate={(folderPath) => navigateToFolder(folderPath)}
    />
  );
}

interface Crumb {
  key: string;
  label: string;
  /** Folder to open when clicked; `undefined` = the current (non-link) item. */
  folderPath: string | null | undefined;
  /** The note this item is: clicking it opens the note's actions. */
  file?: string;
}

/**
 * Breadcrumbs that fold their middle segments into "…" when they stop fitting.
 * The folded segments appear in a hover card at the "…".
 */
function CollapsingCrumbs({
  items,
  className,
  onNavigate,
}: {
  items: Crumb[];
  className?: string;
  onNavigate: (folderPath: string | null) => void;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(0);
  const maxHidden = Math.max(0, items.length - 2);
  const itemsKey = items.map((i) => i.key + i.label).join("/");

  // Start from the full path whenever it, or the available width, changes...
  useLayoutEffect(() => {
    setHidden(0);
  }, [itemsKey]);
  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    let last = outer.clientWidth;
    const observer = new ResizeObserver(() => {
      if (outer.clientWidth !== last) {
        last = outer.clientWidth;
        setHidden(0);
      }
    });
    observer.observe(outer);
    return () => observer.disconnect();
  }, []);
  // ...then fold one more segment at a time until it fits (before paint).
  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (outer && outer.scrollWidth > outer.clientWidth + 1 && hidden < maxHidden) setHidden(hidden + 1);
  });

  const collapsed = items.slice(1, 1 + hidden);
  const visible = [items[0], ...items.slice(1 + hidden)];

  // The root folder is a folder icon, not its name: the name is already in the
  // window and the tab, and the icon keeps the trail short.
  const renderItem = (item: Crumb) => {
    const isRoot = item === items[0];
    const content = isRoot ? <Folder className="size-4" aria-label={item.label} /> : item.label;
    const isLast = item.folderPath === undefined || item === items[items.length - 1];
    if (item.file) return <NoteMenu file={item.file} label={item.label} />;
    // The text is what gets measured for being cut off; the root's icon is not text.
    const text = isRoot ? content : <span data-truncate className="block truncate">{content}</span>;
    return (
      // The root shows only an icon, so its name is always worth saying.
      <TruncatedTip label={item.label} always={isRoot}>
        {isLast ? (
          <BreadcrumbPage className="flex h-7 max-w-[480px] items-center px-2 font-semibold text-foreground">
            {text}
          </BreadcrumbPage>
        ) : (
          <BreadcrumbLink
            onClick={() => onNavigate(item.folderPath ?? null)}
            className={cn(CRUMB, FOLDER_CRUMB, "max-w-[160px]", isRoot && "press w-7 justify-center px-0")}
          >
            {text}
          </BreadcrumbLink>
        )}
      </TruncatedTip>
    );
  };

  return (
    <div ref={outerRef} className={cn("-ml-1.5 flex min-w-0 select-none items-center overflow-hidden", className)}>
      <Breadcrumb className="min-w-0">
        {/* The crumbs carry their own padding, so the gaps between them are small. */}
        <BreadcrumbList className="flex-nowrap gap-0.5 text-[14px] sm:gap-0.5">
          <BreadcrumbItem>{renderItem(visible[0])}</BreadcrumbItem>
          {hidden > 0 && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <HoverCard.Root openDelay={60} closeDelay={140}>
                  <HoverCard.Trigger asChild>
                    <button
                      type="button"
                      aria-label={`Show ${collapsed.length} hidden folders`}
                      className={cn(CRUMB, FOLDER_CRUMB, "press w-7 justify-center px-0 data-[state=open]:text-foreground")}
                    >
                      <Ellipsis className="size-4" />
                    </button>
                  </HoverCard.Trigger>
                  <HoverCard.Portal>
                    <HoverCard.Content
                      data-slot="popover-content"
                      side="bottom"
                      align="start"
                      sideOffset={6}
                      className="z-50 min-w-40 max-w-72 origin-[var(--radix-hover-card-content-transform-origin)] rounded-xl bg-popover p-1 text-popover-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
                    >
                      {collapsed.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={() => onNavigate(c.folderPath ?? null)}
                          className="flex w-full items-center rounded-lg px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        >
                          <span className="truncate">{c.label}</span>
                        </button>
                      ))}
                    </HoverCard.Content>
                  </HoverCard.Portal>
                </HoverCard.Root>
              </BreadcrumbItem>
            </>
          )}
          {visible.slice(1).map((item) => (
            <React.Fragment key={item.key}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>{renderItem(item)}</BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
