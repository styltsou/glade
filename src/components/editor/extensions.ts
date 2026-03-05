import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { Markdown } from "tiptap-markdown";

export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    codeBlock: { HTMLAttributes: { class: "code-block" } },
  }),
  Link.configure({
    openOnClick: false,
    HTMLAttributes: { class: "editor-link" },
  }),
  Placeholder.configure({ placeholder: "Start writing…" }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Image.configure({ inline: false }),
  Markdown.configure({
    html: true,
    transformCopiedText: true,
    transformPastedText: true,
  }),
];
