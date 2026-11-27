import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useStore } from "@/store";
import type { SidebarPreview } from "@/hooks/useSidebarPreview";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "./Sidebar";

vi.mock("@/components/sidebar/PinnedSection", () => ({ PinnedSection: () => null }));
vi.mock("@/components/sidebar/TagsSection", () => ({ TagsSection: () => null }));
vi.mock("@/components/sidebar/FileTree", () => ({ FileTree: () => null }));
vi.mock("@/components/WorkspaceMenu", () => ({ WorkspaceMenu: () => null }));

const initial = useStore.getState();
let host: HTMLDivElement;
let root: Root;

const preview = (open: boolean): SidebarPreview => ({ open, enter: vi.fn(), leave: vi.fn(), dismiss: vi.fn() });
const render = (open: boolean) => act(() => root.render(<TooltipProvider><Sidebar sidebarPreview={preview(open)} /></TooltipProvider>));
const setCollapsed = (sidebarCollapsed: boolean) => act(() => useStore.setState({ sidebarCollapsed }));
const aside = () => host.querySelector("aside")!;
const panel = () => host.querySelector<HTMLElement>("aside > [data-sidebar-preview-zone]:last-child")!;
const looksFloating = () => panel().classList.contains("shadow-xl");

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  const noop = async () => {};
  useStore.setState({
    sidebarCollapsed: false,
    sidebarWidth: 240,
    loadVault: noop,
    loadTags: noop,
    loadSidebarState: noop,
    loadAll: noop,
  } as never);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  useStore.setState(initial, true);
});

it("closes as the docked panel, wiped by the aside, never as the floating card", () => {
  render(false);
  setCollapsed(true);
  expect(looksFloating()).toBe(false);
  expect(panel().style.width).toBe("var(--sidebar-live-width, 240px)");
  expect(aside().classList.contains("overflow-hidden")).toBe(true);
  // It stays as it is while the aside closes over it, then hides in one step.
  expect(panel().style.transitionDuration).toBe("0ms");
  expect(panel().style.transitionDelay).toBe("var(--dur-sidebar)");
});

it("still floats when peeked, and fades out as the card", () => {
  render(false);
  setCollapsed(true);
  render(true);
  expect(looksFloating()).toBe(true);
  expect(panel().style.width).toBe("280px");
  // The frame's 6px gap in from the pages' top, left and bottom edges.
  expect([panel().style.left, panel().style.top, panel().style.bottom]).toEqual(["13px", "7px", "13px"]);
  expect(panel().style.opacity).toBe("1");
  expect(aside().classList.contains("overflow-hidden")).toBe(false);

  render(false);
  expect(looksFloating()).toBe(true);
  expect(panel().style.opacity).toBe("0");
  expect(aside().classList.contains("overflow-hidden")).toBe(false);
});

it("docks again when reopened, and the next close is a wipe again", () => {
  render(false);
  setCollapsed(true);
  render(true);
  setCollapsed(false);
  expect(looksFloating()).toBe(false);
  expect([panel().style.left, panel().style.top, panel().style.bottom]).toEqual(["0px", "0px", "0px"]);
  render(false);
  setCollapsed(true);
  expect(looksFloating()).toBe(false);
  expect(aside().classList.contains("overflow-hidden")).toBe(true);
});
