/**
 * The `tag:` filter in the command palette: `tag:work`, `tag:"deep work"`, and
 * several together (a note must have all of them). Anything else typed is
 * ordinary search text.
 */

export interface TagQuery {
  /** Tags that are finished (followed by a space, or quoted and closed). */
  tags: string[];
  /** The tag still being typed at the end of the query, if any. */
  partial: string | null;
  /** The query without its tag tokens. */
  rest: string;
}

const TOKEN = /(^|\s)tag:(?:"([^"]*)("?)|(\S*))/gi;

export function parseTagQuery(query: string): TagQuery {
  const tags: string[] = [];
  let partial: string | null = null;
  let rest = "";
  let last = 0;
  for (const match of query.matchAll(TOKEN)) {
    const start = match.index! + match[1].length;
    const end = match.index! + match[0].length;
    rest += query.slice(last, start);
    last = end;
    const quoted = match[2] !== undefined;
    const value = (quoted ? match[2] : match[4]).trim();
    // Still typing: the token runs to the end of the query and isn't closed.
    const open = end === query.length && (quoted ? match[3] === "" : true);
    if (open) partial = value;
    else if (value) tags.push(value);
  }
  rest += query.slice(last);
  return { tags, partial, rest: rest.replace(/\s+/g, " ").trim() };
}

/** What to type for a tag: quoted when it has a space. */
export function tagToken(tag: string): string {
  return /\s/.test(tag) ? `tag:"${tag}" ` : `tag:${tag} `;
}

/** Does the note carry every finished tag, and one starting with the partial one? */
export function matchesTagQuery(noteTags: string[] | undefined, q: TagQuery): boolean {
  const have = (noteTags ?? []).map((t) => t.toLowerCase());
  if (!q.tags.every((t) => have.includes(t.toLowerCase()))) return false;
  if (q.partial) {
    const p = q.partial.toLowerCase();
    if (!have.some((t) => t.startsWith(p))) return false;
  }
  return true;
}

export const isTagQuery = (q: TagQuery) => q.tags.length > 0 || q.partial !== null;
