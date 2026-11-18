import MarkdownIt from "markdown-it";
import { joinSource, splitSource } from "./markdownFidelity";

const markdown = new MarkdownIt({ html: true });

export interface NoteTitle {
  source: string;
  body: string;
  /** Original heading, including its Markdown formatting. */
  heading: string;
  index: number;
}

/** Project the first document-level H1 into the separate title field. */
export function splitNoteTitle(source: string): NoteTitle {
  const tokens = markdown.parse(source, {});
  const heading = tokens.find((token, i) =>
    token.type === "heading_open" && token.tag === "h1" && token.level === 0 &&
    tokens[i + 1]?.content.trim(),
  );
  if (!heading?.map) return { source, body: source, heading: "", index: -1 };
  const lines = source.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const start = lines.slice(0, heading.map[0]).join("").length;
  const end = lines.slice(0, heading.map[1]).join("").length;
  const title = source.slice(start, end).replace(/\r?\n$/, "");
  const map = splitSource(source);
  const blocks = map.blocks;
  let offset = map.leading.length;
  let index = 0;
  while (index < blocks.length && offset < start) {
    offset += blocks[index].length + (map.gaps[index]?.length ?? 0);
    index++;
  }
  const before = source.slice(0, start);
  const after = source.slice(end).replace(/^(?:\r?\n)+/, "");
  // A heading can interrupt a paragraph without a blank line. Removing it
  // must not merge the paragraphs on either side into one editor block.
  const separator = before && after && !/(?:\r?\n){2}$/.test(before)
    ? (source.includes("\r\n") ? "\r\n" : "\n") : "";
  return {
    source,
    body: before + separator + after,
    heading: title,
    index,
  };
}

/** Reinsert the protected title when serializing the plain-text body. */
export function restoreNoteTitle(title: NoteTitle, body: string): string {
  if (!title.heading) return body;
  if (body === title.body) return title.source;
  const map = splitSource(body);
  const original = splitSource(title.source);
  const index = Math.min(title.index, map.blocks.length);
  const eol = title.source.includes("\r\n") ? "\r\n" : "\n";
  if (map.blocks.length === 0) {
    return original.leading + title.heading + (body || eol);
  }
  if (index === 0) map.gaps.unshift(original.gaps[title.index] || eol + eol);
  else if (index === map.blocks.length) map.gaps.push(original.gaps[title.index - 1] || eol + eol);
  else map.gaps.splice(index - 1, 1,
    original.gaps[title.index - 1] || eol + eol,
    original.gaps[title.index] || eol + eol);
  map.blocks.splice(index, 0, title.heading);
  return joinSource(map);
}

/** Keep the hidden heading near its surviving neighbours after rich edits. */
export function withNoteTitle<T extends { eq: (other: T) => boolean }>(
  nodes: T[], original: T[], heading: T, index: number,
): T[] {
  let at = index === 0 ? 0 : -1;
  for (let i = index; at < 0 && i < original.length; i++) {
    at = nodes.findIndex((node) => node === original[i] || node.eq(original[i]));
  }
  for (let i = index - 1; at < 0 && i >= 0; i--) {
    const previous = nodes.findIndex((node) => node === original[i] || node.eq(original[i]));
    if (previous >= 0) at = previous + 1;
  }
  if (at < 0) at = Math.min(index, nodes.length);
  return [...nodes.slice(0, at), heading, ...nodes.slice(at)];
}
