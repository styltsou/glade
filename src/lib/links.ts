/** Percent-encode each path segment (spaces become %20), keeping `/`. */
export function encodePath(p: string): string {
  return p
    .split("/")
    .map((seg) => encodeURIComponent(seg).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()))
    .join("/");
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
