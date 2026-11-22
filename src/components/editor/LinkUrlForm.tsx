import type { Editor } from "@tiptap/core";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { isAllowedUri } from "@tiptap/extension-link";
import { isAllowedLinkHref } from "@/lib/links";
import { resolveTypedHref } from "@/lib/openLink";
import { paneNotePath } from "./extensions/PaneNote";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";

/** Inline "Paste or type a link" form: sets, changes or (when empty) removes the link on the selection. */
export function LinkUrlForm({ editor, onDone }: { editor: Editor; onDone: () => void }) {
  const [href, setHref] = useState<string>(editor.getAttributes("link").href ?? "");

  const apply = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = href.trim();
    const unchanged = text === editor.getAttributes("link").href;
    const url = !text || unchanged ? text : await resolveTypedHref(text, paneNotePath(editor));
    if (editor.isDestroyed) return;
    if (url && !isAllowedLinkHref(url, (u) => !!isAllowedUri(u))) {
      toast.error("Enter a valid link.");
      return;
    }
    const end = editor.state.selection.to;
    if (url && editor.state.selection.empty && !editor.isActive("link")) {
      // Nothing selected: insert the URL itself as the link text.
      editor.chain().focus().insertContent({ type: "text", text, marks: [{ type: "link", attrs: { href: url } }] }).run();
      onDone();
      return;
    }
    const chain = editor.chain().focus().extendMarkRange("link");
    (url ? chain.setLink({ href: url }) : chain.unsetLink()).setTextSelection(end).run();
    onDone();
  };

  return (
    <form className="flex items-center gap-1 rounded-lg border bg-popover p-0.5 shadow-lg" onSubmit={apply}>
      <input
        autoFocus
        className="h-7 w-52 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
        placeholder="Paste or type a link"
        value={href}
        onChange={(e) => setHref(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          onDone();
          editor.commands.focus();
        }}
      />
      <Tip label="Apply (Enter)" side="bottom">
        <Button type="submit" size="icon-xs" aria-label="Apply link">
          <CornerDownLeft />
        </Button>
      </Tip>
    </form>
  );
}

/** Fired by the `/link` slash command; the focused editor answers by opening the form at its caret. */
export const OPEN_LINK_FORM_EVENT = "glade:open-link-form";

export function CaretLinkPopover({ editor }: { editor: Editor }) {
  const [pos, setPos] = useState<number | null>(null);

  useEffect(() => {
    const open = () => {
      if (!editor.isFocused) return;
      setPos(editor.state.selection.from);
    };
    window.addEventListener(OPEN_LINK_FORM_EVENT, open);
    return () => window.removeEventListener(OPEN_LINK_FORM_EVENT, open);
  }, [editor]);

  // A point in the middle of the caret's line, re-measured as the note scrolls or reflows.
  const anchor = useMemo(
    () => ({
      current: {
        // A getter, because the view isn't mounted yet on the first render.
        get contextElement() {
          return editor.view.dom;
        },
        getBoundingClientRect: () => {
          const at = Math.min(pos ?? 0, editor.state.doc.content.size);
          const { left, top, bottom } = editor.view.coordsAtPos(at);
          return new DOMRect(left, (top + bottom) / 2, 0, 0);
        },
      },
    }),
    [editor, pos],
  );

  if (pos === null) return null;
  return (
    <Popover
      open
      modal={false}
      onOpenChange={(o) => {
        if (!o) setPos(null);
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={0}
        // Pull back by half its height to sit on the line; mirrored when flipped at the window's bottom edge.
        className="w-auto border-0 bg-transparent p-0 shadow-none data-[side=bottom]:-translate-y-1/2 data-[side=top]:translate-y-1/2"
      >
        <LinkUrlForm editor={editor} onDone={() => setPos(null)} />
      </PopoverContent>
    </Popover>
  );
}
