import Image from "@tiptap/extension-image";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { encodePath, isAbsolutePath, readableHref, relativeLink } from "@/lib/links";
import { defaultMarkdownSerializer } from "@tiptap/pm/markdown";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";
import { openLightbox } from "@/components/Lightbox";
import { addPastedImage } from "@/lib/insertImage";

/** Resolve a markdown image source to something the webview can load. */
export function displayImageSrc(src: string | null | undefined, notePath?: string | null): string | null | undefined {
  if (!src || /^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith("file:")) return src;
  const { activeNote, target } = useStore.getState();
  const current = notePath ?? activeNote?.path;
  if (!current) return src;

  let decoded = src.startsWith("file://") ? src.slice(7) : src;
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // keep as is
  }
  let abs = decoded;
  if (!isAbsolutePath(decoded)) {
    const noteAbs = isAbsolutePath(current)
      ? current
      : `${target?.path ?? ""}/${current}`;
    const parts = noteAbs.split("/").slice(0, -1);
    for (const seg of decoded.split("/")) {
      if (seg === "..") parts.pop();
      else if (seg !== "." && seg !== "") parts.push(seg);
    }
    abs = parts.join("/");
  }
  return convertFileSrc(abs, "glade-img");
}

/** Undo `displayImageSrc` for pasted HTML so markdown keeps a relative path. */
export function restoreImageSrc(src: string | null): string | null {
  if (!src) return src;
  const m = src.match(/^(?:glade-img:\/\/localhost|http:\/\/glade-img\.localhost)\/(.+)$/);
  if (!m) return src;
  let abs: string;
  try {
    abs = decodeURIComponent(m[1]);
  } catch {
    return src;
  }
  const { activeNote, target } = useStore.getState();
  if (!activeNote) return abs;
  const noteAbs = isAbsolutePath(activeNote.path) ? activeNote.path : `${target?.path ?? ""}/${activeNote.path}`;
  return relativeLink(noteAbs, abs);
}

const FROM_MARKDOWN = "data-from-markdown";

function escapeAttribute(value: string, inTable: boolean): string {
  const escaped = value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return inTable ? escaped.replace(/\|/g, "&#124;") : escaped;
}

/**
 * How to show a paragraph of nothing but images: a picture (one image, not
 * linked) or a row (badges and the like). Null when there is text as well.
 */
function imageParagraphClass(node: PMNode): string | null {
  if (node.type.name !== "paragraph") return null;
  let images = 0;
  let linked = false;
  let other = false;
  node.forEach((child) => {
    if (child.type.name === "image") {
      images++;
      if (child.marks.some((mark) => mark.type.name === "link")) linked = true;
    } else if (child.type.name !== "hardBreak" && child.text?.trim() !== "") other = true;
  });
  if (images === 0 || other) return null;
  return images === 1 && !linked ? "image-paragraph image-single" : "image-paragraph";
}

/**
 * Image whose stored `src` stays exactly as written in the markdown; only the
 * rendered element points at the local-image protocol.
 */
export const LocalImage = Image.extend({
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any, parent: any, index: number) {
          const { src, alt, title, width, height } = node.attrs;
          if (width || height) {
            // Markdown has no way to give an image a size.
            const attrs = Object.entries({ src, alt, title, width, height })
              .filter(([, value]) => value)
              .map(([name, value]) => ` ${name}="${escapeAttribute(String(value), !!state.inTable)}"`);
            state.write(`<img${attrs.join("")}>`);
            return;
          }
          // An <img> may have spaces in its src; a markdown destination can't.
          const target = readableHref(src ?? "").replace(/\s/g, (space: string) => encodePath(space));
          defaultMarkdownSerializer.nodes.image(state, node.type.create({ ...node.attrs, src: target }), parent, index);
        },
        parse: {
          // Data images already in a note are kept; pasted HTML ones still aren't let in.
          updateDOM(element: HTMLElement) {
            element.querySelectorAll('img[src^="data:image/"]').forEach((img) => img.setAttribute(FROM_MARKDOWN, ""));
          },
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: `img[src]:not([src^="data:"]), img[${FROM_MARKDOWN}]` }];
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      src: { default: null, parseHTML: (el: HTMLElement) => restoreImageSrc(el.getAttribute("src")) },
    };
  },

  addProseMirrorPlugins() {
    const editor = this.editor;
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        props: {
          // Images on their own get room around them; those in a sentence sit in the line.
          decorations(state) {
            const found: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isTextblock) return true;
              const name = imageParagraphClass(node);
              if (name) found.push(Decoration.node(pos, pos + node.nodeSize, { class: name }));
              return false;
            });
            return DecorationSet.create(state.doc, found);
          },
          // A screenshot or copied image becomes a file next to the note. Rich clipboard
          // content (HTML) is left to the normal paste.
          handlePaste: (_view, event) => {
            const data = event.clipboardData;
            const image = data && Array.from(data.files).find((f) => f.type.startsWith("image/"));
            const notePath = (editor.storage as any)?.paneNote?.path as string | null | undefined;
            if (!image || !notePath || data.types.includes("text/html")) return false;
            event.preventDefault();
            void addPastedImage(editor, notePath, image);
            return true;
          },
          handleDOMEvents: {
            // Plain click on an image opens it in the lightbox; modified clicks keep selecting.
            // A linked image is a link: left to LinkBehavior, which also stops the webview navigating.
            click: (_view, event) => {
              const el = event.target as HTMLElement | null;
              if (!el || el.tagName !== "IMG" || el.classList.contains("ProseMirror-separator") || el.closest("a")) return false;
              if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
              const img = el as HTMLImageElement;
              openLightbox(img.currentSrc || img.src, img.alt);
              return true;
            },
          },
        },
      }),
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const notePath = (this.editor?.storage as any)?.paneNote?.path as string | null | undefined;
    return ["img", { ...HTMLAttributes, src: displayImageSrc(HTMLAttributes.src, notePath) }];
  },
});
