import { describe, expect, it } from "vitest";
import { findInText, firstMatchFrom } from "./find";

describe("findInText", () => {
  it("finds every literal match, ignoring case by default", () => {
    expect(findInText("Foo foo FOO", "foo")).toEqual([
      { from: 0, to: 3 },
      { from: 4, to: 7 },
      { from: 8, to: 11 },
    ]);
  });

  it("matches case when asked", () => {
    expect(findInText("Foo foo FOO", "foo", { caseSensitive: true })).toEqual([{ from: 4, to: 7 }]);
  });

  it("takes the query literally, not as a pattern", () => {
    expect(findInText("a.c abc a+c", "a.c")).toEqual([{ from: 0, to: 3 }]);
    expect(findInText("a.c abc a+c", "a+c")).toEqual([{ from: 8, to: 11 }]);
    expect(findInText("(x) [y] $z", "(x)")).toEqual([{ from: 0, to: 3 }]);
  });

  it("finds nothing for an empty query", () => {
    expect(findInText("anything", "")).toEqual([]);
  });

  it("does not overlap matches", () => {
    expect(findInText("aaaa", "aa")).toEqual([
      { from: 0, to: 2 },
      { from: 2, to: 4 },
    ]);
  });

  describe("whole word", () => {
    it("skips matches inside a longer word", () => {
      expect(findInText("cat concat cats cat.", "cat", { wholeWord: true })).toEqual([
        { from: 0, to: 3 },
        { from: 16, to: 19 },
      ]);
    });

    it("treats underscores and digits as part of a word", () => {
      expect(findInText("a_b a1 a", "a", { wholeWord: true })).toEqual([{ from: 7, to: 8 }]);
    });

    it("knows letters beyond ASCII, which \\b does not", () => {
      expect(findInText("σοφός σοφός.", "σοφός", { wholeWord: true })).toHaveLength(2);
      expect(findInText("ασοφός σοφόςα", "σοφός", { wholeWord: true })).toEqual([]);
      expect(findInText("café cafés", "caf", { wholeWord: true })).toEqual([]);
    });

    it("finds a whole word that starts inside a failed match", () => {
      expect(findInText("aab ab", "ab", { wholeWord: true })).toEqual([{ from: 4, to: 6 }]);
    });
  });

  it("folds case in other alphabets", () => {
    expect(findInText("ΣΟΦΟΣ", "σοφοσ")).toHaveLength(1);
    expect(findInText("ΣΟΦΟΣ", "σοφοσ", { caseSensitive: true })).toHaveLength(0);
  });

  it("reads a letter outside the basic plane as one character", () => {
    // 𝐚 is a letter written as a surrogate pair, so it makes "b" part of a word.
    expect(findInText("𝐚b b", "b", { wholeWord: true })).toEqual([{ from: 4, to: 5 }]);
    expect(findInText("😀b", "b", { wholeWord: true })).toEqual([{ from: 2, to: 3 }]);
  });
});

describe("firstMatchFrom", () => {
  const matches = [
    { from: 2, to: 4 },
    { from: 10, to: 12 },
  ];

  it("picks the match at or after the position", () => {
    expect(firstMatchFrom(matches, 0)).toBe(0);
    expect(firstMatchFrom(matches, 2)).toBe(0);
    expect(firstMatchFrom(matches, 3)).toBe(0);
    expect(firstMatchFrom(matches, 4)).toBe(1);
  });

  it("wraps to the first, and is 0 with none", () => {
    expect(firstMatchFrom(matches, 20)).toBe(0);
    expect(firstMatchFrom([], 5)).toBe(0);
  });
});
