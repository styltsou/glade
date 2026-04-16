import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import Mention from "@tiptap/extension-mention";
import { CustomTaskItem } from "./CustomTaskItem";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";
import { all, createLowlight } from "lowlight";
import { CustomCodeBlock } from "./CustomCodeBlock";
import suggestion from "./suggestion";
import { SlashCommands } from "./SlashCommands";
import { SuggestionExtension } from "./SuggestionExtension";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { MermaidBlock } from "./extensions/MermaidBlock";

const lowlight = createLowlight(all);

export const extensions = [
  Table.configure({
    resizable: false,
  }),
  TableRow,
  TableHeader,
  TableCell,
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    codeBlock: false,
  }),
  CustomCodeBlock.configure({
    lowlight,
    HTMLAttributes: { class: "code-block" },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: "editor-link" },
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return "Heading " + node.attrs.level;
      }
      if (node.type.name === "paragraph" && !node.textContent) {
        return "Type '/' for commands";
      }
      return "";
    },
    emptyEditorClass: "is-editor-empty",
    showOnlyWhenEditable: true,
  }),
  TaskList,
  CustomTaskItem.configure({ nested: true }),
  Image.configure({ inline: false }),
  BubbleMenu.configure({
    element: null,
  }),
  Markdown.configure({
    html: true,
    transformCopiedText: true,
    transformPastedText: true,
  }),
  Mention.configure({
    HTMLAttributes: {
      class: "mention",
    },
    suggestion,
  }),
  SlashCommands,
  SuggestionExtension,
  MermaidBlock,
  HorizontalRule,
];
