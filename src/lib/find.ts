/**
 * Plain-text search for the find bar: literal matches, optionally case-sensitive
 * and whole-word. No regex, so what you type is what is looked for.
 */

export interface FindOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
}

export interface FindRange {
  from: number;
  to: number;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The code point just before `index`, so a surrogate pair is one character. */
function charBefore(text: string, index: number): string {
  if (index <= 0) return "";
  const low = text.charCodeAt(index - 1);
  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) return text.slice(index - 2, index);
  return text[index - 1];
}

function charAt(text: string, index: number): string {
  return index < text.length ? String.fromCodePoint(text.codePointAt(index)!) : "";
}

/**
 * A matcher for one query, or null when there is nothing to look for. The
 * flags use Unicode case folding, so "ΣΟΦΟΣ" finds "σοφος" with the case option
 * off. A whole word is checked by hand: `\b` only knows ASCII letters, so it
 * would call every Greek or accented word a boundary.
 */
export function createMatcher(
  query: string,
  { caseSensitive = false, wholeWord = false }: FindOptions = {},
): ((text: string) => FindRange[]) | null {
  if (!query) return null;
  const pattern = escapeRegExp(query);
  return (text) => {
    const regex = new RegExp(pattern, caseSensitive ? "gu" : "giu");
    const found: FindRange[] = [];
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const from = m.index;
      const to = from + m[0].length;
      if (wholeWord) {
        const before = charBefore(text, from);
        const after = charAt(text, to);
        if ((before && WORD_CHAR.test(before)) || (after && WORD_CHAR.test(after))) {
          // Try again one character on, in case a later overlap is a whole word.
          regex.lastIndex = from + Math.max(1, charAt(text, from).length);
          continue;
        }
      }
      found.push({ from, to });
    }
    return found;
  };
}

/** Every match of `query` in `text`, as offsets into it. */
export function findInText(text: string, query: string, options: FindOptions = {}): FindRange[] {
  return createMatcher(query, options)?.(text) ?? [];
}

/** The index of the first match that ends after `pos`, wrapping to the first; 0 with none. */
export function firstMatchFrom(matches: FindRange[], pos: number): number {
  const i = matches.findIndex((m) => m.to > pos);
  return i === -1 ? 0 : i;
}
