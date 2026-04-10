import { useCallback, useState, useEffect, useRef } from "react";
import { Editor } from "@tiptap/react";
import { X } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

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
      className="relative h-full bg-background border-l border-border select-none"
      style={{ width: tocWidth }}
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between h-9 px-3 py-0 border-b border-border shrink-0">
          <span className="text-sm font-semibold truncate">Contents</span>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-muted h-6 w-6 flex items-center justify-center shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          <TocList
            entries={headings}
            onHeadingClick={handleHeadingClick}
            activeIdx={activeIdx}
          />
        </div>
      </div>
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors",
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
      <p className="text-sm text-muted-foreground px-2 py-1">
        No headings found
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {entries.map((entry, idx) => {
        const isActive = activeIdx === idx;
        return (
          <li key={idx}>
            <button
              onClick={() => onHeadingClick(entry.pos)}
              className={cn(
                "w-full text-left text-sm py-1 px-2 rounded-md transition-colors truncate block",
                entry.level === 1 && "font-semibold",
                entry.level === 2 && "pl-4",
                entry.level === 3 && "pl-8",
                entry.level >= 4 && "pl-10",
                isActive && "bg-primary/10 text-primary",
                !isActive && "text-muted-foreground hover:text-foreground hover:bg-muted"
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