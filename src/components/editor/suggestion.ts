import type { SuggestionProps as TipTapSuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import type { VaultEntry } from '@/types';
import { useStore } from '@/store';

export interface SuggestionItem {
  id: string;
  label: string;
}

type SuggestionCallback = (props: TipTapSuggestionProps<SuggestionItem>) => void;
type ExitCallback = () => void;

let onStartCallback: SuggestionCallback | null = null;
let onUpdateCallback: SuggestionCallback | null = null;
let onExitCallback: ExitCallback | null = null;

export function registerSuggestionCallbacks(
  onStart: SuggestionCallback,
  onUpdate: SuggestionCallback,
  onExit: ExitCallback
) {
  onStartCallback = onStart;
  onUpdateCallback = onUpdate;
  onExitCallback = onExit;
}

export function unregisterSuggestionCallbacks() {
  onStartCallback = null;
  onUpdateCallback = null;
  onExitCallback = null;
}

export default {
  items: ({ query }: { query: string }) => {
    const { entries } = useStore.getState();
    
    const allNotes: { id: string; label: string }[] = [];
    const flatten = (items: VaultEntry[]) => {
      if (!items) return;
      items.forEach(item => {
        if (!item.is_dir) {
          allNotes.push({
            id: item.path,
            label: item.name,
          });
        }
        if (item.children && item.children.length > 0) {
          flatten(item.children);
        }
      });
    };
    
    flatten(entries);

    const filtered = allNotes
      .filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);

    return filtered;
  },

  render: () => {
    return {
      onStart: (props: TipTapSuggestionProps<SuggestionItem>) => {
        if (!props.clientRect) {
          return;
        }

        if (onStartCallback) {
          onStartCallback(props);
        }
      },

      onUpdate: (props: TipTapSuggestionProps<SuggestionItem>) => {
        if (!props.clientRect) {
          return;
        }

        if (onUpdateCallback) {
          onUpdateCallback(props);
        }
      },

      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          if (onExitCallback) {
            onExitCallback();
          }
          return true;
        }
        return false;
      },

      onExit() {
        if (onExitCallback) {
          onExitCallback();
        }
      },
    };
  },
};
