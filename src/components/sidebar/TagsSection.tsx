import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil as PencilIcon, Tag as TagIcon, X } from "lucide-react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tip } from "@/components/ui/tooltip";
import { cn, SIDEBAR_CHEVRON, SIDEBAR_COLLAPSE } from "@/lib/utils";

/** The folder's tags, most used first. Picking some narrows the file tree to notes that have all of them. */
export function TagsSection() {
  const tags = useStore((s) => s.tags);
  const activeTagFilters = useStore((s) => s.activeTagFilters);
  const toggleTagFilter = useStore((s) => s.toggleTagFilter);
  const clearTagFilters = useStore((s) => s.clearTagFilters);
  const collapsed = useStore((s) => s.tagsCollapsed);
  const toggleCollapsed = useStore((s) => s.toggleTagsCollapsed);
  const [renaming, setRenaming] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...tags].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [tags],
  );

  if (sorted.length === 0) return null;

  return (
    <div className="shrink-0 bg-sidebar px-1.5 pt-1">
      {/* Built like the workspace menu's trigger below it: same height, icon and chevron sizes. */}
      <div className="relative">
        <button
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          className="flex h-8 w-full min-w-0 cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-semibold tracking-[-0.01em] outline-none hover:bg-foreground/[0.07]"
        >
          <TagIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">Tags</span>
          {activeTagFilters.length > 0 ? (
            <span className="inline-flex h-[18px] min-w-6 items-center justify-center rounded-full bg-foreground/[0.09] px-2 text-[11px] font-medium tabular-nums text-foreground">
              {activeTagFilters.length}
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "ml-auto size-3.5 shrink-0 text-muted-foreground",
              SIDEBAR_CHEVRON,
              collapsed && "-rotate-90",
            )}
          />
        </button>
        {activeTagFilters.length > 0 ? (
          <Tip label="Clear tag filter" side="right">
            <button
              onClick={clearTagFilters}
              aria-label="Clear tag filter"
              className="absolute right-8 top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/[0.09] hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </Tip>
        ) : null}
      </div>

      <div
        className={cn(
          SIDEBAR_COLLAPSE,
          collapsed ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        )}
      >
        <div className="overflow-hidden">
          <div className="max-h-40 space-y-0.5 overflow-y-auto pb-1 pt-0.5">
            {sorted.map((tag) => {
              const active = activeTagFilters.includes(tag.name);
              return (
                <ContextMenu key={tag.name}>
                  <ContextMenuTrigger asChild>
                    <button
                      onClick={() => toggleTagFilter(tag.name)}
                      aria-pressed={active}
                      tabIndex={collapsed ? -1 : 0}
                      className={cn(
                        "flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors",
                        active
                          ? "bg-sidebar-accent font-medium text-foreground"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-foreground",
                      )}
                    >
                      {/* Lowercase tags have few ascenders, so the line box looks low: lift the text a pixel. */}
                      <span className="min-w-0 flex-1 -translate-y-px truncate">{tag.name}</span>
                      {/* Centred in the chevron's column above (14px, like the chevron), so the numbers line up under it. */}
                      <span className="flex w-3.5 shrink-0 -translate-y-px justify-center text-xs tabular-nums text-muted-foreground/75">{tag.count}</span>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="min-w-48">
                    <ContextMenuItem onClick={() => setRenaming(tag.name)}>
                      <PencilIcon className="mr-2 h-4 w-4" />
                      Rename or merge…
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      </div>

      <RenameTagDialog tag={renaming} onClose={() => setRenaming(null)} />
    </div>
  );
}

function RenameTagDialog({ tag, onClose }: { tag: string | null; onClose: () => void }) {
  const tags = useStore((s) => s.tags);
  const renameTag = useStore((s) => s.renameTag);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (tag !== null) setName(tag);
  }, [tag]);

  const next = name.trim().replace(/^#/, "").trim();
  const current = tags.find((t) => t.name === tag);
  const existing = tags.find((t) => t.name === next && t.name !== tag);
  const valid = next.length > 0 && next !== tag && !next.includes(",");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tag || !valid || busy) return;
    setBusy(true);
    const ok = await renameTag(tag, next);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={tag !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Rename tag</h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="tag-name">New name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              className="w-full"
            />
            <p className="min-h-5 text-[13px] text-muted-foreground">
              {existing
                ? `"${existing.name}" already exists, so these notes will join its ${existing.count} ${existing.count === 1 ? "note" : "notes"}.`
                : current
                  ? `Changes ${current.count} ${current.count === 1 ? "note" : "notes"}.`
                  : ""}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {existing ? "Merge" : "Rename"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
