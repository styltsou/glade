import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FolderNode } from "../types";

interface FolderTreeProps {
  nodes: FolderNode[];
  depth?: number;
}

export function FolderTree({ nodes, depth = 0 }: FolderTreeProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <div key={node.path}>
          <div
            className={cn(
              "flex items-center gap-1.5 py-1 px-2 rounded text-sm min-w-0",
              node.isDir && "hover:bg-muted cursor-pointer",
              depth > 0 && "ml-4",
            )}
          >
            {node.isDir ? (
              <>
                <button
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [node.path]: !prev[node.path],
                    }))
                  }
                  className="p-0.5 hover:bg-muted-foreground/20 rounded shrink-0"
                >
                  {expanded[node.path] ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate">{node.name}</span>
                <span className="text-muted-foreground text-xs shrink-0">
                  ({node.fileCount} {node.fileCount === 1 ? "note" : "notes"})
                </span>
              </>
            ) : (
              <>
                <span className="w-4 shrink-0" />
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate min-w-0">{node.name}</span>
              </>
            )}
          </div>
          {node.isDir && expanded[node.path] && node.children.length > 0 && (
            <FolderTree nodes={node.children} depth={depth + 1} />
          )}
        </div>
      ))}
    </div>
  );
}
