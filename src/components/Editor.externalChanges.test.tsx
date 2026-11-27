import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { Editor } from "@tiptap/core";
import { useStore } from "@/store";
import * as T from "@/lib/tabs";
import { PaneArea } from "./PaneArea";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

// Keep the editor lifecycle, file-change banner, panes and store real. Only
// unrelated editor tools and their browser layout dependencies are left out.
vi.mock("./editor/extensions", async () => {
  const { default: StarterKit } = await import("@tiptap/starter-kit");
  const { Markdown } = await import("tiptap-markdown");
  const { PaneNote } = await import("./editor/extensions/PaneNote");
  return { extensions: [StarterKit, Markdown, PaneNote] };
});
vi.mock("./editor/blocks/blockDragHandle", async () => {
  const { Extension } = await import("@tiptap/core");
  return { createBlockDragHandleExtension: () => ({ extension: Extension.create({ name: "testBlockControls" }) }) };
});
vi.mock("./editor/blocks/BlockHandles", () => ({ BlockHandles: () => null }));
vi.mock("./editor/PreviewRail", () => ({ PreviewRail: () => null }));
vi.mock("./editor/NoteHeader", () => ({ NoteHeader: () => null }));

let editor: Editor;
vi.mock("./editor/NoteEditor", async () => {
  const { EditorContent } = await import("@tiptap/react");
  return {
    NoteEditor: (props: { editor: Editor }) => {
      editor = props.editor;
      return <EditorContent editor={props.editor} />;
    },
  };
});

const initial = useStore.getState();
const path = "/notes/loose.md";
let host: HTMLDivElement;
let root: Root;

function note(notePath: string) {
  return {
    id: notePath, path: notePath, title: "Loose note", body: "Original content",
    preview: "", tags: [], created: null, updated: null,
  };
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  useStore.setState(initial, true);
  invoke.mockReset().mockImplementation(async (command: string, args: { path: string }) => {
    if (command === "read_note") return note(args.path);
    return [];
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useStore.setState(initial, true);
});

async function openFile() {
  await import("./Editor");
  await act(async () => {
    await useStore.getState().applyTarget({ kind: "file", path });
    root.render(<PaneArea />);
  });
  // Let the editor's deferred heading update settle inside act as well.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  expect(host.textContent).toContain("Original content");
}

async function removeFile() {
  invoke.mockRejectedValue(new Error("Not found: file was moved"));
  await act(async () => {
    useStore.getState().handleExternalChange({ path, kind: "removed" });
  });
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("deleted or moved");
}

async function clickClose() {
  const close = [...host.querySelectorAll("button")].find((button) => button.textContent === "Close");
  expect(close).toBeDefined();
  await act(async () => close!.click());
}

describe("closing a file moved outside Glade", () => {
  it("closes the only tab and shows the empty pane instead of a loading skeleton", async () => {
    await openFile();
    await removeFile();
    await clickClose();

    const state = useStore.getState();
    expect(state.tabsState.groups).toHaveLength(1);
    expect(state.tabsState.groups[0].tabs).toEqual([]);
    expect(state.activeNote).toBeNull();
    expect(host.textContent).toContain("Open a note or folder");
    expect(host.textContent).not.toContain("Loading");
    expect(host.querySelector('[data-slot="skeleton"]')).toBeNull();
    expect(invoke).not.toHaveBeenCalledWith("write_note", expect.anything());
  });

  it("discards unsaved edits when closing without recreating the moved file", async () => {
    await openFile();
    await act(async () => { editor.commands.insertContent("Unsaved edit "); });
    await removeFile();
    await clickClose();

    expect(useStore.getState().tabsState.groups[0].tabs).toEqual([]);
    expect(invoke).not.toHaveBeenCalledWith("write_note", expect.anything());
  });

  it("closes the missing file's pane while keeping the other pane's note", async () => {
    await openFile();
    const otherPath = "/notes/other.md";
    await act(async () => {
      await useStore.getState().openNote(otherPath, "side");
    });
    await removeFile();
    await clickClose();

    const state = useStore.getState();
    expect(state.tabsState.groups).toHaveLength(1);
    expect(T.activeTab(state.tabsState).path).toBe(otherPath);
    expect(state.activeNote?.path).toBe(otherPath);
    expect(host.querySelector('[role="alert"]')).toBeNull();
    expect(host.querySelector('[data-slot="skeleton"]')).toBeNull();
  });
});
