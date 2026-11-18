import { useStore } from "@/store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import React from "react";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { baseName, dirName, shortenPath } from "@/lib/paths";
import { isAbsolutePath } from "@/lib/links";
import { usePanePath } from "@/components/editor/PaneContext";
import { ArrowLeft } from "lucide-react";

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
  
  return (
    <div className={cn("flex items-center select-none overflow-hidden", className)}>
      <Breadcrumb>
        <BreadcrumbList className="text-[14px] flex-nowrap">
          <BreadcrumbItem>
            {segments.length === 0 && !activeItem ? (
              <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[250px]">
                {rootName}
              </BreadcrumbPage>
            ) : (
              <BreadcrumbLink 
                onClick={() => navigateToFolder(null)} 
                className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                {rootName}
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
          
          {segments.map((folder, i) => {
            const folderPath = segments.slice(0, i + 1).join("/");
            const isLast = i === segments.length - 1;
            const isActive = isLast && !activeItem;

            return (
              <React.Fragment key={folderPath}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isActive ? (
                    <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[150px]">
                      {folder}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => navigateToFolder(folderPath)}
                      className="cursor-pointer truncate max-w-[150px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {folder}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            );
          })}
          
          {activeItem && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[250px]">
                  {activeItem}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
