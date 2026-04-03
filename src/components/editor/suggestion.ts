import type { SuggestionProps as TipTapSuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import type { VaultEntry } from '@/types';
import { useStore } from '@/store';

export interface SuggestionItem {
  id: string;
  label: string;
  folder?: string;
  modified?: string | null;
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
    
    const allNotes: SuggestionItem[] = [];
    const flatten = (items: VaultEntry[], parentFolder?: string) => {
      if (!items) return;
      items.forEach(item => {
        if (!item.is_dir) {
          allNotes.push({
            id: item.id,
            label: item.name,
            folder: parentFolder,
            modified: item.modified,
          });
        }
        if (item.children && item.children.length > 0) {
          flatten(item.children, item.name);
        }
      });
    };
    
    flatten(entries);

    if (!query) {
      return allNotes
        .sort((a, b) => {
          const aTime = a.modified ? new Date(a.modified).getTime() : 0;
          const bTime = b.modified ? new Date(b.modified).getTime() : 0;
          return bTime - aTime;
        })
        .slice(0, 10);
    }

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
