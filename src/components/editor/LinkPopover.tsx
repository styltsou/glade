import { getMarkRange, type Editor } from "@tiptap/core";
import { Check, Copy, PenLine } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { readableHref } from "@/lib/links";
import { resolveTypedHref } from "@/lib/openLink";
import { paneNotePath } from "./extensions/PaneNote";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Tip } from "@/components/ui/tooltip";

type ActiveLink = { anchor: HTMLAnchorElement; href: string };

const CARD =
  "rounded-xl border-border/60 bg-background/95 shadow-md ring-1 ring-foreground/10 backdrop-blur-xl";
const FIELD =
  "h-8 rounded-md border border-border/70 bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40";

/**
 * Hovering a link shows a small card with its URL, a copy button and an edit
 * button; editing opens a label + destination form. Mirrors Mnemee.
 */
export function LinkInteractionPopover({ editor }: { editor: Editor }) {
  const [hovered, setHovered] = useState<ActiveLink | null>(null);
  const [editing, setEditing] = useState<ActiveLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState("");
  // A link around an image: only where it points can be edited here.
  const [aroundImage, setAroundImage] = useState(false);
  const [href, setHref] = useState("");
  const closeTimer = useRef<number | undefined>(undefined);
  const copiedTimer = useRef<number | undefined>(undefined);
  const cardRef = useRef<HTMLDivElement>(null);

  const cancelClose = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  };
  const resetCopied = () => {
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = undefined;
    setCopied(false);
  };
  const closeHover = () => {
    cancelClose();
    resetCopied();
    setHovered(null);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(closeHover, 120);
  };

  useEffect(() => {
    const dom = editor.view.dom;
    const anchorOf = (t: EventTarget | null) => {
      const a = t instanceof Element ? t.closest("a[href]") : null;
      return a instanceof HTMLAnchorElement ? a : null;
    };
    const inside = (t: EventTarget | null) =>
      t instanceof Node && Boolean(hovered?.anchor.contains(t) || cardRef.current?.contains(t));
    const show = (anchor: HTMLAnchorElement) => {
      if (editing) return;
      const next = anchor.getAttribute("href");
      if (!next) return;
      cancelClose();
      if (hovered?.anchor !== anchor || hovered.href !== next) resetCopied();
      setHovered((cur) => (cur?.anchor === anchor && cur.href === next ? cur : { anchor, href: next }));
    };
    const over = (e: PointerEvent) => {
      const a = anchorOf(e.target);
      if (a) show(a);
    };
    const out = (e: PointerEvent) => {
      if (anchorOf(e.target) && !inside(e.relatedTarget)) scheduleClose();
    };
    dom.addEventListener("pointerover", over);
    dom.addEventListener("pointerout", out);
    return () => {
      cancelClose();
      dom.removeEventListener("pointerover", over);
      dom.removeEventListener("pointerout", out);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, hovered, editing]);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const rangeOf = (link: ActiveLink | null) => {
    if (!link || !link.anchor.isConnected) return undefined;
    const type = editor.schema.marks.link;
    if (!type) return undefined;
    try {
      const pos = editor.view.posAtDOM(link.anchor, 0);
      return getMarkRange(editor.state.doc.resolve(pos), type, { href: link.href });
    } catch {
      return undefined;
    }
  };

  const beginEditing = () => {
    const range = rangeOf(hovered);
    if (!range || !hovered) return closeHover();
    setLabel(editor.state.doc.textBetween(range.from, range.to));
    let image = false;
    editor.state.doc.nodesBetween(range.from, range.to, (node) => {
      if (node.type.name === "image") image = true;
    });
    setAroundImage(image);
    setHref(readableHref(hovered.href));
    setEditing(hovered);
    setHovered(null);
  };

  const copyLink = () => {
    if (!hovered) return;
    if (typeof navigator.clipboard?.writeText !== "function") {
      toast.error("Clipboard is not available.");
      return;
    }
    void navigator.clipboard
      .writeText(readableHref(hovered.href))
      .then(() => {
        setCopied(true);
        window.clearTimeout(copiedTimer.current);
        copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
        toast.success("Copied link.");
      })
      .catch(() => toast.error("Unable to copy link."));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextLabel = label.trim();
    const typed = href.trim();
    // The field shows the readable form; left alone, the link keeps the one it had.
    const unchanged = !!editing && (typed === editing.href || typed === readableHref(editing.href));
    const nextHref = !typed ? typed : unchanged ? editing.href : await resolveTypedHref(typed, paneNotePath(editor));
    const range = rangeOf(editing);
    if (!range || !nextHref) return;
    if (aroundImage) {
      // Replacing the text would take the image with it.
      const done = editor.chain().focus().setTextSelection(range).setLink({ href: nextHref }).setTextSelection(range.to).run();
      if (!done) return void toast.error("Enter a valid link.");
      setEditing(null);
      return;
    }
    if (!nextLabel) return;
    const source = editor.state.doc.resolve(range.from).nodeAfter;
    const marks =
      source?.marks.filter((m) => m.type.name !== "link").map((m) => ({ type: m.type.name, attrs: m.attrs })) ?? [];
    const end = range.from + nextLabel.length;
    const ok = editor
      .chain()
      .focus()
      .insertContentAt(range, { type: "text", text: nextLabel, marks }, { updateSelection: false })
      .setTextSelection({ from: range.from, to: end })
      .setLink({ href: nextHref })
      .setTextSelection(end)
      .run();
    if (!ok) return void toast.error("Enter a valid link.");
    setEditing(null);
  };

  const closeOnEscape = (e: React.KeyboardEvent) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    setEditing(null);
  };

  return (
    <>
      {hovered && (
        <Popover open onOpenChange={(o) => !o && closeHover()} modal={false}>
          <PopoverAnchor virtualRef={{ current: hovered.anchor }} />
          <PopoverContent
            side="top"
            sideOffset={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            className={`w-auto max-w-[calc(100vw-2rem)] px-1.5 py-1 ${CARD}`}
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            <div ref={cardRef} className="flex items-center gap-2">
              <span className="block max-w-56 min-w-0 flex-1 truncate px-1.5 py-1 text-xs leading-5" title={readableHref(hovered.href)}>
                {readableHref(hovered.href)}
              </span>
              <div className="flex items-center">
                <Tip label={copied ? "Copied" : "Copy link"} side="top">
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="Copy link" onClick={copyLink}>
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </Tip>
                {editor.isEditable && (
                  <Tip label="Edit link" side="top">
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="Edit link" onClick={beginEditing}>
                      <PenLine />
                    </Button>
                  </Tip>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
      {editing && (
        <Popover open onOpenChange={(o) => !o && setEditing(null)} modal={false}>
          <PopoverAnchor virtualRef={{ current: editing.anchor }} />
          <PopoverContent side="top" sideOffset={8} className={`w-[min(22rem,calc(100vw-2rem))] p-1.5 ${CARD}`}>
            <form className="grid gap-2" onSubmit={save}>
              {!aroundImage && (
                <label className="grid gap-1 px-1 text-xs font-medium text-muted-foreground">
                  Label
                  <input
                    autoFocus
                    className={FIELD}
                    placeholder="Link text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    onKeyDown={closeOnEscape}
                  />
                </label>
              )}
              <label className="grid gap-1 px-1 text-xs font-medium text-muted-foreground">
                Destination URL
                <input
                  autoFocus={aroundImage}
                  className={FIELD}
                  placeholder="https://example.com"
                  value={href}
                  onChange={(e) => setHref(e.target.value)}
                  onKeyDown={closeOnEscape}
                />
              </label>
              <div className="flex justify-end gap-1 pt-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={(!aroundImage && !label.trim()) || !href.trim()}>
                  Save
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      )}
    </>
  );
}
