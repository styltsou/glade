/**
 * Characters that can't be read as themselves in a link: spaces of every kind,
 * invisible and control characters. Zero-width (non-)joiners are part of how
 * Persian and Indic words are spelled, so they stay.
 */
const UNREADABLE = /(?![\u200C\u200D])[\p{Z}\p{C}]/u;

const isReadable = (char: string) => char.codePointAt(0)! > 0x7f && !UNREADABLE.test(char);

/**
 * A path as a link destination: letters of any script as they are, whatever
 * markdown or URLs give a meaning to percent-encoded (a space is %20).
 */
export function encodePath(p: string): string {
  return p.replace(/[^\w./~-]/gu, (char) =>
    isReadable(char)
      ? char
      : encodeURIComponent(char).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()),
  );
}

/** One percent-encoded character beyond ASCII. */
const ENCODED_CHARACTER = /%[cd][\da-f]%[89ab][\da-f]|%e[\da-f](?:%[89ab][\da-f]){2}|%f[0-4](?:%[89ab][\da-f]){3}/gi;

/**
 * A link to a file as it should be written and shown: `σημειώσεις.md`, not
 * `%CF%83...`. Markdown parsing encodes these, so this undoes it on the way
 * out. Only readable non-ASCII characters are decoded, so the target is the
 * same. Web addresses are left exactly as they are.
 */
export function readableHref(href: string): string {
  if (/^(?!file:)[a-z][a-z\d+.-]+:|^\/\/|^www\./i.test(href)) return href;
  return href.replace(ENCODED_CHARACTER, (encoded) => {
    try {
      const char = decodeURIComponent(encoded);
      return isReadable(char) ? char : encoded;
    } catch {
      return encoded; // not UTF-8
    }
  });
}

export function isAbsolutePath(p: string): boolean {
  return p.startsWith("/") || /^[A-Za-z]:[\\/]/.test(p);
}

/** Standard relative markdown link from one file to another (same root or both absolute). */
export function relativeLink(fromFile: string, toFile: string): string {
  const from = fromFile.split("/").slice(0, -1);
  const to = toFile.split("/");
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  const parts = [...from.slice(i).map(() => ".."), ...to.slice(i)];
  return encodePath(parts.join("/"));
}

/**
 * Whether a link target may be kept in a note. Relative and absolute paths are
 * always fine (TipTap's own check wrongly rejects paths like `docs/a.md`, whose
 * first segment is letters followed by a slash); anything with a scheme must
 * pass TipTap's default allow-list (http, mailto, ...), so `javascript:` etc.
 * stay out.
 */
export function isAllowedLinkHref(url: string, defaultValidate: (url: string) => boolean): boolean {
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(url.trim());
  return hasScheme ? defaultValidate(url) : true;
}

/** Only these schemes may be opened in the system browser. */
export function isOpenableWebHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href.trim());
}
