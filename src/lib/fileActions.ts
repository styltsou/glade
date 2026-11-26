import { invoke } from "@tauri-apps/api/core";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { useStore } from "@/store";
import { isAbsolutePath } from "@/lib/links";

/** A note's or folder's full path: those in the open folder are kept relative to it. */
export function absolutePathOf(path: string): string {
  if (isAbsolutePath(path)) return path;
  const root = useStore.getState().target?.path;
  return root ? `${root.replace(/\/$/, "")}/${path}` : path;
}

/** Show a note or folder in the system's file manager. */
export function revealInFileManager(path: string): void {
  invoke("plugin:opener|reveal_item_in_dir", { paths: [absolutePathOf(path)] }).catch(() => {
    toast.error("Couldn't show it in the file manager");
  });
}

/** Copy a note's or folder's full path. */
export async function copyPath(path: string): Promise<void> {
  try {
    // The webview's clipboard API is not reliably allowed; the rest of the app copies this way too.
    await writeText(absolutePathOf(path));
    toast.success("Path copied");
  } catch {
    toast.error("Couldn't copy the path");
  }
}
