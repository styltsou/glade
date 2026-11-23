import { describe, expect, it } from "vitest";
import { hasNoteTitle, MAX_TITLE_LINE, splitPastedNote, titleFromLine } from "./pastedNote";

describe("hasNoteTitle", () => {
  it("is a note when the Markdown has an H1", () => {
    expect(hasNoteTitle("# Trip plan\n\nDay one")).toBe(true);
    expect(hasNoteTitle("Trip plan\n===\n\nDay one")).toBe(true);
    expect(hasNoteTitle("Intro\n\n# Trip plan\n\nDay one")).toBe(true);
  });

  it("is not one without an H1, or with frontmatter it can't carry", () => {
    expect(hasNoteTitle("Trip plan\n\nDay one")).toBe(false);
    expect(hasNoteTitle("## Day one\n\nBeach")).toBe(false);
    expect(hasNoteTitle("#hashtag and text")).toBe(false);
    expect(hasNoteTitle("---\ntags: [a]\n---\n# Trip plan")).toBe(false);
  });
});

describe("splitPastedNote", () => {
  it("leaves a single line to an ordinary paste", () => {
    expect(splitPastedNote("Trip plan")).toBeNull();
    expect(splitPastedNote("# Trip plan\n\n")).toBeNull();
    expect(splitPastedNote("\n\n# Trip plan")).toBeNull();
  });

  it("takes the H1 as the title and keeps the rest, as written, for the body", () => {
    expect(splitPastedNote("# Trip plan\n\n- **Day one**: beach\n- Day two\n")).toEqual({
      title: "Trip plan",
      body: "- **Day one**: beach\n- Day two",
      source: "# Trip plan\n\n- **Day one**: beach\n- Day two\n",
    });
  });

  it("reads closing hashes and underlined headings as the title text", () => {
    expect(splitPastedNote("# Trip plan ##\n\nBeach")?.title).toBe("Trip plan");
    expect(splitPastedNote("Trip plan\n=========\n\nBeach")).toMatchObject({ title: "Trip plan", body: "Beach" });
  });

  it("keeps text before the H1 in the body", () => {
    expect(splitPastedNote("Draft\n\n# Trip plan\n\nBeach")).toMatchObject({
      title: "Trip plan",
      body: "Draft\n\nBeach",
    });
  });

  it("uses the first line as the title when there is no H1", () => {
    expect(splitPastedNote("Trip plan\n\nDay one: beach")).toEqual({
      title: "Trip plan",
      body: "Day one: beach",
      source: "# Trip plan\n\nDay one: beach",
    });
    expect(splitPastedNote("## Trip plan\nBeach")?.title).toBe("Trip plan");
  });

  it("leaves frontmatter to an ordinary paste", () => {
    expect(splitPastedNote("---\ntags: [a]\n---\n# Trip plan\n\nBeach")).toBeNull();
  });
});

describe("titleFromLine", () => {
  it("drops the Markdown from a line used as a title", () => {
    expect(titleFromLine("## **Packing** list")).toBe("Packing list");
    expect(titleFromLine("A *quick* `note` on [Lisbon](https://x.pt) and [[trips|travel]]")).toBe(
      "A quick note on Lisbon and travel",
    );
    expect(titleFromLine("snake_case_name stays")).toBe("snake_case_name stays");
  });

  it("is no title for a line that starts a block, or reads as a paragraph", () => {
    for (const line of ["- socks", "* socks", "1. socks", "> quoted", "```js", "| a | b |", "<div>", "---", "    code"]) {
      expect(titleFromLine(line)).toBe("");
    }
    expect(titleFromLine("x".repeat(MAX_TITLE_LINE))).toBe("x".repeat(MAX_TITLE_LINE));
    expect(titleFromLine("x".repeat(MAX_TITLE_LINE + 1))).toBe("");
  });
});

describe("splitPastedNote without a title", () => {
  it("sends all of it to the body when the first line is not a title", () => {
    const list = "- socks\n- hat\n";
    expect(splitPastedNote(list)).toEqual({ title: "", body: list, source: list });
    const paragraph = `${"Long opening sentence that goes on. ".repeat(5)}\n\nMore.`;
    expect(splitPastedNote(paragraph)?.title).toBe("");
  });

  it("keeps a long H1 as the title: it was marked as one", () => {
    const long = "A".repeat(MAX_TITLE_LINE + 40);
    expect(splitPastedNote(`# ${long}\n\nBody`)?.title).toBe(long);
  });
});
