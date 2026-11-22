import type MarkdownIt from "markdown-it";

/*
 * Older versions escaped URLs like text when saving, leaving two forms on disk:
 *
 *   first save   <https://x.com/Foo\_(bar)>
 *   later saves  [https://x.com/Foo\\\_(bar)](https://x.com/Foo%5C_\(bar\))
 *
 * Both are undone as a note is parsed, and only when they are exactly what that
 * escaping produces. The file changes only when that block is next edited.
 */

/** The old escaping: prosemirror-markdown's text escape, restricted to `chars`. */
function oldEscape(url: string, chars: RegExp): string {
  return url.replace(chars, (char, i: number) =>
    char === "_" && /\w/.test(url[i - 1] ?? "") && /\w/.test(url[i + 1] ?? "") ? char : `\\${char}`,
  );
}

/** The URL behind a first-save `<...>` body, or null if it isn't damaged. */
function fromFirstSave(raw: string): string | null {
  if (!raw.includes("\\")) return null;
  const url = raw.replace(/\\([`*\\~[\]_])/g, "$1");
  return url !== raw && oldEscape(url, /[`*\\~[\]_]/g) === raw ? url : null;
}

/** The href behind a later-save href, or null if it isn't damaged. */
function fromLaterSave(href: string): string | null {
  if (!/%5C([*~_]|%5B|%5D|%60)/.test(href)) return null;
  // The escaping saw characters like é, not their percent-encoding.
  const seen = href
    .replace(/%5C(?=%5B|%5D|%60)/g, "")
    .replace(/%5C(?=[*~_])/g, "\\")
    .replace(/(?:%[89A-F][\dA-F])+/g, (bytes) => {
      try {
        return decodeURIComponent(bytes);
      } catch {
        return bytes;
      }
    });
  if (oldEscape(seen.replace(/\\([*~_])/g, "$1"), /[*~_]/g) !== seen) return null;
  return href.replace(/%5C(?=[*~_]|%5B|%5D|%60)/g, "");
}

const installed = new WeakSet<MarkdownIt>();

export function repairSavedUrls(md: MarkdownIt) {
  // tiptap-markdown runs setup before every parse.
  if (installed.has(md)) return;
  installed.add(md);

  md.core.ruler.push("repair_saved_urls", (state) => {
    for (const block of state.tokens) {
      const children = block.children;
      if (block.type !== "inline" || !children || !/\\|%5C/i.test(block.content)) continue;

      // markdown-it decodes an autolink's text, so the raw text is read from the source.
      const written = [...block.content.matchAll(/<([a-z][\w+.-]+:[^<>\s]*)>/gi)].map((m) => m[1]);

      children.forEach((open, i) => {
        if (open.type !== "link_open") return;
        const label = children[i + 1];
        if (label?.type !== "text" || children[i + 2]?.type !== "link_close") return;
        const href = open.attrGet("href") ?? "";

        if (open.markup === "autolink") {
          const at = written.findIndex((raw) => md.normalizeLink(raw) === href);
          if (at < 0) return;
          const [raw] = written.splice(at, 1);
          const url = fromFirstSave(raw);
          if (url) {
            open.attrSet("href", md.normalizeLink(url));
            label.content = url;
          } else if (!raw.includes("\\") && /%5C/i.test(raw)) {
            // A real %5C: shown as written, so it saves as written and never looks damaged.
            label.content = raw;
          }
        } else if (!open.attrGet("title") && label.content === md.normalizeLinkText(href)) {
          const url = fromLaterSave(href);
          if (!url) return;
          open.attrSet("href", url);
          label.content = label.content.replace(/\\([`*~[\]_])/g, "$1");
        }
      });
    }
  });
}
