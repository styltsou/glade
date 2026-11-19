import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { toast } from "sonner";

/**
 * Looks for a newer release once, downloads it in the background and offers a
 * restart. Stays silent when there is nothing to do or updating isn't possible
 * (dev mode, a plain binary from `bun run install:local`, no network).
 */
export async function checkForUpdates(): Promise<void> {
  if (import.meta.env.DEV) return;
  try {
    if (!(await invoke<boolean>("claim_update_check"))) return;
    const update = await check();
    if (!update) return;
    await update.download();
    toast(`Glade ${update.version} is ready`, {
      description: "Restart to use the new version.",
      duration: Infinity,
      action: {
        label: "Restart",
        onClick: async () => {
          try {
            await update.install();
            await relaunch();
          } catch (err) {
            console.error("Update install failed", err);
            toast.error("Couldn't install the update");
          }
        },
      },
    });
  } catch (err) {
    console.warn("Update check failed", err);
  }
}
