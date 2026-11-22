import { Extension } from "@tiptap/core";
import type { Mark, Node as PMNode } from "@tiptap/pm/model";
import { Fragment, Slice } from "@tiptap/pm/model";
import { isHistoryTransaction } from "@tiptap/pm/history";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { exactAutoLink, findAutoLinks, isNotePath, OPAQUE } from "@/lib/autolink";
import { paneNotePath } from "./PaneNote";

interface AutoLinkOptions {
  /** Whether schemeless text, written in the note `from`, names an existing note. */
  isLocalNote: (path: string, from: string | null) => boolean;
}

interface LinkRun {
  from: number;
  to: number;
  text: string;
  mark: Mark;
}

/** A textblock's text with one character per position; code and inline nodes are opaque. */
function readableText(block: PMNode): string {
  let text = "";
  block.forEach((child) => {
    const opaque = !child.isText || child.marks.some((m) => m.type.spec.code);
    text += opaque ? OPAQUE.repeat(child.nodeSize) : child.text;
  });
  return text;
}

/** The links in a textblock whose content starts at `start`. */
function linksIn(block: PMNode, start: number): LinkRun[] {
  const runs: LinkRun[] = [];
  block.forEach((child, offset) => {
    const mark = child.marks.find((m) => m.type.name === "link");
    if (!mark) return;
    const from = start + offset;
    const last = runs[runs.length - 1];
    if (last && last.to === from && last.mark.eq(mark)) {
      last.to += child.nodeSize;
      last.text += child.text ?? OPAQUE;
    } else {
      runs.push({ from, to: from + child.nodeSize, text: child.text ?? OPAQUE, mark });
    }
  });
  return runs;
}

/**
 * The range holding the words this edit finished with a space, Enter or line
 * break. Fast typing, dictation and IMEs can deliver several words in one edit.
 */
function finishedWords(before: EditorState, after: EditorState): { from: number; to: number } | null {
  if (!after.selection.empty) return null;
  const { from, to } = before.selection;
  const { $from } = after.selection;
  const grown = after.doc.content.size - before.doc.content.size;

  const length = $from.pos - from;
  if (length > 0 && length <= $from.parentOffset && grown === length - (to - from) && $from.parent.inlineContent) {
    if (length === 1 && $from.nodeBefore?.type.name === "hardBreak") return { from, to: from };
    const typed = after.doc.textBetween(from, $from.pos, undefined, OPAQUE);
    const lastSpace = typed.search(/\s\S*$/);
    if (lastSpace >= 0) return { from, to: from + lastSpace };
  }

  const split = from === to && grown > 0 && grown <= 8 && $from.parentOffset === 0 && $from.pos > from;
  if (split && before.selection.$from.parentOffset > 0 && before.doc.textContent === after.doc.textContent)
    return { from, to: from };
  return null;
}

/**
 * Turns addresses into links as you type and paste, using the rules in
 * lib/autolink. Replaces the Link extension's own autolink and paste linking,
 * which take file names for websites.
 */
export const AutoLink = Extension.create<AutoLinkOptions>({
  name: "autoLink",
  // Ahead of the markdown clipboard parser, which would read `__` in a URL as bold.
  priority: 1100,

  addOptions() {
    return { isLocalNote: () => false };
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;
    const isLocal = (path: string) => options.isLocalNote(path, paneNotePath(editor));

    /** A link that only mirrors its own text, so it may follow that text. */
    const isAutomatic = (run: LinkRun) => {
      const href = exactAutoLink(run.text);
      // Older versions linked bare domains with http://.
      return !!href && (run.mark.attrs.href === href || run.mark.attrs.href === href.replace(/^https:/, "http:"));
    };

    /** Link the addresses in one textblock that touch the range `from`..`to`. */
    const linkBlock = (tr: Transaction, block: PMNode, start: number, from: number, to: number) => {
      const type = tr.doc.type.schema.marks.link;
      if (block.type.spec.code || !block.type.allowsMarkType(type)) return;
      const existing = linksIn(block, start);

      for (const found of findAutoLinks(readableText(block), isLocal)) {
        const a = start + found.from;
        const b = start + found.to;
        if (b < from || a > to) continue;
        const overlapping = existing.filter((run) => run.from < b && run.to > a);
        // Links someone made on purpose are left alone.
        if (overlapping.some((run) => run.from < a || run.to > b || !isAutomatic(run))) continue;
        if (overlapping.length === 1 && overlapping[0].from === a && overlapping[0].to === b) continue;
        tr.addMark(a, b, type.create({ href: found.href }));
      }
    };

    /** When an automatic link's text is edited, its destination follows. */
    const followEditedLinks = (transactions: readonly Transaction[], before: EditorState, tr: Transaction) => {
      const { $from, from, to } = before.selection;
      if (!$from.parent.inlineContent) return;
      for (const old of linksIn($from.parent, $from.start())) {
        if (old.to < from || old.from > to || !isAutomatic(old)) continue;
        let a = old.from;
        let b = old.to;
        for (const t of transactions) {
          a = t.mapping.map(a, 1);
          b = t.mapping.map(b, -1);
        }
        if (b <= a) continue;
        const $a = tr.doc.resolve(a);
        if (!$a.parent.inlineContent) continue;
        const now = linksIn($a.parent, $a.start()).find((run) => run.from < b && run.to > a && run.mark.eq(old.mark));
        if (!now || now.text === old.text) continue;
        const href = exactAutoLink(now.text, isLocal);
        tr.removeMark(now.from, now.to, now.mark.type);
        if (href) tr.addMark(now.from, now.to, now.mark.type.create({ ...now.mark.attrs, href }));
      }
    };

    /** Apps often copy `notes.md` as a link to http://notes.md. */
    const dropFalseWebLinks = (tr: Transaction, from: number, to: number) => {
      tr.doc.nodesBetween(from, to, (node, pos) => {
        if (!node.isTextblock) return true;
        for (const run of linksIn(node, pos + 1)) {
          if (run.to <= from || run.from >= to || !isNotePath(run.text) || exactAutoLink(run.text, isLocal)) continue;
          const bare = String(run.mark.attrs.href).replace(/^https?:\/\//i, "").replace(/\/$/, "");
          if (bare.toLowerCase() === run.text.toLowerCase()) tr.removeMark(run.from, run.to, run.mark.type);
        }
        return false;
      });
    };

    return [
      new Plugin({
        key: new PluginKey("gladeAutoLink"),
        props: {
          clipboardTextParser(text, $context, _plain, view) {
            const address = text.trim();
            if (!exactAutoLink(address)) return null as unknown as Slice;
            const { schema } = view.state;
            const marks = $context.marks().filter((m) => m.type.name !== "link");
            const paragraph = schema.nodes.paragraph.create(null, schema.text(address, marks));
            return new Slice(Fragment.from(paragraph), 1, 1);
          },

          // An address pasted over text links that text; over another address it replaces it.
          handlePaste(view, _event, slice) {
            const { selection, doc, schema } = view.state;
            if (!(selection instanceof TextSelection) || selection.empty) return false;
            const { $from, $to, from, to } = selection;
            if (!$from.sameParent($to) || $from.parent.type.spec.code || slice.content.childCount !== 1) return false;

            const node = slice.content.child(0);
            const pasted = exactAutoLink(node.textContent.trim(), isLocal);
            if (!pasted || exactAutoLink(doc.textBetween(from, to).trim())) return false;
            if (readableText($from.parent).slice($from.parentOffset, $to.parentOffset).includes(OPAQUE)) return false;

            let href = pasted;
            node.descendants((child) => {
              const link = child.marks.find((m) => m.type.name === "link");
              if (link) href = link.attrs.href;
            });
            const tr = view.state.tr.addMark(from, to, schema.marks.link.create({ href }));
            tr.setSelection(TextSelection.create(tr.doc, to)).setMeta("preventAutolink", true);
            view.dispatch(tr);
            return true;
          },
        },

        appendTransaction(transactions, before, after) {
          if (!transactions.some((t) => t.docChanged)) return null;
          if (transactions.some((t) => t.getMeta("preventAutolink") || isHistoryTransaction(t))) return null;

          const tr = after.tr;
          followEditedLinks(transactions, before, tr);

          if (transactions.some((t) => t.getMeta("uiEvent") === "paste" || t.getMeta("uiEvent") === "drop")) {
            const from = before.doc.content.findDiffStart(after.doc.content);
            const end = before.doc.content.findDiffEnd(after.doc.content);
            if (from !== null && end) {
              // With repeated text the two diffs can cross.
              const to = end.b + Math.max(0, from - Math.min(end.a, end.b));
              dropFalseWebLinks(tr, from, to);
              tr.doc.nodesBetween(from, to, (node, pos) => {
                if (!node.isTextblock) return true;
                linkBlock(tr, node, pos + 1, from, to);
                return false;
              });
            }
          } else {
            const done = finishedWords(before, after);
            if (done) {
              const $from = tr.doc.resolve(done.from);
              const text = readableText($from.parent);
              // Back to the start of the word the edit began in.
              const from = done.from - /\S*$/.exec(text.slice(0, $from.parentOffset))![0].length;
              if (done.to > from) linkBlock(tr, $from.parent, $from.start(), from + 1, done.to);
            }
          }

          return tr.steps.length ? tr : null;
        },
      }),
    ];
  },
});
