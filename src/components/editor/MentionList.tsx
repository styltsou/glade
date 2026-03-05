import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@/lib/utils';

interface MentionListProps {
  items: { id: string; label: string }[];
  command: (item: { id: string; label: string }) => void;
}

export const MentionList = forwardRef((props: MentionListProps, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-popover text-popover-foreground border border-border rounded-md shadow-lg overflow-hidden min-w-[180px] p-1 z-[1000] bg-white dark:bg-zinc-950">
      <div className="flex flex-col max-h-[300px] overflow-y-auto">
        {props.items.length ? (
          props.items.map((item, index) => (
            <button
              key={item.id}
              onClick={() => selectItem(index)}
              className={cn(
                "w-full text-left px-2 py-1.5 text-xs rounded transition-colors flex items-center gap-2",
                index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
            >
              <span className="truncate">{item.label}</span>
            </button>
          ))
        ) : (
          <div className="px-3 py-2 text-xs text-muted-foreground italic">No matches</div>
        )}
      </div>
    </div>
  );
});

MentionList.displayName = 'MentionList';
