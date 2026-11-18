import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  kind: "modified" | "removed";
  onKeepMine: () => void;
  onLoadTheirs: () => void;
  onClose: () => void;
}

/** The open file was changed or removed by another program. */
export function ConflictBanner({ kind, onKeepMine, onLoadTheirs, onClose }: Props) {
  return (
    <div role="alert" className="flex shrink-0 items-center gap-3 border-b border-border bg-amber-500/10 px-4 py-2 text-sm">
      <TriangleAlert className="size-4 shrink-0 text-amber-600" />
      {kind === "modified" ? (
        <>
          <span className="flex-1">This file changed on disk while you were editing. Nothing is saved until you choose.</span>
          <Button size="sm" variant="outline" onClick={onLoadTheirs}>Load theirs</Button>
          <Button size="sm" onClick={onKeepMine}>Keep mine</Button>
        </>
      ) : (
        <>
          <span className="flex-1">This file was deleted or moved. Its content is still here.</span>
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          <Button size="sm" onClick={onKeepMine}>Save again</Button>
        </>
      )}
    </div>
  );
}
