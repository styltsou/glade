import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { findInDoc } from "./SearchHighlight";

const schema = new Schema({
  nodes: {
    doc: { content: "block+" },
    paragraph: { group: "block", content: "inline*", toDOM: () => ["p", 0] },
    codeBlock: { group: "block", content: "text*", code: true, marks: "", toDOM: () => ["pre", 0] },
    hardBreak: { group: "inline", inline: true, selectable: false, toDOM: () => ["br"] },
    mention: { group: "inline", inline: true, atom: true, toDOM: () => ["span"] },
    text: { group: "inline" },
  },
  marks: { bold: { toDOM: () => ["strong", 0] } },
});

const p = (...content: any[]) => schema.node("paragraph", null, content);
const t = (text: string, bold = false) => schema.text(text, bold ? [schema.marks.bold.create()] : undefined);
const doc = (...blocks: any[]) => schema.node("doc", null, blocks);

/** The text of each match, to read the positions as words. */
function texts(d: ReturnType<typeof doc>, query: string, options = {}) {
  return findInDoc(d, query, options).map(({ from, to }) => d.textBetween(from, to, "|", "?"));
}

describe("findInDoc", () => {
  it("finds a match across formatting", () => {
    const d = doc(p(t("a "), t("bold", true), t(" word")));
    expect(texts(d, "a bold word")).toEqual(["a bold word"]);
    expect(texts(d, "ld w")).toEqual(["ld w"]);
  });

  it("gives positions inside the document", () => {
    const d = doc(p(t("one")), p(t("two one")));
    // The first paragraph opens at 0, its text starts at 1; the second opens at 5.
    expect(findInDoc(d, "one")).toEqual([
      { from: 1, to: 4 },
      { from: 10, to: 13 },
    ]);
  });

  it("does not join two blocks", () => {
    const d = doc(p(t("end")), p(t("start")));
    expect(texts(d, "endstart")).toEqual([]);
    expect(texts(d, "end start")).toEqual([]);
  });

  it("keeps positions right past a mention or a break", () => {
    const d = doc(p(t("see "), schema.node("mention"), t(" and foo"), schema.node("hardBreak"), t("foo")));
    const found = findInDoc(d, "foo");
    expect(found).toHaveLength(2);
    expect(texts(d, "foo")).toEqual(["foo", "foo"]);
  });

  it("never matches the stand-in for a mention", () => {
    const d = doc(p(t("a"), schema.node("mention"), t("b")));
    expect(texts(d, "ab")).toEqual([]);
    expect(texts(d, "a")).toEqual(["a"]);
  });

  it("searches code blocks", () => {
    const d = doc(schema.node("codeBlock", null, [schema.text("const foo = 1")]));
    expect(texts(d, "foo")).toEqual(["foo"]);
  });

  it("applies the options", () => {
    const d = doc(p(t("Cat concat cat")));
    expect(texts(d, "cat", { caseSensitive: true })).toEqual(["cat", "cat"]);
    expect(texts(d, "cat", { wholeWord: true })).toEqual(["Cat", "cat"]);
  });
});
