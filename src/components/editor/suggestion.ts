import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { useStore } from '@/store';
import { MentionList } from './MentionList';
import 'tippy.js/dist/tippy.css';

export default {
  items: ({ query }: { query: string }) => {
    const { entries } = useStore.getState();
    
    // Flatten entries to get all notes
    const allNotes: { id: string; label: string }[] = [];
    const flatten = (items: any[]) => {
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

    // Filter results
    const filtered = allNotes
      .filter(item => item.label.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 10);

    // If no notes found but entries exist, at least we have something to show?
    // Actually, empty is fine, MentionList handles it.
    
    return filtered;
  },

  render: () => {
    let component: ReactRenderer;
    let popup: TippyInstance;

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        // Use tippy to show the list
        const tippyInstances = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
        
        popup = tippyInstances[0];
        
        if (popup) {
          popup.show();
        }
      },

      onUpdate(props: any) {
        component.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup.setProps({
          getReferenceClientRect: props.clientRect,
        });
      },

      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup.hide();
          return true;
        }

        return (component.ref as any)?.onKeyDown(props);
      },

      onExit() {
        if (popup) {
          popup.destroy();
        }
        if (component) {
          component.destroy();
        }
      },
    };
  },
};
