import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { SearchHighlight } from "@/components/editor/SearchHighlight";
import { useNoteFind, type NoteFind } from "./useNoteFind";

let host: HTMLDivElement;
let root: Root;
let editor: Editor;
let find: NoteFind;

function Harness({ canEdit = true, focused = true, path = "a.md" }: { canEdit?: boolean; focused?: boolean; path?: string }) {
  const paneRef = createRef<HTMLDivElement>();
  find = useNoteFind({
    editor,
    path,
    isRawMode: false,
    rawContent: "",
    rawEditorRef: { current: null },
    canEdit,
    focused,
    rootRef: paneRef,
    scrollRef: { current: null },
  });
  return <div ref={(el) => ((paneRef as any).current = el)} />;
}

const render = (props: Parameters<typeof Harness>[0] = {}) => act(async () => root.render(<Harness {...props} />));
const key = (init: KeyboardEventInit) =>
  act(async () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
const ctrlF = () => key({ code: "KeyF", key: "f", ctrlKey: true });
const type = (q: string) => act(async () => find.barProps.onQueryChange(q));
const text = () => editor.state.doc.textContent;

beforeEach(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  editor = new Editor({
    extensions: [StarterKit, SearchHighlight],
    content: "<p>Foo bar foo</p><p>a <strong>bold</strong> word foo</p>",
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await render();
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  editor.destroy();
});

describe("useNoteFind", () => {
  it("opens on Ctrl+F and counts matches as you type", async () => {
    expect(find.visible).toBe(false);
    await ctrlF();
    expect(find.visible).toBe(true);
    await type("foo");
    expect(find.barProps.total).toBe(3);
    expect(find.barProps.current).toBe(1);
  });

  it("highlights through the editor and marks the current match", async () => {
    await ctrlF();
    await type("foo");
    const lit = editor.view.dom.querySelectorAll(".search-highlight, .search-highlight-active");
    expect(lit).toHaveLength(3);
    expect(editor.view.dom.querySelectorAll(".search-highlight-active")).toHaveLength(1);
    await act(async () => find.barProps.onNext());
    expect(find.barProps.current).toBe(2);
    await act(async () => find.barProps.onPrevious());
    await act(async () => find.barProps.onPrevious());
    expect(find.barProps.current).toBe(3); // wraps
  });

  it("finds across bold text", async () => {
    await ctrlF();
    await type("a bold word");
    expect(find.barProps.total).toBe(1);
  });

  it("keeps the query when closed and reopened, and clears the highlight", async () => {
    await ctrlF();
    await type("foo");
    await key({ key: "Escape" });
    expect(find.visible).toBe(false);
    expect(editor.view.dom.querySelectorAll(".search-highlight, .search-highlight-active")).toHaveLength(0);
    await ctrlF();
    expect(find.barProps.query.toLowerCase()).toBe("foo");
    expect(find.barProps.total).toBe(3);
  });

  it("keeps the query you typed when the current match is selected on close", async () => {
    await ctrlF();
    await type("FOO");
    await key({ key: "Escape" });
    await ctrlF();
    expect(find.barProps.query).toBe("FOO");
  });

  it("takes the selected text as the query", async () => {
    editor.commands.setTextSelection({ from: 1, to: 4 });
    await ctrlF();
    expect(find.barProps.query).toBe("Foo");
  });

  it("starts at the first match after the cursor", async () => {
    editor.commands.setTextSelection(12); // just after the second "foo" of the first paragraph
    await ctrlF();
    await type("foo");
    expect(find.barProps.current).toBe(3);
  });

  it("replaces one match, moves to the next, and is one undo", async () => {
    await ctrlF();
    await key({ code: "KeyH", key: "h", ctrlKey: true });
    expect(find.barProps.replace?.open).toBe(true);
    await type("foo");
    await act(async () => find.barProps.replace!.onTextChange("X"));
    await act(async () => find.barProps.replace!.onReplace());
    expect(text()).toBe("X bar fooa bold word foo");
    expect(find.barProps.total).toBe(2);
    expect(find.barProps.current).toBe(1);
    editor.commands.undo();
    expect(text()).toBe("Foo bar fooa bold word foo");
  });

  it("replaces all at once, keeping the formatting around", async () => {
    await ctrlF();
    await type("foo");
    await act(async () => find.barProps.replace!.onTextChange("quux"));
    await act(async () => find.barProps.replace!.onReplaceAll());
    expect(text()).toBe("quux bar quuxa bold word quux");
    expect(editor.getHTML()).toContain("<strong>bold</strong>");
    expect(find.barProps.total).toBe(0);
    editor.commands.undo();
    expect(text()).toBe("Foo bar fooa bold word foo");
  });

  it("does not loop when the replacement contains the query", async () => {
    await ctrlF();
    await type("foo");
    await act(async () => find.barProps.replace!.onTextChange("foofoo"));
    await act(async () => find.barProps.replace!.onReplace());
    expect(find.barProps.current).toBe(3); // the old second match, now third: it moved on past the new text
    expect(text().startsWith("foofoo bar foo")).toBe(true);
  });

  it("deleting a whole paragraph's text leaves the paragraph", async () => {
    editor.commands.setContent("<p>gone</p><p>kept</p>");
    await ctrlF();
    await type("gone");
    await act(async () => find.barProps.replace!.onTextChange(""));
    await act(async () => find.barProps.replace!.onReplaceAll());
    expect(editor.state.doc.childCount).toBe(2);
    expect(text()).toBe("kept");
  });

  it("offers no replace where the text cannot change", async () => {
    await render({ canEdit: false });
    await ctrlF();
    expect(find.barProps.replace).toBeUndefined();
    await key({ code: "KeyH", key: "h", ctrlKey: true });
    expect(find.visible).toBe(true);
  });

  it("leaves other panes and shortcuts with Shift alone", async () => {
    await render({ focused: false });
    await ctrlF();
    expect(find.visible).toBe(false);
    await render({ focused: true });
    await key({ code: "KeyF", key: "F", ctrlKey: true, shiftKey: true });
    expect(find.visible).toBe(false);
  });

  it("selects the current match when closed", async () => {
    await ctrlF();
    await type("bar");
    await key({ key: "Escape" });
    const { from, to } = editor.state.selection;
    expect(editor.state.doc.textBetween(from, to)).toBe("bar");
  });

  it("closes when the note changes", async () => {
    await ctrlF();
    await render({ path: "b.md" });
    expect(find.visible).toBe(false);
  });

  it("toggles match case from the keyboard while open", async () => {
    await ctrlF();
    await type("foo");
    expect(find.barProps.total).toBe(3);
    await key({ code: "KeyC", key: "ç", altKey: true });
    expect(find.barProps.caseSensitive).toBe(true);
    expect(find.barProps.total).toBe(2);
  });
});
