import { HorizontalRule } from "@tiptap/extension-horizontal-rule";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import Mention from "@tiptap/extension-mention";
import Underline from "@tiptap/extension-underline";
import { CustomTaskItem } from "./CustomTaskItem";
import { Markdown } from "tiptap-markdown";
import { all, createLowlight } from "lowlight";
import { CustomCodeBlock } from "./CustomCodeBlock";
import suggestion from "./noteLinking";
import { SlashCommands } from "./SlashCommands";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { MermaidBlock } from "./extensions/MermaidBlock";
import { LinkBehavior } from "./extensions/LinkBehavior";
import { PaneNote } from "./extensions/PaneNote";
import { NoteTableView } from "./tables/tableView";
import { TableActiveCell } from "./tables/tableActiveCell";
import { LocalImage } from "./extensions/LocalImage";
import { isAllowedLinkHref } from "@/lib/links";
import { pointsToNote } from "@/lib/autolink";
import { useStore } from "@/store";
import { AutoLink } from "./extensions/AutoLink";
import { linkMarkdown } from "./extensions/linkMarkdown";
import { SoftBreaks } from "./extensions/SoftBreaks";
import { ListMarkers } from "./extensions/ListMarkers";
import { tableMarkdown } from "./tables/tableMarkdown";

const lowlight = createLowlight(all);

export const extensions = [
  // Column resizing is on (as in the mnemee editor); its plugin installs our
  // scrolling node view. Widths live for the session: markdown can't store them.
  Table.extend({ addStorage: () => ({ markdown: tableMarkdown }) }).configure({
    resizable: true,
    View: NoteTableView as never,
  }),
  TableActiveCell,
  TableRow,
  TableHeader,
  TableCell,
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    codeBlock: false,
    // Configured below. StarterKit's copy would also window.open() every clicked link.
    link: false,
  }),
  CustomCodeBlock.configure({
    lowlight,
    // A block without a language stays plain: guessing picks the wrong
    // grammar for most short snippets, and the block's picker sets one.
    defaultLanguage: "plaintext",
    HTMLAttributes: { class: "code-block" },
  }),
  Link.extend({
    // Not inclusive: text typed right after a link or @ reference is plain text.
    inclusive: false,
    // AutoLink does all the detecting; the built-in takes file names for websites.
    addPasteRules: () => [],
    addStorage: () => ({ markdown: linkMarkdown }),
  }).configure({
    autolink: false,
    linkOnPaste: false,
    openOnClick: false,
    isAllowedUri: (url, ctx) => isAllowedLinkHref(url, ctx.defaultValidate),
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
  Underline,
  // Inline, as in markdown: in sentences, links, headings, list items and cells.
  LocalImage.configure({ inline: true }),
  SoftBreaks,
  ListMarkers,
  LinkBehavior,
  AutoLink.configure({
    isLocalNote: (path, from) => pointsToNote(path, from, Object.values(useStore.getState().idToPath)),
  }),
  PaneNote,
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
  MermaidBlock,
  HorizontalRule,
];
