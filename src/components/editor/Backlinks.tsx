import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useStore } from "@/store";
import { usePanePath } from "./PaneContext";

interface Backlink {
  path: string;
  title: string;
}

/** Collapsed "Referenced in N" row (shown under the properties) listing notes in the open folder that link to this one. */
export function Backlinks() {
  const path = usePanePath() ?? undefined;
  const inFolder = useStore((s) => s.target?.kind === "folder");
  const selectNote = useStore((s) => s.selectNote);
  const [items, setItems] = useState<Backlink[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!path || !inFolder) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      invoke<Backlink[]>("get_backlinks", { path })
        .then((r) => !cancelled && setItems(r))
        .catch(() => !cancelled && setItems([]));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [path, inFolder]);

  if (items.length === 0) return null;

  // Titles can repeat across folders; show the folder only to tell them apart.
  const titleCount = new Map<string, number>();
  for (const b of items) titleCount.set(b.title, (titleCount.get(b.title) ?? 0) + 1);
  const folderOf = (p: string) => p.split("/").slice(0, -1).join("/");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger className="group flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />
        <span>Referenced in {items.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-1.5 ml-[7px] space-y-0.5 border-l border-border pl-3">
          {items.map((b) => (
            <li key={b.path} className="flex items-baseline gap-2">
              <button
                onClick={() => selectNote(b.path)}
                className="cursor-pointer truncate text-sm text-foreground/80 transition-colors hover:text-foreground"
              >
                {b.title}
              </button>
              {(titleCount.get(b.title) ?? 0) > 1 && folderOf(b.path) && (
                <span className="truncate text-xs text-muted-foreground">{folderOf(b.path)}</span>
              )}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
