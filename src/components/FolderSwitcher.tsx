import { useStore } from "@/store";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { HomeLists, useHomeList } from "@/components/WelcomeHome";

/** Cmd/Ctrl+O: jump to a pinned or recent folder/file without going to Home. */
export function FolderSwitcher() {
  const open = useStore((s) => s.switcherOpen);
  const close = useStore((s) => s.closeSwitcher);
  const list = useHomeList(open, close);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-xl p-0 gap-0" onKeyDown={list.onKeyDown}>
        <DialogTitle className="sr-only">Open recent</DialogTitle>
        <input
          autoFocus
          value={list.query}
          onChange={(e) => list.setQuery(e.target.value)}
          placeholder="Open folder or file…"
          className="h-12 w-full border-b border-border bg-transparent px-4 text-sm outline-none"
        />
        <div className="max-h-[50vh] overflow-y-auto p-2">
          <HomeLists list={list} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
