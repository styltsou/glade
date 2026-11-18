import { describe, expect, it } from "vitest";
import { encodePath, isAbsolutePath, isAllowedLinkHref, isOpenableWebHref, relativeLink } from "./links";

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
