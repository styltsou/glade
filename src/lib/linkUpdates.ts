import { invoke } from "@tauri-apps/api/core";
import { ask } from "@tauri-apps/plugin-dialog";
import { toast } from "sonner";

/**
 * After a note or folder was renamed or moved, offer to update links to it
 * elsewhere in the open folder. Links in files outside the folder can't be
 * found and are never touched. `run` applies the update around open editors.
 * Without `confirm` the links are updated without asking.
 */
export async function offerLinkUpdates(
  oldPath: string,
  newPath: string,
  run: (update: () => Promise<void>) => Promise<void>,
  confirm = true,
): Promise<boolean> {
  if (oldPath === newPath) return false;
  try {
    const { links, files } = await invoke<{ links: number; files: number }>("preview_link_updates", {
      from: oldPath,
      to: newPath,
    });
    if (links === 0) return false;
    if (confirm) {
      const yes = await ask(
        `Update ${links} link${links === 1 ? "" : "s"} in ${files} note${files === 1 ? "" : "s"} to the new location?`,
        { title: "Update links", kind: "info", okLabel: "Update", cancelLabel: "Leave as is" },
      );
      if (!yes) return false;
    }
  } catch {
    return false;
  }
  try {
    await run(async () => {
      await invoke("apply_link_updates", { from: oldPath, to: newPath });
    });
    return true;
  } catch (e) {
    toast.error("Couldn't update the links", { description: String(e) });
    return false;
  }
}
