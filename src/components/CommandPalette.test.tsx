import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import { CommandPalette } from "./CommandPalette";
import { PropertiesPanel } from "./editor/PropertiesPanel";
import { PaneProvider } from "./editor/PaneContext";
import { TooltipProvider } from "./ui/tooltip";
import { initialTabs, openToTheSide } from "@/lib/tabs";
import type { NoteData } from "@/types";

const initial = useStore.getState();
let host: HTMLDivElement;
let root: Root;

const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const items = () => [...document.querySelectorAll("[cmdk-item]")];
const selected = () => items().filter((el) => el.getAttribute("aria-selected") === "true").map((el) => el.textContent ?? "");
const input = () => document.querySelector<HTMLInputElement>("[cmdk-input]")!;

/** Types the way a user does, outside act, so the DOM can be read in the committed frame before later ticks. */
function typeRaw(value: string) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  set.call(input(), value);
  input().dispatchEvent(new Event("input", { bubbles: true }));
}

async function key(init: KeyboardEventInit, target: EventTarget = input()) {
  await act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  });
}

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useStore.setState({ ...initial, homeOpen: true });
});

afterEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  act(() => root.unmount());
  host.remove();
  useStore.setState(initial, true);
  vi.unstubAllGlobals();
});

async function openActions(content: ReactNode = <CommandPalette />) {
  await act(async () => {
    root.render(content);
  });
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyK", key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
  });
  await key({ key: "Tab" });
}

async function openThemes() {
  await openActions();
  await act(async () => typeRaw("change theme"));
  await key({ key: "Enter" });
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
}

/** The frame the user sees right after a keystroke, and again once everything has settled. */
async function frames(query: string) {
  typeRaw(query);
  const committed = { selected: selected(), first: items()[0]?.textContent ?? null };
  await tick(30);
  return { committed, settled: { selected: selected(), first: items()[0]?.textContent ?? null } };
}

describe("CommandPalette actions search", () => {
  it("highlights the command whose current label matches, not just its stable label", async () => {
    await openActions();
    await act(async () => typeRaw("close"));
    // Home is open, so "Go to Home" reads "Close Home" and is only found through that live label.
    expect(selected()).toHaveLength(1);
    expect(selected()[0]).toContain("Close Home");
  });

  it("matches only the label the row shows, not the stable one behind it", async () => {
    await openActions();
    // Home is open, so the row reads "Close Home"; its stable label "Go to Home" must not match "go".
    await act(async () => typeRaw("go"));
    expect(items().map((el) => el.textContent).join("|")).not.toContain("Close Home");
    await act(async () => typeRaw("cl"));
    expect(selected()[0]).toContain("Close Home");
  });

  it("has the best match highlighted in the very frame the keystroke renders", async () => {
    await openActions();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    for (const query of ["o", "op", "close", "keyboard"]) {
      const { committed, settled } = await frames(query);
      expect(committed.selected, `highlight in the first frame for "${query}"`).toHaveLength(1);
      expect(committed.selected[0]).toBe(committed.first);
      expect(settled).toEqual(committed);
    }
  });

  it("returns to the first command when the query is cleared", async () => {
    await openActions();
    const first = selected()[0];
    await act(async () => typeRaw("keyboard"));
    expect(selected()[0]).toContain("Keyboard shortcuts");
    await act(async () => typeRaw(""));
    expect(selected()).toEqual([first]);
  });
});

function setupSplitNotes() {
  const note = (path: string, title: string): NoteData => ({
    id: path, path, title, tags: [], created: null, updated: null, body: "", preview: "",
    properties: { status: "none", yaml: "", entries: [] },
  });
  const left = note("left.md", "Left note");
  const right = note("right.md", "Right note");
  useStore.setState({
    target: { kind: "folder", path: "/notes" },
    homeOpen: false,
    activeNote: right,
    noteCache: { [left.path]: left, [right.path]: right },
    tabsState: openToTheSide(initialTabs(left.path), right.path),
    propertiesOpen: false,
    addPropertyPath: null,
  });
  return { left, right };
}

describe("CommandPalette current note actions", () => {
  it("shows three default note actions together under the focused note's title", async () => {
    setupSplitNotes();
    await openActions();
    const group = [...document.querySelectorAll("[cmdk-group]")].find((el) =>
      el.querySelector("[cmdk-group-heading]")?.textContent === "Current note · Right note",
    )!;
    expect([...group.querySelectorAll("[cmdk-item]")].map((el) => el.getAttribute("data-value")))
      .toEqual(["Rename file", "Duplicate note", "Export note"]);
    expect(items().filter((el) => el.getAttribute("data-value") === "Rename file")).toHaveLength(1);
    for (const hidden of ["Add property", "Toggle table of contents", "Toggle links panel", "Toggle reading mode", "Toggle raw markdown", "Delete"]) {
      expect(items().some((el) => el.getAttribute("data-value") === hidden)).toBe(false);
    }
    expect(selected()[0]).toContain("Rename file");
  });

  it.each([
    ["property", "Add property"], ["contents", "Show table of contents"],
    ["links", "Show links panel"], ["editing", "Switch to editing mode"],
    ["raw", "Show raw markdown"], ["delete", "Delete note"],
  ])("finds the hidden note action when searching for %s", async (query, label) => {
    setupSplitNotes();
    await openActions();
    await act(async () => typeRaw(query));
    expect(items().some((el) => el.textContent?.includes(label))).toBe(true);
    expect(document.body.textContent).toContain("Current note · Right note");
    await act(async () => typeRaw(""));
    expect(items().some((el) => el.textContent?.includes(label))).toBe(false);
  });

  it("keeps hidden actions available through shortcuts for the focused note", async () => {
    const { right } = setupSplitNotes();
    await openActions();
    await key({ key: "Escape" });
    await key({ key: "e", code: "KeyE", ctrlKey: true }, window);
    expect(useStore.getState().noteEditMode[right.path]).toBe(true);
    expect(useStore.getState().noteEditMode["left.md"]).toBeUndefined();
  });

  it("sends Add property only to the focused pane and resets it when changing notes", async () => {
    const { left, right } = setupSplitNotes();
    const setProperty = vi.fn(async () => {});
    useStore.setState({ setProperty });
    const panes = (rightPath = right.path) => <>
      <section data-pane="left"><PaneProvider value={{ path: left.path }}><PropertiesPanel /></PaneProvider></section>
      <section data-pane="right"><PaneProvider value={{ path: rightPath }}><PropertiesPanel /></PaneProvider></section>
    </>;
    await openActions(<TooltipProvider>{panes()}<CommandPalette /></TooltipProvider>);
    await act(async () => typeRaw("add property"));
    await key({ key: "Enter" });
    const leftPanel = host.querySelector('[data-pane="left"]')!;
    const rightPanel = host.querySelector('[data-pane="right"]')!;
    expect(leftPanel.querySelector('input[placeholder="Name"]')).toBeNull();
    expect(rightPanel.querySelector('input[placeholder="Name"]')).not.toBeNull();
    expect(document.activeElement).toBe(rightPanel.querySelector('input[placeholder="Name"]'));
    expect(useStore.getState().addPropertyPath).toBeNull();

    const typeIn = async (placeholder: string, value: string) => {
      const field = rightPanel.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)!;
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
      return field;
    };
    await typeIn("Name", "status");
    const value = await typeIn("Value", "draft");
    await key({ key: "Enter" }, value);
    expect(setProperty).toHaveBeenCalledExactlyOnceWith("status", { kind: "scalar", value: "draft" }, right.path);

    await act(async () => useStore.getState().setAddPropertyPath(right.path));
    expect(rightPanel.querySelector('input[placeholder="Name"]')).not.toBeNull();
    await act(async () => root.render(<TooltipProvider>{panes(left.path)}<CommandPalette /></TooltipProvider>));
    expect(rightPanel.querySelector('input[placeholder="Name"]')).toBeNull();
  });

  it("keeps folder commands available without a note group on a folder overview", async () => {
    useStore.setState({ target: { kind: "folder", path: "/notes" }, homeOpen: false, currentFolder: "Projects", activeNote: null });
    await openActions();
    expect(document.body.textContent).not.toContain("Current note");
    expect(items().some((el) => el.textContent?.includes("Rename folder"))).toBe(true);
    expect(items().some((el) => el.textContent?.includes("Delete folder"))).toBe(true);
  });
});

describe("CommandPalette theme picker", () => {
  it("has the best match highlighted in the very frame the keystroke renders", async () => {
    await openThemes();
    for (const query of ["a", "ab", "gr"]) {
      const { committed, settled } = await frames(query);
      expect(committed.selected, `highlight in the first frame for "${query}"`).toHaveLength(1);
      expect(committed.selected[0]).toBe(committed.first);
      expect(settled).toEqual(committed);
    }
  });

  it("matches theme names, not the hidden value every row shares", async () => {
    await openThemes();
    const all = items().length;
    await frames("t");
    // Every value starts with "theme:"; only names containing a "t" should remain.
    expect(items().length).toBeLessThan(all);
    for (const el of items()) expect(el.textContent!.toLowerCase()).toContain("t");
  });

  it("says so when nothing matches", async () => {
    await openThemes();
    await frames("zzzzzz");
    expect(items()).toHaveLength(0);
    expect(document.body.textContent).toContain("No themes found.");
  });
});

describe("CommandPalette pointer", () => {
  const move = (target: Element, movement: number) => {
    const event = new Event("pointermove", { bubbles: true });
    Object.defineProperty(event, "movementX", { value: movement });
    Object.defineProperty(event, "movementY", { value: 0 });
    act(() => {
      target.dispatchEvent(event);
    });
  };

  it("does not pull the highlight onto the row under a parked pointer while the arrow keys are in use", async () => {
    await openActions();
    const [, second, third] = items();
    await key({ key: "ArrowDown" });
    const picked = selected();
    // The list scrolling under a still pointer makes the browser report a pointer-move with no real movement.
    move(third, 0);
    expect(selected()).toEqual(picked);

    // Once the mouse really moves, hovering selects again.
    move(second, 4);
    move(third, 4);
    expect(selected()[0]).toBe(third.textContent);
  });
});
