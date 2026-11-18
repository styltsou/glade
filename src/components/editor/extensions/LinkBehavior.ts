import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { useStore } from "@/store";
import { classifyLinks, openLink, type LinkInfo } from "@/lib/openLink";

const TTL_MS = 5000;
const cache = new Map<string, { info: LinkInfo; at: number }>();
const keyOf = (from: string, href: string) => `${from}\u0000${href}`;

const CLASS_BY_KIND: Partial<Record<LinkInfo["kind"], string>> = {
  outside: "link-outside",
  missing: "link-missing",
  file: "link-file",
};

/**
 * Link presentation and navigation: marks links to files outside the open
 * folder (↗, full path on hover), broken links, and reveal-only file links, and
 * routes clicks (read mode, or Ctrl/Cmd+click while editing).
 */
export const LinkBehavior = Extension.create({
  name: "linkBehavior",

  addProseMirrorPlugins() {
    const editor = this.editor;
    const pluginKey = new PluginKey("linkBehavior");

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init: () => 0,
          apply: (tr, value) => (tr.getMeta(pluginKey) ? value + 1 : value),
        },
        props: {
          decorations(state) {
            const from = useStore.getState().activeNote?.path;
            if (!from) return null;
            const decorations: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (!node.isText) return;
              const mark = node.marks.find((m) => m.type.name === "link");
              if (!mark) return;
              const hit = cache.get(keyOf(from, mark.attrs.href));
              const cls = hit && CLASS_BY_KIND[hit.info.kind];
              if (!hit || !cls) return;
              decorations.push(
                Decoration.inline(pos, pos + node.nodeSize, {
                  class: cls,
                  title: hit.info.kind === "missing" ? "Not found" : (hit.info.abs ?? undefined),
                }),
              );
            });
            return DecorationSet.create(state.doc, decorations);
          },

          // The DOM `click` (not ProseMirror's mouse-up `handleClick`) is what a
          // browser turns into navigation, so that is where it must be stopped.
          handleDOMEvents: {
            click(_view, event) {
              const anchor = (event.target as HTMLElement | null)?.closest("a");
              const href = anchor?.getAttribute("href");
              if (!anchor || !href) return false;
              // Never let the webview navigate to a note link itself.
              event.preventDefault();
              const modifier = event.metaKey || event.ctrlKey;
              // Plain clicks while editing just place the cursor.
              if (editor.isEditable && !modifier) return true;
              void openLink(href, modifier);
              return true;
            },
            auxclick(_view, event) {
              if ((event.target as HTMLElement | null)?.closest("a")) event.preventDefault();
              return false;
            },
          },
        },

        view(view) {
          let timer: ReturnType<typeof setTimeout> | null = null;

          const scan = async () => {
            const from = useStore.getState().activeNote?.path;
            if (!from) return;
            const wanted = new Set<string>();
            view.state.doc.descendants((node) => {
              const mark = node.isText ? node.marks.find((m) => m.type.name === "link") : undefined;
              const href = mark?.attrs.href as string | undefined;
              if (!href) return;
              const hit = cache.get(keyOf(from, href));
              if (!hit || Date.now() - hit.at > TTL_MS) wanted.add(href);
            });
            if (wanted.size === 0) return;
            try {
              const infos = await classifyLinks(from, [...wanted]);
              const now = Date.now();
              infos.forEach((info) => cache.set(keyOf(from, info.href), { info, at: now }));
              if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(pluginKey, true));
            } catch {
              // Decorations are cosmetic; ignore failures.
            }
          };

          const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(scan, 250);
          };
          schedule();

          return {
            update: (_view, prev) => {
              if (!_view.state.doc.eq(prev.doc)) schedule();
            },
            destroy: () => {
              if (timer) clearTimeout(timer);
            },
          };
        },
      }),
    ];
  },
});
