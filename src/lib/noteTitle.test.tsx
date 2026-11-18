import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { splitNoteTitle, restoreNoteTitle } from "./noteTitle";
import { useMarkdownFidelity } from "@/hooks/useMarkdownFidelity";

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).reverse().forEach((fn) => fn()));

function load(source: string) {
  const host = document.createElement("div");
  const root = createRoot(host);
  let fidelity!: ReturnType<typeof useMarkdownFidelity>;
  function Harness() { fidelity = useMarkdownFidelity(); return null; }
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => root.render(<Harness />));
  cleanup.push(() => act(() => root.unmount()));
  const editor = new Editor({
    extensions: [StarterKit, Markdown.configure({ html: true })],
    content: splitNoteTitle(source).body,
  });
  cleanup.push(() => editor.destroy());
  fidelity.snapshot(editor, source);
  return { editor, save: () => fidelity.getMarkdown(editor) };
}

describe("note title projection", () => {
  it.each([
    ["# Title\n\nBody\n", "Body\n"],
    ["  # Title ###\r\n\r\nBody\r\n", "Body\r\n"],
    ["Title\n=====\n\nBody\n", "Body\n"],
    ["# Title\n\n# Another H1\n", "# Another H1\n"],
    ["Intro\n\n# Title\n\nBody\n", "Intro\n\nBody\n"],
    ["Intro\n# Title\nBody\n", "Intro\n\nBody\n"],
    ["# Title", ""],
    ["# Title\r\n\r\n", ""],
    ["Body without a heading\n", "Body without a heading\n"],
  ])("hides only the title and preserves bytes on save: %s", (source, body) => {
    const projection = splitNoteTitle(source);
    expect(projection.body).toBe(body);
    expect(restoreNoteTitle(projection, body)).toBe(source);
    const { editor, save } = load(source);
    expect(editor.getText()).not.toContain("Title");
    expect(save()).toBe(source);
  });

  it("ignores code, quotes, indented code, and non-H1 headings", () => {
    const source = "```md\n# Example\n```\n\n> # Quote\n\n    # Code\n\n## Section\n";
    expect(splitNoteTitle(source).body).toBe(source);
  });

  it("keeps the original formatted title when body text changes or is undone", () => {
    const source = "# A *formatted* title ###\r\n\r\nBody\r\n";
    const { editor, save } = load(source);
    editor.commands.insertContentAt(editor.state.doc.child(0).nodeSize - 1, "!");
    expect(save()).toBe(source.replace("Body", "Body!"));
    editor.commands.undo();
    expect(save()).toBe(source);
  });

  it("preserves an H1 after an edited introductory paragraph", () => {
    const source = "Intro\n\n# Title\n\nBody\n";
    const { editor, save } = load(source);
    editor.commands.insertContentAt(6, "!");
    expect(save()).toBe(source.replace("Intro", "Intro!"));
  });

  it("preserves the title when all body content is deleted", () => {
    const { editor, save } = load("# Title\n\nBody\n");
    editor.commands.clearContent();
    expect(save()).toMatch(/^# Title\n/);
    expect(save()).not.toContain("Body");
  });

  it("keeps a raw body edit separate from the preserved title", () => {
    const title = splitNoteTitle("# Title ###\r\n\r\nBody\r\n");
    expect(restoreNoteTitle(title, "Edited\r\n")).toBe("# Title ###\r\n\r\nEdited\r\n");
  });
});
