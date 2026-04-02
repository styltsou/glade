import { Extension } from '@tiptap/core';
import { Suggestion } from '@tiptap/suggestion';
import { PluginKey } from 'prosemirror-state';
import { escapeForRegEx } from '@tiptap/core';
import type { Range } from '@tiptap/core';
import type { ResolvedPos } from '@tiptap/pm/model';

interface SuggestionMatchResult {
  range: Range;
  query: string;
  text: string;
}

type SuggestionMatch = SuggestionMatchResult | null;

function findSuggestionMatchMulti(config: {
  char: string[];
  allowSpaces: boolean;
  allowToIncludeChar: boolean;
  allowedPrefixes: string[] | null;
  startOfLine: boolean;
  $position: ResolvedPos;
}): SuggestionMatch {
  const { char: chars, allowSpaces: allowSpacesOption, allowToIncludeChar, allowedPrefixes, startOfLine, $position } = config;
  const allowSpaces = allowSpacesOption && !allowToIncludeChar;
  
  const text = $position.nodeBefore?.isText && $position.nodeBefore.text;
  if (!text) {
    return null;
  }
  
  const textFrom = $position.pos - text.length;
  
  for (const char of chars) {
    const escapedChar = escapeForRegEx(char);
    const suffix = new RegExp(`\\s${escapedChar}$`);
    const prefix = startOfLine ? '^' : '';
    const finalEscapedChar = allowToIncludeChar ? '' : escapedChar;
    const regexp = allowSpaces
      ? new RegExp(`${prefix}${escapedChar}.*?(?=\\s${finalEscapedChar}|$)`, 'gm')
      : new RegExp(`${prefix}(?:^)?${escapedChar}[^\\s${finalEscapedChar}]*`, 'gm');
    
    const match = Array.from(text.matchAll(regexp)).pop();
    if (!match || match.input === undefined || match.index === undefined) {
      continue;
    }
    
    const matchPrefix = match.input.slice(Math.max(0, match.index - 1), match.index);
    const matchPrefixIsAllowed = new RegExp(`^[${allowedPrefixes?.join('')}\0]?$`).test(matchPrefix);
    
    if (allowedPrefixes !== null && !matchPrefixIsAllowed) {
      continue;
    }
    
    const from = textFrom + match.index;
    let to = from + match[0].length;
    
    if (allowSpaces && suffix.test(text.slice(to - 1, to + 1))) {
      match[0] += ' ';
      to += 1;
    }
    
    if (from < $position.pos && to >= $position.pos) {
      return {
        range: { from, to },
        query: match[0].slice(char.length),
        text: match[0],
      };
    }
  }
  
  return null;
}

export interface SuggestionItem {
  id: string;
  label: string;
  folder?: string;
  modified?: string | null;
  type?: 'mention' | 'command';
  command?: string;
}

export interface SlashCommandItem {
  id: string;
  label: string;
  icon: string;
  command: string;
  type: 'mention' | 'command';
}

export const slashCommandsList: SlashCommandItem[] = [
  { id: "h1", label: "Heading 1", icon: "H1", command: "heading1", type: 'command' },
  { id: "h2", label: "Heading 2", icon: "H2", command: "heading2", type: 'command' },
  { id: "h3", label: "Heading 3", icon: "H3", command: "heading3", type: 'command' },
  { id: "h4", label: "Heading 4", icon: "H4", command: "heading4", type: 'command' },
  { id: "bullet", label: "Bullet list", icon: "List", command: "bulletList", type: 'command' },
  { id: "ordered", label: "Ordered list", icon: "ListOrdered", command: "orderedList", type: 'command' },
  { id: "task", label: "Task list", icon: "CheckSquare", command: "taskList", type: 'command' },
  { id: "quote", label: "Blockquote", icon: "Quote", command: "blockquote", type: 'command' },
  { id: "code", label: "Code block", icon: "Code", command: "codeBlock", type: 'command' },
  { id: "hr", label: "Horizontal rule", icon: "Minus", command: "horizontalRule", type: 'command' },
  { id: "link", label: "Add link", icon: "Link2", command: "link", type: 'command' },
];

export const suggestionPluginKey = new PluginKey('mentionSuggestion');

type SuggestionCallback = (props: any) => void;
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

export function getSlashCommands(query: string): SlashCommandItem[] {
  if (!query) {
    return slashCommandsList;
  }
  return slashCommandsList.filter((item) =>
    item.label.toLowerCase().includes(query.toLowerCase())
  );
}

function executeSlashCommand(editor: any, range: { from: number; to: number }, command: string) {
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

export const SuggestionExtension = Extension.create({
  name: 'suggestionExtension',

  addProseMirrorPlugins() {
    return [
      Suggestion({
        pluginKey: suggestionPluginKey,
        editor: this.editor,
        char: '@',
        findSuggestionMatch: findSuggestionMatchMulti as any,
        command: ({ editor, range, props }: { editor: any; range: { from: number; to: number }; props: SuggestionItem }) => {
          if (props.type === 'command' && props.command) {
            executeSlashCommand(editor, range, props.command);
          } else if (props.type === 'mention') {
            // Handle mention - insert mention node
            editor.chain().focus().insertContentAt(range, `@${props.label}`).run();
          }
        },
        items: ({ query }: { query: string }) => {
          // Check if query starts with / 
          if (query.startsWith('/')) {
            return getSlashCommands(query.slice(1));
          }
          // Otherwise return mentions (empty for now - could integrate with vault)
          return [];
        },
        render: () => {
          return {
            onStart: (props: any) => {
              if (!props.clientRect) return;
              if (onStartCallback) onStartCallback(props);
            },
            onUpdate: (props: any) => {
              if (!props.clientRect) return;
              if (onUpdateCallback) onUpdateCallback(props);
            },
            onKeyDown: (props: any) => {
              if (props.event.key === 'Escape') {
                if (onExitCallback) onExitCallback();
                return true;
              }
              return false;
            },
            onExit: () => {
              if (onExitCallback) onExitCallback();
            },
          };
        },
      }),
    ];
  },
});
