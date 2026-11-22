import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import * as T from "@/lib/tabs";
import { TabStrip } from "./TabStrip";
import { TooltipProvider } from "@/components/ui/tooltip";

// Motion's layout measurements need a browser; exercise the real tab controls
// and store transitions here, with only those measurement wrappers replaced.
vi.mock("motion/react", async () => {
  const React = await import("react");
  return {
    useReducedMotion: () => true,
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    useIsPresent: () => true,
    motion: {
      div: (props: any) => {
        const { initial, animate, exit, transition, ...rest } = props;
        return React.createElement("div", rest);
      },
    },
  };
});

const initial = useStore.getState();
let host: HTMLDivElement;
let root: Root;
const scrollIntoView = vi.fn();

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => setTimeout(() => callback(0), 0));
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(scrollIntoView);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  useStore.setState({
    ...initial,
    activateTab: (group, id) => useStore.setState((s) => ({ tabsState: T.activateTab(s.tabsState, group, id) })),
    closeTab: (group, id) => useStore.setState((s) => ({ tabsState: T.closeTab(s.tabsState, group, id) })),
    focusGroup: (index) => useStore.setState((s) => ({ tabsState: T.focusGroup(s.tabsState, index) })),
    newTab: () => useStore.setState((s) => ({ tabsState: T.newTab(s.tabsState) })),
    splitActive: () => useStore.setState((s) => ({ tabsState: T.splitActive(s.tabsState) })),
  });
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useStore.setState(initial, true);
  scrollIntoView.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function render(paths: string[]) {
  let state = T.initialTabs(paths[0]);
  paths.slice(1).forEach((path) => { state = T.openInNewTab(state, path); });
  state = T.activateTab(state, 0, state.groups[0].tabs[0].id);
  useStore.setState({ tabsState: state });
  act(() => root.render(<TooltipProvider><TabStrip /></TooltipProvider>));
  return () => [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
}

function key(element: HTMLElement, value: string) {
  act(() => element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true })));
}

describe("editor tab controls", () => {
  it("labels tabs by filename until a title is known and shows the full path in our tooltip, not a native title", () => {
    const controls = render(["drafts/plan.md", "archive/plan.md"]);
    expect(controls().map((tab) => tab.getAttribute("aria-label"))).toEqual(["plan.md", "plan.md"]);
    expect(controls().every((tab) => !tab.title && tab.dataset.slot === "tooltip-trigger")).toBe(true);
  });

  it("labels tabs by title", () => {
    useStore.setState({ noteCache: { "drafts/plan.md": { title: "Launch plan" } as any } });
    const controls = render(["drafts/plan.md"]);
    expect(controls()[0].getAttribute("aria-label")).toBe("Launch plan");
  });

  it("moves focus and selection with arrows and Home/End, wrapping at the ends", () => {
    const controls = render(["a.md", "b.md", "c.md"]);
    expect(controls().map((tab) => tab.tabIndex)).toEqual([0, -1, -1]);
    key(controls()[0], "ArrowLeft");
    expect(controls()[2].getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(controls()[2]);
    key(controls()[2], "ArrowRight");
    expect(controls()[0].tabIndex).toBe(0);
    key(controls()[0], "End");
    expect(controls()[2].tabIndex).toBe(0);
    key(controls()[2], "Home");
    expect(controls()[0].tabIndex).toBe(0);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest", inline: "nearest", behavior: "auto" });
  });

  it("keeps each pane's tabs and New tab action independent", () => {
    let state = T.openInNewTab(T.initialTabs("left-a.md"), "left-b.md");
    state = T.openToTheSide(state, "right-a.md");
    state = T.openInNewTab(state, "right-b.md");
    useStore.setState({ tabsState: state });
    act(() => root.render(<TooltipProvider><TabStrip /></TooltipProvider>));
    const lists = host.querySelectorAll('[role="tablist"]');
    expect(lists).toHaveLength(2);
    act(() => (lists[0].querySelector('[role="tab"]') as HTMLButtonElement).click());
    expect(T.activeTabOf(useStore.getState().tabsState.groups[1]).path).toBe("right-b.md");
    const add = host.querySelectorAll<HTMLButtonElement>('[aria-label="New tab"]');
    act(() => add[1].click());
    expect(useStore.getState().tabsState.groups.map((g) => g.tabs.length)).toEqual([2, 3]);
    expect(useStore.getState().tabsState.focused).toBe(1);
  });

  it("leaves modified arrow keys available to app navigation shortcuts", () => {
    const controls = render(["a.md", "b.md"]);
    const event = new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true, cancelable: true });
    act(() => controls()[0].dispatchEvent(event));
    expect(controls()[0].getAttribute("aria-selected")).toBe("true");
    expect(event.defaultPrevented).toBe(false);
  });

  it("can close the last file with its close button, leaving no tabs", () => {
    const controls = render(["a.md"]);
    const close = host.querySelector<HTMLButtonElement>('[aria-label="Close a.md"]')!;
    act(() => close.click());
    expect(controls()).toHaveLength(0);
    expect(host.querySelector('[aria-label="New tab"]')).not.toBeNull();
  });

  it("Delete closes a tab and focuses the selected neighbour", async () => {
    const controls = render(["a.md", "b.md"]);
    key(controls()[0], "Delete");
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
    expect(controls()).toHaveLength(1);
    expect(controls()[0].getAttribute("aria-label")).toBe("b.md");
    expect(document.activeElement).toBe(controls()[0]);
  });

  it("scrolls an overflowing row with a mouse wheel while preserving zoom gestures", () => {
    render(["a.md", "b.md"]);
    const row = host.querySelector<HTMLDivElement>('[role="tablist"]')!;
    Object.defineProperty(row, "scrollWidth", { value: 1200 });
    Object.defineProperty(row, "clientWidth", { value: 300 });
    const wheel = new WheelEvent("wheel", { deltaY: 80, cancelable: true });
    row.dispatchEvent(wheel);
    expect(row.scrollLeft).toBe(80);
    expect(wheel.defaultPrevented).toBe(true);
    const zoom = new WheelEvent("wheel", { deltaY: 80, ctrlKey: true, cancelable: true });
    row.dispatchEvent(zoom);
    expect(row.scrollLeft).toBe(80);
    expect(zoom.defaultPrevented).toBe(false);
  });
});

describe("tab context menu", () => {
  it("runs the chosen action", async () => {
    const controls = render(["a.md", "b.md"]);
    const tab = controls()[1];
    await act(async () => {
      tab.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 10, clientY: 10 }));
    });
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((i) => i.textContent?.startsWith("Close tab"));
    expect(item).toBeTruthy();
    await act(async () => {
      item!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 }));
      item!.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, cancelable: true, button: 0 }));
      item!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
    });
    expect(controls()).toHaveLength(1);
  });
});
