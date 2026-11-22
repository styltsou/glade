import { describe, expect, it } from "vitest";
import { encodePath, isAbsolutePath, isAllowedLinkHref, isOpenableWebHref, readableHref, relativeLink } from "./links";

describe("relativeLink", () => {
  it("links to a note in a sibling folder", () => {
    expect(relativeLink("guides/intro.md", "reference/api.md")).toBe("../reference/api.md");
  });
  it("links within the same folder and into subfolders", () => {
    expect(relativeLink("a/x.md", "a/y.md")).toBe("y.md");
    expect(relativeLink("x.md", "sub/y.md")).toBe("sub/y.md");
  });
  it("encodes spaces", () => {
    expect(relativeLink("x.md", "my notes/plan.md")).toBe("my%20notes/plan.md");
  });
  it("works with absolute paths", () => {
    expect(relativeLink("/home/u/a/x.md", "/home/u/b/y.md")).toBe("../b/y.md");
  });
});

describe("isAllowedLinkHref", () => {
  const strict = (u: string) => /^(https?|mailto):/i.test(u);
  it("keeps relative paths that TipTap's default check drops", () => {
    for (const href of ["reference/api.md", "docs/a/b.md", "my%20notes/plan.md", "../x.md", "./x.md", "x.md", "/abs/x.md", "#top"]) {
      expect(isAllowedLinkHref(href, strict)).toBe(true);
    }
  });
  it("still applies the scheme allow-list", () => {
    expect(isAllowedLinkHref("https://a.dev", strict)).toBe(true);
    expect(isAllowedLinkHref("javascript:alert(1)", strict)).toBe(false);
    expect(isAllowedLinkHref("data:text/html,x", strict)).toBe(false);
  });
});

describe("readable links", () => {
  // Same cases as paths_stay_readable in links.rs: both sides must write alike.
  it.each([
    ["έργα/σημειώσεις.md", "έργα/σημειώσεις.md"],
    ["会議 メモ.md", "会議%20メモ.md"],
    ["σχέδιο (2)#1?.md", "σχέδιο%20%282%29%231%3F.md"],
    ["Cafe\u0301 🚀.md", "Cafe\u0301%20🚀.md"],
    ["می\u200cخواهم.md", "می\u200cخواهم.md"],
    ["a\u00a0b.md", "a%C2%A0b.md"],
    ["a\u3000b.md", "a%E3%80%80b.md"],
    ["a\u202eb.md", "a%E2%80%AEb.md"],
    ["50% off.md", "50%25%20off.md"],
    ["%CE%B1.md", "%25CE%25B1.md"],
  ])("writes %j as %j, and reads it back", (path, href) => {
    expect(encodePath(path)).toBe(href);
    expect(decodeURIComponent(href)).toBe(path);
    expect(readableHref(href.replace(/[^\x00-\x7f]+/g, encodeURIComponent))).toBe(href);
    expect(readableHref(href)).toBe(href);
  });

  it("decodes only readable characters beyond ASCII", () => {
    expect(readableHref("%ce%b1%20%23.md#%CE%B2")).toBe("α%20%23.md#β");
    expect(readableHref("%F0%9F%9A%80.md")).toBe("🚀.md");
    expect(readableHref("file:///home/%CE%B1.md")).toBe("file:///home/α.md");
    for (const kept of ["%25CE%25B1.md", "%E9.md", "%ED%A0%80.md", "%C0%AF.md", "a%C2%A0b.md", "a%E2%80%AEb.md"]) {
      expect(readableHref(kept)).toBe(kept);
    }
  });

  it("leaves web addresses alone", () => {
    for (const url of ["https://x.gr/%CE%B1", "mailto:%CE%B1@x.gr", "//x.gr/%CE%B1", "www.x.gr/%CE%B1"]) {
      expect(readableHref(url)).toBe(url);
    }
  });
});

describe("helpers", () => {
  it("encodes parentheses like the backend", () => {
    expect(encodePath("a (1)/b.md")).toBe("a%20%281%29/b.md");
  });
  it("detects absolute paths", () => {
    expect(isAbsolutePath("/x/y.md")).toBe(true);
    expect(isAbsolutePath("C:\\x\\y.md")).toBe(true);
    expect(isAbsolutePath("x/y.md")).toBe(false);
  });
  it("only opens safe web schemes", () => {
    expect(isOpenableWebHref("https://a.dev")).toBe(true);
    expect(isOpenableWebHref("mailto:a@b.c")).toBe(true);
    expect(isOpenableWebHref("javascript:alert(1)")).toBe(false);
    expect(isOpenableWebHref("file:///etc/passwd")).toBe(false);
  });
});
