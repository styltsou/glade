import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import { CommandPalette } from "./CommandPalette";

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

async function openActions() {
  await act(async () => {
    root.render(<CommandPalette />);
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
