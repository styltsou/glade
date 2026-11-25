import { describe, expect, it } from "vitest";
import { noteLabel } from "./noteLabel";

describe("noteLabel", () => {
  it("shows the title, falling back to the file name without its extension", () => {
    expect(noteLabel("title", "work/plan.md", "Launch plan")).toBe("Launch plan");
    expect(noteLabel("title", "work/plan.md", "  ")).toBe("plan");
    expect(noteLabel("title", "work/plan.md")).toBe("plan");
  });

  it("shows the file name when asked, whatever the title", () => {
    expect(noteLabel("filename", "work/plan.md", "Launch plan")).toBe("plan");
    expect(noteLabel("filename", "/home/me/notes/a.b.markdown", "A")).toBe("a.b");
  });
});
