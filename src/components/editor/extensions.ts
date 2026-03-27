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
import { Extension } from "@tiptap/core";

const lowlight = createLowlight(all);

const HeadingWithPos = Extension.create({
  name: "headingWithPos",
  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          "data-toc-pos": {
            default: null,
            parseHTML: (element) => element.getAttribute("data-toc-pos"),
            renderHTML: (attributes) => {
              if (!attributes["data-toc-pos"]) {
                return {};
              }
              return {
                "data-toc-pos": attributes["data-toc-pos"],
              };
            },
          },
        },
      },
    ];
  },
});

export const extensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    codeBlock: false,
  }),
  HeadingWithPos,
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
  Mention.configure({
    HTMLAttributes: {
      class: "mention",
    },
    suggestion,
  }),
];
