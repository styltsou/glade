import Image from "@tiptap/extension-image";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useStore } from "@/store";
import { isAbsolutePath, relativeLink } from "@/lib/links";
import { Plugin } from "@tiptap/pm/state";
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

/**
 * Image whose stored `src` stays exactly as written in the markdown; only the
 * rendered element points at the local-image protocol.
 */
export const LocalImage = Image.extend({
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
            click: (_view, event) => {
              const el = event.target as HTMLElement | null;
              if (!el || el.tagName !== "IMG" || event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
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
