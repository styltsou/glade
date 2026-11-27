import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";
import { ChevronRight, X } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { usePanelResize } from "@/hooks/usePanelResize";
import { PanelResizeHandle, PANEL_CARD } from "./PanelResizeHandle";

/** Space around the floating card (1 left for the resize handle, 2 top/bottom/right); the drawer is this much wider than its card. */
export const TOC_GUTTER = 12;

/** The nearest ancestor that actually scrolls (the editor, or a wrapper around it). */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === "auto" || overflow === "scroll") && node.scrollHeight > node.clientHeight) return node;
  }
  return null;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Ease-out quart: moves fast first, then settles on the heading. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);

let stopScroll: (() => void) | null = null;

/** Scroll `heading` to just below the top of its scroller, then flash it. Any user scroll cancels the glide. */
function glideToHeading(heading: HTMLElement) {
  stopScroll?.();
  const flash = () => {
    if (prefersReducedMotion()) return;
    heading.classList.remove("toc-flash");
    void heading.offsetWidth; // restart the animation if it is already running
    heading.classList.add("toc-flash");
    heading.addEventListener("animationend", () => heading.classList.remove("toc-flash"), { once: true });
  };

  const scroller = scrollParent(heading);
  if (!scroller) {
    heading.scrollIntoView({ block: "start" });
    flash();
    return;
  }
  const from = scroller.scrollTop;
  const maxTop = scroller.scrollHeight - scroller.clientHeight;
  const to = Math.max(0, Math.min(maxTop, from + heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 24));
  const distance = Math.abs(to - from);
  if (distance < 2 || prefersReducedMotion()) {
    scroller.scrollTop = to;
    flash();
    return;
  }

  // A longer trip takes a little longer, but never drags.
  const duration = Math.min(420, 220 + distance * 0.12);
  const start = performance.now();
  let frame = 0;
  const cancel = () => {
    cancelAnimationFrame(frame);
    scroller.removeEventListener("wheel", cancel);
    scroller.removeEventListener("touchstart", cancel);
    scroller.removeEventListener("pointerdown", cancel);
    if (stopScroll === cancel) stopScroll = null;
  };
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    scroller.scrollTop = from + (to - from) * easeOut(t);
    if (t < 1) {
      frame = requestAnimationFrame(step);
    } else {
      cancel();
      flash();
    }
  };
  stopScroll = cancel;
  scroller.addEventListener("wheel", cancel, { passive: true });
  scroller.addEventListener("touchstart", cancel, { passive: true });
  scroller.addEventListener("pointerdown", cancel, { passive: true });
  frame = requestAnimationFrame(step);
}

interface TocEntry {
  level: number;
  text: string;
  pos: number;
}

interface TableOfContentsProps {
  editor: Editor | null;
  isOpen: boolean;
  onClose: () => void;
  headings: TocEntry[];
}

export function TableOfContents({ editor, isOpen, onClose, headings }: TableOfContentsProps) {
  const tocWidth = useStore((state) => state.tocWidth);
  const setTocWidth = useStore((state) => state.setTocWidth);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!editor) {
      setActiveIdx(null);
      return;
    }

    const updateActiveHeading = () => {
      const scrollTop = editor.view.dom.scrollTop;
      const viewportHeight = editor.view.dom.clientHeight;
      const editorRect = editor.view.dom.getBoundingClientRect();

      let activeIndex: number | null = null;
      let minDistance = Infinity;

      headings.forEach((heading, idx) => {
        try {
          const domNode = editor.view.nodeDOM(heading.pos);
          
          if (domNode && domNode instanceof HTMLElement) {
            const rect = domNode.getBoundingClientRect();
            const relativeTop = rect.top - editorRect.top + scrollTop;
            
            if (relativeTop >= scrollTop - 100 && relativeTop <= scrollTop + viewportHeight + 100) {
              const distance = Math.abs(relativeTop - scrollTop);
              if (distance < minDistance) {
                minDistance = distance;
                activeIndex = idx;
              }
            }
          }
        } catch {
          // Node might not be rendered
        }
      });

      setActiveIdx(activeIndex);
    };

    updateActiveHeading();

    const handleScroll = () => {
      requestAnimationFrame(updateActiveHeading);
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener("scroll", handleScroll);
    
    return () => {
      editorDom.removeEventListener("scroll", handleScroll);
    };
  }, [editor, headings]);

  const handleHeadingClick = useCallback(
    (pos: number) => {
      if (!editor) return;
      editor.commands.setTextSelection(pos);
      const node = editor.view.nodeDOM(pos);
      if (node instanceof HTMLElement) glideToHeading(node);
      else editor.commands.scrollIntoView();
    },
    [editor]
  );

  const panelRef = useRef<HTMLDivElement>(null);
  const { isResizing, onPointerDown } = usePanelResize(tocWidth, setTocWidth, panelRef, TOC_GUTTER);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="relative h-full shrink-0 py-2 pr-2 pl-1 select-none"
      style={{ width: tocWidth + TOC_GUTTER }}
    >
      <PanelResizeHandle dragging={isResizing} onPointerDown={onPointerDown} />
      <div className={cn("flex h-full flex-col overflow-hidden rounded-xl border bg-sidebar shadow-sm", PANEL_CARD)}>
        <div className="flex items-center justify-between h-9 pl-4 pr-2 shrink-0">
          <span className="text-[13px] font-medium tracking-[-0.005em] text-muted-foreground truncate">On this page</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contents"
            className="press flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-2 pb-2 overlay-scroll">
          <TocList
            entries={headings}
            onHeadingClick={handleHeadingClick}
            activeIdx={activeIdx}
          />
        </div>
      </div>
    </div>
  );
}

/** Same heading text and level can repeat, so number the repeats. */
function entryKeys(entries: TocEntry[]): string[] {
  const seen = new Map<string, number>();
  return entries.map((e) => {
    const base = `${e.level}:${e.text}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return `${base}:${n}`;
  });
}

function TocList({
  entries,
  onHeadingClick,
  activeIdx,
}: {
  entries: TocEntry[];
  onHeadingClick: (pos: number) => void;
  activeIdx: number | null;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const keys = useMemo(() => entryKeys(entries), [entries]);

  const toggle = useCallback((key: string, collapse?: boolean) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      const shouldCollapse = collapse ?? !next.has(key);
      if (shouldCollapse) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  // Rows that show, and for hidden ones the collapsed parent that stands in for them.
  const { rows, owner } = useMemo(() => {
    const rows: { entry: TocEntry; idx: number; hasChildren: boolean; isCollapsed: boolean }[] = [];
    const owner = new Map<number, number>();
    let skipBelow: number | null = null;
    let skipOwner = -1;
    entries.forEach((entry, idx) => {
      if (skipBelow !== null) {
        if (entry.level > skipBelow) {
          owner.set(idx, skipOwner);
          return;
        }
        skipBelow = null;
      }
      const hasChildren = idx + 1 < entries.length && entries[idx + 1].level > entry.level;
      const isCollapsed = hasChildren && collapsed.has(keys[idx]);
      rows.push({ entry, idx, hasChildren, isCollapsed });
      if (isCollapsed) {
        skipBelow = entry.level;
        skipOwner = idx;
      }
    });
    return { rows, owner };
  }, [entries, keys, collapsed]);

  if (entries.length === 0) {
    return (
      <p className="px-2.5 py-1.5 text-[13px] text-muted-foreground/70">
        No headings yet. Add a heading to build an outline.
      </p>
    );
  }

  const shownActive = activeIdx === null ? null : (owner.get(activeIdx) ?? activeIdx);

  return (
    <ul className="space-y-px">
      {rows.map(({ entry, idx, hasChildren, isCollapsed }) => {
        const isActive = shownActive === idx;
        const depth = Math.min(Math.max(entry.level, 1), 4) - 1;
        return (
          <li
            key={keys[idx]}
            className={cn(
              "flex items-center rounded-lg pr-1 transition-colors",
              isActive
                ? "bg-foreground/[0.09] text-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)]"
                : cn(
                    "hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.09]",
                    entry.level <= 1 ? "text-sidebar-foreground" : "text-muted-foreground"
                  )
            )}
            style={{ paddingLeft: 4 + depth * 12 }}
          >
            {hasChildren ? (
              <button
                type="button"
                aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${entry.text}`}
                aria-expanded={!isCollapsed}
                onClick={() => toggle(keys[idx])}
                className="flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground"
              >
                <ChevronRight className={cn("size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none", !isCollapsed && "rotate-90")} />
              </button>
            ) : (
              <span aria-hidden className="size-5 shrink-0" />
            )}
            <button
              onClick={() => onHeadingClick(entry.pos)}
              onKeyDown={(e) => {
                if (!hasChildren || e.altKey || e.ctrlKey || e.metaKey) return;
                if (e.key === "ArrowLeft" && !isCollapsed) {
                  e.preventDefault();
                  toggle(keys[idx], true);
                } else if (e.key === "ArrowRight" && isCollapsed) {
                  e.preventDefault();
                  toggle(keys[idx], false);
                }
              }}
              className={cn(
                "block min-w-0 flex-1 truncate py-[7px] pr-1.5 pl-1 text-left text-sm tracking-[-0.005em]",
                isActive && "font-medium"
              )}
            >
              {entry.text}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
