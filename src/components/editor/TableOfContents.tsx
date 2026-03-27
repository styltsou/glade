import { useCallback } from "react";
import { Editor } from "@tiptap/react";
import { X } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
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
  isMobile: boolean;
  headings: TocEntry[];
}

export function TableOfContents({ editor, isOpen, onClose, isMobile, headings }: TableOfContentsProps) {
  const handleHeadingClick = useCallback(
    (pos: number) => {
      if (!editor) return;

      editor.commands.setTextSelection(pos);
      editor.commands.scrollIntoView();
    },
    [editor]
  );

  if (headings.length === 0 && !isOpen) return null;

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} direction={isMobile ? "bottom" : "right"}>
      <DrawerContent className={cn(
        "max-h-[80vh] bg-background",
        !isMobile && "fixed inset-y-0 right-0 w-[240px] mt-0 rounded-none border-l max-h-none"
      )}>
        <DrawerHeader className={cn(
          "flex flex-row items-center justify-between",
          !isMobile && "h-9 px-4 py-0 border-b"
        )}>
          <DrawerTitle className={cn("text-sm font-semibold", isMobile && "text-base")}>Contents</DrawerTitle>
          <DrawerClose asChild>
            <button className="p-1 rounded-md hover:bg-muted h-6 w-6 flex items-center justify-center">
              <X className="h-4 w-4" />
            </button>
          </DrawerClose>
        </DrawerHeader>
        <div className={cn("overflow-auto", isMobile ? "px-4 pb-4 max-h-[60vh]" : "flex-1 p-2")}>
          <TocList
            entries={headings}
            onHeadingClick={handleHeadingClick}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function TocList({
  entries,
  onHeadingClick,
}: {
  entries: TocEntry[];
  onHeadingClick: (pos: number) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {entries.map((entry, idx) => (
        <li key={idx}>
          <button
            onClick={() => onHeadingClick(entry.pos)}
            className={cn(
              "w-full text-left text-sm py-1 px-2 rounded-md transition-colors truncate block",
              entry.level === 1 && "font-semibold",
              entry.level === 2 && "pl-4",
              entry.level === 3 && "pl-8",
              entry.level >= 4 && "pl-10",
              "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {entry.text}
          </button>
        </li>
      ))}
    </ul>
  );
}