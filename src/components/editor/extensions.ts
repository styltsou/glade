import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import BubbleMenu from "@tiptap/extension-bubble-menu";
import { CustomTaskItem } from "./CustomTaskItem";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";
import { all, createLowlight } from "lowlight";
import { CustomCodeBlock } from "./CustomCodeBlock";

const lowlight = createLowlight(all);

export const extensions = [
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
  Placeholder.configure({ placeholder: "Start writing…" }),
  TaskList,
  CustomTaskItem.configure({ nested: true }),
  Image.configure({ inline: false }),
  BubbleMenu.configure({
    element: null, // Component will provide the element
  }),
  Markdown.configure({
    html: true,
    transformCopiedText: true,
    transformPastedText: true,
  }),
];
