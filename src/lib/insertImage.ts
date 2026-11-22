import type { Editor } from "@tiptap/react";
import { invoke } from "@tauri-apps/api/core";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";
import { useStore } from "@/store";
import { isAbsolutePath, relativeLink } from "@/lib/links";

export const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"];

export const isImagePath = (p: string) => IMAGE_EXTENSIONS.includes(p.split(".").pop()?.toLowerCase() ?? "");

function noteAbsolute(notePath: string): string {
  const { target } = useStore.getState();
  return isAbsolutePath(notePath) ? notePath : `${target?.path ?? ""}/${notePath}`;
}

/** Whether a file lives inside the folder open in this window. */
function insideOpenFolder(path: string): boolean {
  const { target } = useStore.getState();
  return target?.kind === "folder" && path.startsWith(`${target.path.replace(/\/$/, "")}/`);
}

const altFor = (path: string) => (path.split("/").pop() ?? "").replace(/\.[^.]+$/, "");

/**
 * Links for image files chosen or dropped. Files inside the open folder are
 * linked where they are; for files elsewhere the user decides once whether to
 * copy them next to the note (like a paste) or link to the originals.
 */
async function hrefsFor(notePath: string, files: string[]): Promise<{ src: string; alt: string }[] | null> {
  const outside = files.filter((f) => !insideOpenFolder(f));
  let copy = false;
  if (outside.length > 0) {
    const what = outside.length === 1 ? "This image is" : `${outside.length} images are`;
    copy = await ask(`${what} outside the open folder. Copy ${outside.length === 1 ? "it" : "them"} next to the note so the note keeps working if the original moves?`, {
      title: "Add image",
      okLabel: "Copy",
      cancelLabel: "Link to original",
    });
  }
  const from = noteAbsolute(notePath);
  const out: { src: string; alt: string }[] = [];
  for (const file of files) {
    if (copy && !insideOpenFolder(file)) {
      out.push({ src: await invoke<string>("import_image_file", { note: notePath, src: file }), alt: altFor(file) });
    } else {
      out.push({ src: relativeLink(from, file), alt: altFor(file) });
    }
  }
  return out;
}

function insertImages(editor: Editor, images: { src: string; alt: string }[], pos?: number) {
  // Each on its own line; markdown can also hold them inside a sentence.
  const nodes = images.map((i) => ({ type: "paragraph", content: [{ type: "image", attrs: i }] }));
  const chain = editor.chain().focus();
  if (pos === undefined) chain.insertContent(nodes).run();
  else chain.insertContentAt(pos, nodes).run();
}

/** The slash-menu command: pick an image file. */
export async function pickImage(editor: Editor, notePath: string | null | undefined): Promise<void> {
  if (!notePath) return;
  const selected = await open({ multiple: false, filters: [{ name: "Images", extensions: IMAGE_EXTENSIONS }] });
  if (typeof selected !== "string") return;
  await addImageFiles(editor, notePath, [selected]);
}

/** Files dropped from the file manager (paths from the native drop event). */
export async function addImageFiles(editor: Editor, notePath: string, files: string[], pos?: number): Promise<void> {
  try {
    const images = await hrefsFor(notePath, files);
    if (images?.length) insertImages(editor, images, pos);
  } catch {
    toast.error("Couldn't add the image");
  }
}

/** Image data from the clipboard: saved next to the note, then linked. */
export async function addPastedImage(editor: Editor, notePath: string, file: Blob, pos?: number): Promise<void> {
  try {
    const ext = (file.type.split("/")[1] ?? "png").replace("jpeg", "jpg").replace(/\+.*$/, "");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const src = await invoke<string>("save_pasted_image", bytes, {
      headers: { "x-note": encodeURIComponent(notePath), "x-ext": ext },
    });
    insertImages(editor, [{ src, alt: "" }], pos);
  } catch {
    toast.error("Couldn't save the image");
  }
}
