import { forwardRef, useImperativeHandle, useState } from 'react';
import { Command, CommandList, CommandItem } from '@/components/ui/command';

interface MentionListProps {
  items: { id: string; label: string }[];
  command: (item: { id: string; label: string }) => void;
  position?: {
    top: number;
    left: number;
  };
}

export interface MentionListHandle {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((prev) => (prev + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((prev) => (prev + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = props.items[selectedIndex];
        if (item) {
          props.command(item);
        }
        return true;
      }
      return false;
    },
  }));

  return (
    <div
      className="fixed z-[1000]"
      style={props.position ? {
        top: props.position.top,
        left: props.position.left,
      } : undefined}
    >
      <Command className="max-h-[300px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg">
        <CommandList className="max-h-[300px] overflow-y-auto p-1">
          {props.items.length ? (
            props.items.map((item, index) => (
              <CommandItem
                key={item.id}
                value={item.label}
                onSelect={() => props.command(item)}
                className={`text-sm cursor-pointer ${
                  index === selectedIndex ? 'bg-accent text-accent-foreground' : ''
                }`}
              >
                <span className="truncate">{item.label}</span>
              </CommandItem>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground italic">No matches</div>
          )}
        </CommandList>
      </Command>
    </div>
  );
});

MentionList.displayName = 'MentionList';
