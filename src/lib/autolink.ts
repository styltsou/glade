/**
 * The rules for what is a web address and what is a file, used by typing,
 * pasting, the link forms and link classification alike.
 *
 * - A scheme or `www.` always means web, even if the address ends in `.md`.
 * - Otherwise `.md`, `.mdx` and `.markdown` mean a note, unless the text is an
 *   unmistakable URL (`github.com/user/repo/README.md`) and no such note exists.
 * - A bare domain needs a well-known ending. Endings that double as file
 *   extensions or words (`main.rs`, `run.sh`, `look.at`) need a path or scheme.
 */

const words = (list: string) => new Set(list.split(" "));

/** Endings that are a website even on their own. */
const SITE_TLDS = words(
  "com org net edu gov io dev app ai co info biz xyz tech blog cloud gg fm tv " +
    "uk gr de fr nl eu ca au ch se es jp br cz ie nz dk fi ru cn kr",
);
/** Endings that are a website only with a path after them: `bun.sh/docs`. */
const PATH_TLDS = words(
  "sh rs so be id it me ly gl to cc at in is no us pl im la page site link online store shop news wiki design",
);
/** Endings trusted to carry a markdown file at the end of a schemeless URL. */
const MARKDOWN_HOST_TLDS = words("com org net");

const NOTE_EXTENSION = /\.(md|mdx|markdown)$/i;
const NOTE_LINE_NUMBER = /(\.(?:md|mdx|markdown))(?::\d+){1,2}$/i;

/** `notes.md:12` -> `notes.md`. */
export function stripLineNumber(text: string): string {
  return text.replace(NOTE_LINE_NUMBER, "$1");
}

/** Whether schemeless text names a markdown file. */
export function isNotePath(text: string): boolean {
  if (/^([a-z][a-z0-9+.-]*:\/\/|mailto:|www\.)/i.test(text)) return false;
  return NOTE_EXTENSION.test(stripLineNumber(text.split(/[?#]/)[0]));
}

/** Whether `path`, written in the note `from`, names one of `notes` (relative to that note or to the root). */
export function pointsToNote(path: string, from: string | null, notes: Iterable<string>): boolean {
  const clean = stripLineNumber(path.split(/[?#]/)[0]);
  const candidates = new Set([clean]);
  const dir = from?.split("/").slice(0, -1).join("/");
  if (dir) candidates.add(`${dir}/${clean}`);
  for (const note of notes) if (candidates.has(note)) return true;
  return false;
}

interface AddressOptions {
  /** The user put this in a link field, so a bare `bun.sh` may be a site. */
  typedAsLink?: boolean;
  isLocalNote?: (path: string) => boolean;
}

/** The URL `text` stands for, if the whole of it is a web or email address. */
export function webAddress(text: string, { typedAsLink, isLocalNote }: AddressOptions = {}): string | null {
  if (!text || /\s/.test(text)) return null;

  if (/^https?:\/\//i.test(text)) return /^https?:\/\/([^/?#@]*@)?(\[[\da-f:]+\]|[\p{L}\p{N}])/iu.test(text) ? text : null;
  if (/^mailto:/i.test(text)) return /^mailto:[^@]+@[^@]+\.[^@]+$/i.test(text) ? text : null;
  if (/^www\./i.test(text)) return /^www\.[\p{L}\p{N}-]+\.[\p{L}\p{N}]/iu.test(text) ? `https://${text}` : null;

  if (/^localhost(:\d{1,5}([/?#].*)?|\/.*)$/.test(text)) return `http://${text}`;
  if (/^(\d{1,3}\.){3}\d{1,3}:\d{1,5}([/?#].*)?$/.test(text)) return `http://${text}`;

  const email = /^[\p{L}\p{N}][\p{L}\p{N}._%+-]*@(?:[\p{L}\p{N}-]+\.)+(\p{Ll}+)$/u.exec(text);
  if (email) return SITE_TLDS.has(email[1]) || PATH_TLDS.has(email[1]) ? `mailto:${text}` : null;

  const domain = /^(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(\p{Ll}+)(?::\d{1,5})?([/?#].*)?$/u.exec(text);
  if (!domain) return null;
  const [, tld, rest = ""] = domain;

  if (isNotePath(text)) {
    if (!rest.startsWith("/") || !MARKDOWN_HOST_TLDS.has(tld) || isLocalNote?.(text)) return null;
  } else if (!SITE_TLDS.has(tld)) {
    if (!PATH_TLDS.has(tld) || !(typedAsLink || rest.startsWith("/"))) return null;
  }
  return `https://${text}`;
}

export interface FoundLink {
  from: number;
  to: number;
  href: string;
}

/** Stands in for inline code and non-text nodes. Never part of an address. */
export const OPAQUE = "￼";

const TOKEN = /[^\s<>"`|^￼“”«»。，、；：！？（）【】「」『』]+/gu;
const CLOSERS: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

/** Drop sentence punctuation and unmatched closing brackets from the end. */
function trimEnd(text: string): string {
  let end = text.length;
  while (end > 0) {
    const last = text[end - 1];
    if (".,;:!?'’*~…".includes(last)) end--;
    else if (last in CLOSERS) {
      const body = text.slice(0, end);
      if (body.split(CLOSERS[last]).length >= body.split(last).length) break;
      end--;
    } else break;
  }
  return text.slice(0, end);
}

/** Every address in a run of text that should become a link by itself. */
export function findAutoLinks(text: string, isLocalNote?: (path: string) => boolean): FoundLink[] {
  const found: FoundLink[] = [];
  let backticks = 0;
  let scanned = 0;

  for (const match of text.matchAll(TOKEN)) {
    const token = match[0];
    for (; scanned < match.index; scanned++) if (text[scanned] === "`") backticks++;
    // Inside code that is still being typed, or hand-written [markdown](links).
    if (backticks % 2 === 1 || token.includes("](")) continue;

    const lead = /^[([{'‘*~]*/u.exec(token)![0].length;
    const starts = [lead];
    // An address glued to a label, like `see:https://...`.
    const embedded = /(?<![\p{L}\p{N}/=@.])(https?:\/\/|www\.|mailto:)/iu.exec(token.slice(lead));
    if (embedded?.index) starts.push(lead + embedded.index);

    for (const start of starts) {
      const address = trimEnd(token.slice(start));
      const href = webAddress(address, { isLocalNote });
      if (!href) continue;
      const from = match.index + start;
      found.push({ from, to: from + address.length, href });
      break;
    }
  }
  return found;
}

/** The URL when `text` is exactly one auto-linkable address. */
export function exactAutoLink(text: string, isLocalNote?: (path: string) => boolean): string | null {
  const [link] = findAutoLinks(text, isLocalNote);
  return link && link.from === 0 && link.to === text.length ? link.href : null;
}
