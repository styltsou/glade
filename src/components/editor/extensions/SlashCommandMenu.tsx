import { useState, useCallback, useEffect, useRef } from "react";
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Code,
  Minus,
  Link2,
} from "lucide-react";

export interface SlashCommandItem {
  id: string;
  label: string;
  icon: string;
  command: string;
}

export const slashCommands: SlashCommandItem[] = [
  { id: "h1", label: "Heading 1", icon: "H1", command: "heading1" },
  { id: "h2", label: "Heading 2", icon: "H2", command: "heading2" },
  { id: "h3", label: "Heading 3", icon: "H3", command: "heading3" },
  { id: "h4", label: "Heading 4", icon: "H4", command: "heading4" },
  { id: "bullet", label: "Bullet list", icon: "List", command: "bulletList" },
  { id: "ordered", label: "Ordered list", icon: "ListOrdered", command: "orderedList" },
  { id: "task", label: "Task list", icon: "CheckSquare", command: "taskList" },
  { id: "quote", label: "Blockquote", icon: "Quote", command: "blockquote" },
  { id: "code", label: "Code block", icon: "Code", command: "codeBlock" },
  { id: "hr", label: "Horizontal rule", icon: "Minus", command: "horizontalRule" },
  { id: "link", label: "Add link", icon: "Link2", command: "link" },
];

const iconMap: Record<string, React.ReactNode> = {
  H1: <Heading1 className="h-4 w-4" />,
  H2: <Heading2 className="h-4 w-4" />,
  H3: <Heading3 className="h-4 w-4" />,
  H4: <Heading4 className="h-4 w-4" />,
  List: <List className="h-4 w-4" />,
  ListOrdered: <ListOrdered className="h-4 w-4" />,
  CheckSquare: <CheckSquare className="h-4 w-4" />,
  Quote: <Quote className="h-4 w-4" />,
  Code: <Code className="h-4 w-4" />,
  Minus: <Minus className="h-4 w-4" />,
  Link2: <Link2 className="h-4 w-4" />,
};

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
  position: { top: number; left: number };
}

export function SlashCommandMenu({
  items,
  command,
  position,
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setSelectedIndex(0);
    itemRefs.current[0]?.focus();
  }, [items]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => {
        const newIndex = prev <= 0 ? items.length - 1 : prev - 1;
        itemRefs.current[newIndex]?.focus();
        return newIndex;
      });
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => {
        const newIndex = prev >= items.length - 1 ? 0 : prev + 1;
        itemRefs.current[newIndex]?.focus();
        return newIndex;
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (items[selectedIndex]) {
        command(items[selectedIndex]);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      e.stopPropagation();
      setSelectedIndex(prev => {
        const newIndex = e.shiftKey 
          ? (prev <= 0 ? items.length - 1 : prev - 1)
          : (prev >= items.length - 1 ? 0 : prev + 1);
        itemRefs.current[newIndex]?.focus();
        return newIndex;
      });
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [items, selectedIndex, command]);

  // Calculate position to avoid overflow
  const menuHeight = items.length * 36 + 8; // approx height
  const spaceBelow = window.innerHeight - position.top;
  const showAbove = spaceBelow < menuHeight + 20;
  
  const adjustedPosition = showAbove 
    ? { top: position.top - menuHeight - 8, left: position.left }
    : position;

  return (
    <div
      ref={menuRef}
      className="bg-background border border-border rounded-md shadow-lg overflow-hidden min-w-[200px] z-[100]"
      style={{
        position: 'fixed',
        top: adjustedPosition.top,
        left: adjustedPosition.left,
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="py-1">
        {items.length === 0 ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">
            No results
          </div>
        ) : (
          items.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[index] = el; }}
              type="button"
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors outline-none ${
                index === selectedIndex
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => command(item)}
              onFocus={() => setSelectedIndex(index)}
            >
              <span className="text-muted-foreground">{iconMap[item.icon]}</span>
              <span>{item.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
