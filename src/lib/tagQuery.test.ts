import { describe, expect, it } from "vitest";
import { isTagQuery, matchesTagQuery, parseTagQuery, tagToken } from "./tagQuery";

describe("parseTagQuery", () => {
  it("leaves plain text alone", () => {
    expect(parseTagQuery("meeting notes")).toEqual({ tags: [], partial: null, rest: "meeting notes" });
  });

  it("treats a tag at the end as still being typed", () => {
    expect(parseTagQuery("tag:wo")).toEqual({ tags: [], partial: "wo", rest: "" });
    expect(parseTagQuery("tag:")).toEqual({ tags: [], partial: "", rest: "" });
  });

  it("finishes a tag once a space follows", () => {
    expect(parseTagQuery("tag:work ")).toEqual({ tags: ["work"], partial: null, rest: "" });
    expect(parseTagQuery("tag:work plan")).toEqual({ tags: ["work"], partial: null, rest: "plan" });
  });

  it("takes several tags and text around them", () => {
    expect(parseTagQuery("plan tag:a tag:b q")).toEqual({ tags: ["a", "b"], partial: null, rest: "plan q" });
  });

  it("reads quoted tags with spaces", () => {
    expect(parseTagQuery('tag:"deep work" ')).toEqual({ tags: ["deep work"], partial: null, rest: "" });
    expect(parseTagQuery('tag:"deep w')).toEqual({ tags: [], partial: "deep w", rest: "" });
  });

  it("ignores tag: inside a word", () => {
    expect(parseTagQuery("mytag:x")).toEqual({ tags: [], partial: null, rest: "mytag:x" });
  });
});

describe("matchesTagQuery", () => {
  it("needs every finished tag, case-insensitively", () => {
    const q = parseTagQuery("tag:Work tag:idea ");
    expect(matchesTagQuery(["work", "Idea"], q)).toBe(true);
    expect(matchesTagQuery(["work"], q)).toBe(false);
  });

  it("matches the partial tag by prefix", () => {
    const q = parseTagQuery("tag:wo");
    expect(matchesTagQuery(["work"], q)).toBe(true);
    expect(matchesTagQuery(["homework"], q)).toBe(false);
    expect(matchesTagQuery(undefined, q)).toBe(false);
  });

  it("matches anything with a bare tag:", () => {
    expect(matchesTagQuery(["x"], parseTagQuery("tag:"))).toBe(true);
  });
});

describe("helpers", () => {
  it("quotes tags with spaces", () => {
    expect(tagToken("work")).toBe("tag:work ");
    expect(tagToken("deep work")).toBe('tag:"deep work" ');
  });
  it("knows a tag query", () => {
    expect(isTagQuery(parseTagQuery("tag:a"))).toBe(true);
    expect(isTagQuery(parseTagQuery("a"))).toBe(false);
  });
});
