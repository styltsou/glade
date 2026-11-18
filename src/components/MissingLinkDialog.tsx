import { invoke } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { shortenPath } from "@/lib/paths";
import { relativeTo } from "@/lib/paths";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** A link points at a markdown file that doesn't exist: offer to create it. */
export function MissingLinkDialog() {
  const link = useStore((s) => s.missingLink);
  const setLink = useStore((s) => s.setMissingLink);
  const home = useStore((s) => s.homeDir);
  const root = useStore((s) => s.target);
  const linkNavigate = useStore((s) => s.linkNavigate);
  const loadVault = useStore((s) => s.loadVault);

  const create = async () => {
    if (!link) return;
    // Showing the full path in this dialog is the confirmation for outside targets.
    const abs = await invoke<string>("create_linked_note", { from: link.from, href: link.href, confirmed: true });
    setLink(null);
    await loadVault();
    const rel = root?.kind === "folder" ? relativeTo(root.path, abs) : null;
    await linkNavigate(rel ?? abs);
  };

  return (
    <Dialog open={!!link} onOpenChange={(open) => !open && setLink(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>File not found</DialogTitle>
          <DialogDescription className="break-all">
            {link && shortenPath(link.abs, home)}
          </DialogDescription>
        </DialogHeader>
        {link?.outside && (
          <p className="text-sm text-muted-foreground">This is outside the folder you have open. Creating it will add a new, empty file there.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setLink(null)}>Cancel</Button>
          <Button onClick={create}>Create file</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
