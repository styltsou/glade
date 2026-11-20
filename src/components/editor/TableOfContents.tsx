import { useCallback, useState, useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";
import { X } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

/** Space around the floating card (1 left for the resize handle, 2 top/bottom/right); the drawer is this much wider than its card. */
export const TOC_GUTTER = 12;

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
  const [isResizing, setIsResizing] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

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
      editor.commands.scrollIntoView();
    },
    [editor]
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = tocWidth;
    setIsResizing(true);
  }, [tocWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startXRef.current - e.clientX;
      const newWidth = Math.max(200, Math.min(500, startWidthRef.current + delta));
      setTocWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setTocWidth]);

  if (!isOpen) return null;

  return (
    <div
      className="relative h-full shrink-0 py-2 pr-2 pl-1 select-none"
      style={{ width: tocWidth + TOC_GUTTER }}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-sidebar-border/70 bg-sidebar shadow-sm">
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
      <div
        className={cn(
          "absolute left-0 top-2 bottom-2 w-1 cursor-col-resize hover:bg-primary/30 transition-colors",
          isResizing && "bg-primary/50"
        )}
        onMouseDown={handleMouseDown}
      />
    </div>
  );
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
  if (entries.length === 0) {
    return (
      <p className="px-2.5 py-1.5 text-[13px] text-muted-foreground/70">
        No headings yet. Add a heading to build an outline.
      </p>
    );
  }

  return (
    <ul className="space-y-px">
      {entries.map((entry, idx) => {
        const isActive = activeIdx === idx;
        return (
          <li key={idx}>
            <button
              onClick={() => onHeadingClick(entry.pos)}
              className={cn(
                "block w-full truncate rounded-lg py-[7px] pr-2.5 text-left text-sm tracking-[-0.005em] transition-colors",
                entry.level <= 1 && "pl-2.5",
                entry.level === 2 && "pl-5",
                entry.level === 3 && "pl-7.5",
                entry.level >= 4 && "pl-10",
                isActive
                  ? "bg-foreground/[0.09] font-medium text-foreground shadow-[inset_0_0_0_1px_hsl(var(--foreground)/0.04)]"
                  : cn(
                      "hover:bg-foreground/[0.06] hover:text-foreground active:bg-foreground/[0.09]",
                      entry.level <= 1 ? "text-sidebar-foreground" : "text-muted-foreground"
                    )
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