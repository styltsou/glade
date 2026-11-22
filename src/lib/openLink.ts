import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { toast } from "sonner";
import { useStore } from "@/store";
import { dirName } from "@/lib/paths";
import { encodePath, isOpenableWebHref } from "@/lib/links";
import { stripLineNumber, webAddress } from "@/lib/autolink";

export interface LinkInfo {
  href: string;
  kind: "web" | "anchor" | "inside" | "outside" | "missing" | "image" | "file";
  abs: string | null;
  rel: string | null;
  /** Where a schemeless web link (`www.x.com`) really goes. */
  url?: string;
}

/**
 * What each link points at. An existing file always wins; a schemeless link to
 * nothing on disk that is clearly an address (`www.x.com`) is a web link.
 */
export async function classifyLinks(from: string, hrefs: string[]): Promise<LinkInfo[]> {
  const infos = await invoke<LinkInfo[]>("classify_links", { from, hrefs: hrefs.map(stripLineNumber) });
  return infos.map((info, i) => {
    const href = hrefs[i];
    if ((info.kind === "missing" || info.kind === "web") && !isOpenableWebHref(href)) {
      const url = webAddress(href);
      if (url) return { ...info, href, kind: "web", url };
    }
    return { ...info, href };
  });
}

/** The href to store for what was typed into a link field. */
export async function resolveTypedHref(input: string, from: string | null): Promise<string> {
  const text = input.trim();
  if (isOpenableWebHref(text)) return text.replace(/\s/g, "%20");
  const url = webAddress(text, { typedAsLink: true });
  if (url) {
    if (!from) return url;
    try {
      const [info] = await classifyLinks(from, [text]);
      if (info.kind === "missing" || info.kind === "web") return url;
    } catch {
      return url;
    }
  }
  // A path: markdown can't hold spaces in a destination, and line numbers aren't part of the file.
  return stripLineNumber(text).replace(/\s+/g, (space) => encodePath(space));
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
    case "web": {
      const url = info.url ?? href;
      if (isOpenableWebHref(url)) await openUrl(url);
      break;
    }
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
        store.setMissingLink({ from, href: stripLineNumber(href), abs: info.abs!, outside: info.rel === null });
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
