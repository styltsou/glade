import { useStore } from "@/store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React, { useLayoutEffect, useRef } from "react";
import { HoverCard } from "radix-ui";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { baseName, dirName, shortenPath } from "@/lib/paths";
import { isAbsolutePath } from "@/lib/links";
import { usePanePath } from "@/components/editor/PaneContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowLeft, Ellipsis, Folder } from "lucide-react";

interface BreadcrumbsProps {
  path?: string | null;
  activeItem?: string;
  className?: string;
}

/** Breadcrumb for a single opened file: its real path, plus ways to open around it. */
function LooseFileCrumb({ filePath, className }: { filePath: string; className?: string }) {
  const openPath = useStore((state) => state.openPath);
  const home = useStore((state) => state.homeDir);
  const canGoBack = useStore((state) => state.backStack.length > 0);
  const goBack = useStore((state) => state.goBack);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const dir = dirName(filePath);

  useEffect(() => {
    invoke<string | null>("repo_root_of", { path: filePath })
      .then(setRepoRoot)
      .catch(() => setRepoRoot(null));
  }, [filePath]);

  return (
    <div className={cn("flex items-center gap-3 select-none overflow-hidden text-[14px]", className)}>
      {canGoBack && (
        <button className="shrink-0 text-muted-foreground hover:text-foreground" onClick={goBack} title="Back (Alt+Left)">
          <ArrowLeft className="size-4" />
        </button>
      )}
      <span className="truncate text-muted-foreground" title={filePath}>
        {shortenPath(dir, home)}/<span className="font-semibold text-foreground">{baseName(filePath)}</span>
      </span>
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

export function Breadcrumbs({ path, activeItem, className }: BreadcrumbsProps) {
  const currentFolder = useStore((state) => state.currentFolder);
  const navigateToFolder = useStore((state) => state.navigateToFolder);
  const rootName = useStore((state) => (state.target ? baseName(state.target.path) : "Folder"));

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
    ...(activeItem ? [{ key: "active", label: activeItem, folderPath: undefined }] : []),
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
    // The tooltip always shows the full name, truncated or not.
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {isLast ? (
            <BreadcrumbPage className="max-w-[480px] truncate font-semibold text-foreground">{content}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink
              onClick={() => onNavigate(item.folderPath ?? null)}
              className="flex max-w-[160px] cursor-pointer items-center truncate text-muted-foreground transition-colors hover:text-foreground"
            >
              {content}
            </BreadcrumbLink>
          )}
        </TooltipTrigger>
        <TooltipContent side="bottom">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div ref={outerRef} className={cn("flex min-w-0 select-none items-center overflow-hidden", className)}>
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap text-[14px]">
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
                      className="press flex h-5 items-center rounded-md px-1 text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
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
                          <span className="truncate" title={c.label}>{c.label}</span>
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
