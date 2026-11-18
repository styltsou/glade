import capability from "../../src-tauri/capabilities/default.json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { WindowResizeHandles } from "./WindowResizeHandles";

const native = vi.hoisted(() => ({
  isTauri: vi.fn(),
  isMaximized: vi.fn(),
  isFullscreen: vi.fn(),
  isResizable: vi.fn(),
  onResized: vi.fn(),
  onFocusChanged: vi.fn(),
  startResizeDragging: vi.fn(),
  unlistenResize: vi.fn(),
  unlistenFocus: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ isTauri: native.isTauri }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => native }));

let host: HTMLDivElement;
let root: Root;
let resized: () => void;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  native.isTauri.mockReturnValue(true);
  native.isMaximized.mockResolvedValue(false);
  native.isFullscreen.mockResolvedValue(false);
  native.isResizable.mockResolvedValue(true);
  native.startResizeDragging.mockResolvedValue(undefined);
  native.onResized.mockImplementation((callback) => {
    resized = callback;
    return Promise.resolve(native.unlistenResize);
  });
  native.onFocusChanged.mockResolvedValue(native.unlistenFocus);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete document.documentElement.dataset.maximized;
  delete document.documentElement.dataset.fullscreen;
  vi.restoreAllMocks();
});

async function mount() {
  await act(async () => { root.render(<WindowResizeHandles />); });
}

const handles = () => [...host.querySelectorAll<HTMLElement>('[data-resize-direction]')];

describe("frameless window resizing", () => {
  it("starts a native resize in each edge and corner direction", async () => {
    await mount();
    const directions = ["North", "South", "East", "West", "NorthEast", "NorthWest", "SouthEast", "SouthWest"];
    expect(handles()).toHaveLength(8);
    for (const direction of directions) {
      const handle = host.querySelector<HTMLElement>(`[data-resize-direction="${direction}"]`)!;
      const event = new MouseEvent("mousedown", { button: 0, bubbles: true, cancelable: true });
      await act(async () => { handle.dispatchEvent(event); });
      expect(native.startResizeDragging).toHaveBeenLastCalledWith(direction);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(native.startResizeDragging).toHaveBeenCalledTimes(8);
  });

  it("does not start resizing for right or middle clicks", async () => {
    await mount();
    for (const button of [1, 2]) {
      handles()[0].dispatchEvent(new MouseEvent("mousedown", { button, bubbles: true }));
    }
    expect(native.startResizeDragging).not.toHaveBeenCalled();
  });

  it.each(["isMaximized", "isFullscreen", "isResizable"] as const)("does not cover app controls when %s prevents resizing", async (flag) => {
    native[flag].mockResolvedValue(flag !== "isResizable");
    await mount();
    expect(handles()).toHaveLength(0);
  });

  it("removes hit areas when maximized and restores them when unmaximized", async () => {
    await mount();
    native.isMaximized.mockResolvedValue(true);
    await act(async () => { resized(); });
    expect(handles()).toHaveLength(0);
    expect(document.documentElement.dataset.maximized).toBe("true");
    native.isMaximized.mockResolvedValue(false);
    await act(async () => { resized(); });
    expect(handles()).toHaveLength(8);
    expect(document.documentElement.dataset.maximized).toBe("false");
  });

  it("keeps the fullscreen frame state in sync", async () => {
    await mount();
    native.isFullscreen.mockResolvedValue(true);
    await act(async () => { resized(); });
    expect(handles()).toHaveLength(0);
    expect(document.documentElement.dataset.fullscreen).toBe("true");
  });

  it("ignores an old state response after a more recent maximize event", async () => {
    let resolveOld!: (value: boolean) => void;
    native.isMaximized.mockImplementationOnce(() => new Promise<boolean>((resolve) => { resolveOld = resolve; }));
    await mount();
    native.isMaximized.mockResolvedValue(true);
    await act(async () => { resized(); });
    await act(async () => { resolveOld(false); });
    expect(handles()).toHaveLength(0);
    expect(document.documentElement.dataset.maximized).toBe("true");
  });

  it("cleans up native listeners on unmount", async () => {
    await mount();
    await act(async () => root.render(null));
    expect(native.unlistenResize).toHaveBeenCalledOnce();
    expect(native.unlistenFocus).toHaveBeenCalledOnce();
  });

  it("does not intercept the edges in a browser preview", async () => {
    native.isTauri.mockReturnValue(false);
    await mount();
    expect(handles()).toHaveLength(0);
    expect(native.isMaximized).not.toHaveBeenCalled();
  });

  it("grants the native resize command to both main and additional windows", () => {
    expect(capability.windows).toContain("*");
    expect(capability.permissions).toContain("core:window:allow-start-resize-dragging");
  });
});
