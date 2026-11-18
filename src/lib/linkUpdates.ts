import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";

const MARKDOWN = /\.(md|markdown|mdx)$/i;

/**
 * After a note was renamed or moved, offer to update links to it elsewhere in
 * the open folder. Links in files outside the folder can't be found and are
 * never touched.
 */
export async function offerLinkUpdates(oldPath: string, newPath: string): Promise<boolean> {
  if (oldPath === newPath || !MARKDOWN.test(newPath)) return false;
  try {
    const { links, files } = await invoke<{ links: number; files: number }>("preview_link_updates", {
      from: oldPath,
      to: newPath,
    });
    if (links === 0) return false;
    const yes = await ask(
      `Update ${links} link${links === 1 ? "" : "s"} in ${files} note${files === 1 ? "" : "s"} so they still point at this note?`,
      { title: "Update links", kind: "info", okLabel: "Update", cancelLabel: "Leave as is" },
    );
    if (yes) await invoke("apply_link_updates", { from: oldPath, to: newPath });
    return yes;
  } catch {
    return false;
  }
}
