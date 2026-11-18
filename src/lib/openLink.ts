import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useStore } from "@/store";
import { dirName } from "@/lib/paths";
import { isOpenableWebHref } from "@/lib/links";

export interface LinkInfo {
  href: string;
  kind: "web" | "anchor" | "inside" | "outside" | "missing" | "image" | "file";
  abs: string | null;
  rel: string | null;
}

export async function classifyLinks(from: string, hrefs: string[]): Promise<LinkInfo[]> {
  return invoke<LinkInfo[]>("classify_links", { from, hrefs });
}

/** Follow a link from the active note. Never executes anything. */
export async function openLink(href: string, modifier: boolean, fromPath?: string): Promise<void> {
  const store = useStore.getState();
  const from = fromPath ?? store.activeNote?.path;
  if (!from) return;

  let info: LinkInfo;
  try {
    [info] = await classifyLinks(from, [href]);
  } catch {
    return;
  }

  switch (info.kind) {
    case "web":
      if (isOpenableWebHref(href)) await openUrl(href);
      break;
    case "inside":
      store.linkNavigate(info.rel!);
      break;
    case "outside":
      // Plain click: view it here as a loose file. Modifier: open its folder.
      if (modifier) store.openPath(dirName(info.abs!));
      else store.linkNavigate(info.abs!);
      break;
    case "missing":
      if (/\.(md|markdown|mdx)$/i.test(info.abs ?? "")) {
        store.setMissingLink({ from, href, abs: info.abs!, outside: info.rel === null });
      } else {
        toast("File not found");
      }
      break;
    case "image":
    case "file":
      // Reveal in the file manager; never open or run the file.
      await invoke("plugin:opener|reveal_item_in_dir", { paths: [info.abs] }).catch(() => {});
      break;
    default:
      break;
  }
}
