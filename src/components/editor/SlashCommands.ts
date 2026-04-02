import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { PluginKey } from 'prosemirror-state';
import type { SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import type { Editor } from '@tiptap/react';

export interface SlashCommandItem {
  id: string;
  label: string;
  icon: string;
  command: string;
}

export const slashCommandsList: SlashCommandItem[] = [
  { id: "h1", label: "Heading 1", icon: "H1", command: "heading1" },
  { id: "h2", label: "Heading 2", icon: "H2", command: "heading2" },
  { id: "h3", label: "Heading 3", icon: "H3", command: "heading3" },
  { id: "h4", label: "Heading 4", icon: "H4", command: "heading4" },
  { id: "bullet", label: "Bullet list", icon: "List", command: "bulletList" },
  { id: "ordered", label: "Ordered list", icon: "ListOrdered", command: "orderedList" },
  { id: "task", label: "Task list", icon: "CheckSquare", command: "taskList" },
  { id: "quote", label: "Blockquote", icon: "Quote", command: "blockquote" },
  { id: "code", label: "Code block", icon: "Code", command: "codeBlock" },
  { id: "table", label: "Table", icon: "Table", command: "table" },
  { id: "hr", label: "Separator", icon: "Minus", command: "horizontalRule" },
  { id: "link", label: "Add link", icon: "Link2", command: "link" },
];

export function getSlashCommands(query: string): SlashCommandItem[] {
  if (!query) {
    return slashCommandsList;
  }
  return slashCommandsList.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );
}

export const slashCommandsPluginKey = new PluginKey('slashCommands');

type SlashCommandCallback = (props: SuggestionProps<SlashCommandItem>) => void;
type ExitCallback = () => void;

let onStartCallback: SlashCommandCallback | null = null;
let onUpdateCallback: SlashCommandCallback | null = null;
let onExitCallback: ExitCallback | null = null;

export function registerSlashCommandCallbacks(
  onStart: SlashCommandCallback,
  onUpdate: SlashCommandCallback,
  onExit: ExitCallback
) {
  onStartCallback = onStart;
  onUpdateCallback = onUpdate;
  onExitCallback = onExit;
}

export function unregisterSlashCommandCallbacks() {
  onStartCallback = null;
  onUpdateCallback = null;
  onExitCallback = null;
}

export function executeSlashCommand(editor: Editor, range: { from: number; to: number }, command: string) {
  switch (command) {
    case "heading1":
      editor.chain().focus().toggleHeading({ level: 1 }).run();
      break;
    case "heading2":
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case "heading3":
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      break;
    case "heading4":
      editor.chain().focus().toggleHeading({ level: 4 }).run();
      break;
    case "bulletList":
      editor.chain().focus().toggleBulletList().run();
      break;
    case "orderedList":
      editor.chain().focus().toggleOrderedList().run();
      break;
    case "taskList":
      editor.chain().focus().toggleTaskList().run();
      break;
    case "blockquote":
      editor.chain().focus().toggleBlockquote().run();
      break;
    case "codeBlock":
      editor.chain().focus().toggleCodeBlock().run();
      break;
    case "table":
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      break;
    case "horizontalRule":
      editor.chain().focus().setHorizontalRule().run();
      break;
    case "link": {
      const url = window.prompt("Enter URL:");
      if (url) {
        editor.chain().focus().setLink({ href: url }).run();
      }
      break;
    }
  }
  
  const text = editor.state.doc.textBetween(range.from, range.to);
  const slashPos = text.lastIndexOf('/');
  const deleteEnd = slashPos > 0 ? range.from + slashPos + 1 : range.to;
  
  editor.chain().focus().deleteRange({
    from: range.from,
    to: deleteEnd,
  }).run();
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: slashCommandsPluginKey,
        editor: this.editor,
        char: '/',
        command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: SlashCommandItem }) => {
          executeSlashCommand(editor, range, props.command);
        },
        items: ({ query }: { query: string }) => {
          return getSlashCommands(query);
        },
        render: () => {
          return {
            onStart: (props: SuggestionProps<SlashCommandItem>) => {
              if (!props.clientRect) {
                return;
              }
              if (onStartCallback) {
                onStartCallback(props);
              }
            },
            onUpdate: (props: SuggestionProps<SlashCommandItem>) => {
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
            onExit: () => {
              if (onExitCallback) {
                onExitCallback();
              }
            },
          };
        },
      }),
    ];
  },
});
