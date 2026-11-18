import { FolderSearch, Home } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { shortenPath } from "@/lib/paths";

/** The open folder no longer exists (deleted or moved). */
export function RootMissing() {
  const target = useStore((s) => s.target);
  const home = useStore((s) => s.homeDir);
  const closeTarget = useStore((s) => s.closeTarget);
  const openPath = useStore((s) => s.openPath);

  const locate = async () => {
    if (!target) return;
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected !== "string") return;
    // Carry the folder's saved state (pins etc.) to its new location.
    await invoke("locate_folder", { oldPath: target.path, newPath: selected });
    await closeTarget();
    await openPath(selected);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <p className="text-lg font-medium">This folder is no longer available</p>
      <p className="max-w-md break-all text-sm text-muted-foreground">{target && shortenPath(target.path, home)}</p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={locate}><FolderSearch className="mr-2 size-4" /> Locate…</Button>
        <Button onClick={closeTarget}><Home className="mr-2 size-4" /> Go to Home</Button>
      </div>
    </div>
  );
}
