import { splitNoteTitle } from "./noteTitle";

/**
 * Sent by the title field when a whole note is pasted into it, for the editor
 * showing that note to take the body. The editor that does sets `handled`,
 * and `done` once it has finished saving.
 */
export const PASTE_NOTE_EVENT = "glade:paste-note";

export interface PasteNoteDetail {
  path: string;
  note: PastedNote;
  /** "whole": the note was empty and is now the pasted one; "body": the rest went to the top of the body. */
  handled: "whole" | "body" | null;
  done: Promise<unknown>;
}

export interface PastedNote {
  /** What the title field gets: "" when the text has nothing that reads as a title. */
  title: string;
  /** The rest, as Markdown, for the body. */
  body: string;
  /** The whole note as a file: its H1 (if it has a title), then the body. */
  source: string;
}

/** Frontmatter belongs to properties, which a paste into the body can't carry. */
const FRONTMATTER = /^﻿?---\r?\n/;

/**
 * Whether pasted text is a note with a title of its own: Markdown with an H1
 * (`# Title`, or a line underlined with `===`). Text copied from a web page
 * comes as plain text without the `#`, so it is not one, and pastes as usual.
 */
export function hasNoteTitle(text: string): boolean {
  return !FRONTMATTER.test(text) && splitNoteTitle(text).heading !== "";
}

/**
 * The longest first line taken as a title when the text has no H1. Past it, a
 * line is a sentence or a paragraph, not a name. (An H1 is a title at any length:
 * it was marked as one.)
 */
export const MAX_TITLE_LINE = 140;

/** The text of an H1 as written: `# Title #` or `Title\n===` both give "Title". */
export function headingText(heading: string): string {
  const lines = heading.split(/\r?\n/);
  if (lines.length > 1 && /^ {0,3}=+\s*$/.test(lines[lines.length - 1])) {
    return lines.slice(0, -1).join(" ").trim();
  }
  return heading
    .replace(/^ {0,3}#\s*/, "")
    .replace(/\s+#+\s*$/, "")
    .trim();
}

/**
 * Text pasted into the title field, split into a title and a body. Null for a
 * single line, which is pasted as it is. The title is the note's H1, or, for
 * text without one, its first line.
 */
export function splitPastedNote(text: string): PastedNote | null {
  // As it would be in a file: from its first line, ending as it ended.
  const pasted = text.replace(/^(?:[ \t]*\r?\n)+/, "");
  const trimmed = pasted.replace(/\s+$/, "");
  if (!/\n/.test(trimmed) || FRONTMATTER.test(trimmed)) return null;

  const split = splitNoteTitle(trimmed);
  if (split.heading) {
    return { title: headingText(split.heading), body: split.body.trim() ? split.body : "", source: pasted };
  }
  const [first, ...rest] = trimmed.split(/\r?\n/);
  const title = titleFromLine(first);
  // Nothing that reads as a title: all of it is body, and the title stays to be typed.
  if (!title) return { title: "", body: pasted, source: pasted };
  const body = rest.join("\n").replace(/^(?:[ \t]*\n)+/, "");
  return { title, body, source: body ? `# ${title}\n\n${body}` : `# ${title}` };
}

/** Lines that start a block of their own, never a title: lists, quotes, code, tables, HTML, rules. */
const BLOCK_START = /^ {0,3}(?:[-*+]\s|\d{1,9}[.)]\s|>|```|~~~|\||<|(?:[-*_]\s*){3,}$)|^(?: {4}|\t)/;

/**
 * A first line as a title, without its Markdown: "## **Packing** list" is
 * "Packing list". Empty when the line doesn't read as one: a list item, code,
 * a table, or a sentence too long to be a name.
 */
export function titleFromLine(line: string): string {
  if (BLOCK_START.test(line)) return "";
  const text = line
    .replace(/^ {0,3}#{1,6}\s+/, "")
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]*)(?:\|([^\]]*))?\]\]/g, (_, target, label) => label ?? target)
    .replace(/(\*\*|__|~~)(.+?)\1/g, "$2")
    .replace(/(^|[^\w*])[*_](?!\s)(.+?)(?<!\s)[*_](?![\w*])/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= MAX_TITLE_LINE ? text : "";
}
