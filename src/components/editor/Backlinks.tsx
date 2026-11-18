import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Link2 } from "lucide-react";
import { useStore } from "@/store";
import { usePanePath } from "./PaneContext";

interface Backlink {
  path: string;
  title: string;
}

/** Notes in the open folder that link to the current note. */
export function Backlinks() {
  const path = usePanePath() ?? undefined;
  const inFolder = useStore((s) => s.target?.kind === "folder");
  const selectNote = useStore((s) => s.selectNote);
  const [items, setItems] = useState<Backlink[]>([]);

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
  return (
    <div className="mt-10 border-t border-border pt-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Link2 className="size-3.5" /> Linked from ({items.length})
      </h3>
      <ul className="space-y-1">
        {items.map((b) => (
          <li key={b.path}>
            <button onClick={() => selectNote(b.path)} className="text-sm text-primary hover:underline">
              {b.title}
            </button>
            <span className="ml-2 text-xs text-muted-foreground">{b.path}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
