import { ArrowDown as ArrowDownIcon, ArrowUp as ArrowUpIcon, CornerDownLeft as CornerDownLeftIcon, Search as SearchIcon } from "lucide-react";
import { useStore } from "@/store";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { HomeLists, useHomeList } from "@/components/WelcomeHome";

/** Cmd/Ctrl+O: jump to a pinned or recent folder/file without going to Home. Dressed like the command palette. */
export function FolderSwitcher() {
  const open = useStore((s) => s.switcherOpen);
  const close = useStore((s) => s.closeSwitcher);
  const list = useHomeList(open, close);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        data-folder-switcher
        showCloseButton={false}
        onKeyDown={list.onKeyDown}
        className="top-[13vh] w-[min(44rem,calc(100%-2rem))] max-w-none translate-y-0 gap-0 overflow-hidden p-0 data-[state=closed]:animate-none data-[state=open]:animate-none"
      >
        <DialogTitle className="sr-only">Open recent</DialogTitle>
        <DialogDescription className="sr-only">Search pinned and recent folders and files.</DialogDescription>
        <div className="flex h-14 items-center gap-2.5 border-b border-border/50 px-4">
          <SearchIcon aria-hidden className="size-[18px] shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={list.query}
            onChange={(e) => list.setQuery(e.target.value)}
            maxLength={200}
            placeholder="Open folder or file…"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-[min(30rem,58vh)] overflow-y-auto overscroll-contain p-2 [&::-webkit-scrollbar]:hidden">
          <HomeLists list={list} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/50 px-4 py-2.5 text-xs leading-5 text-muted-foreground">
          <span className="ml-auto inline-flex items-center gap-1">
            <Kbd aria-label="Up arrow">
              <ArrowUpIcon aria-hidden />
            </Kbd>
            <Kbd aria-label="Down arrow">
              <ArrowDownIcon aria-hidden />
            </Kbd>
            <span>to navigate</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd aria-label="Enter">
              <CornerDownLeftIcon aria-hidden />
            </Kbd>
            <span>to select</span>
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
