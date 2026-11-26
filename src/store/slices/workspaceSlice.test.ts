import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerEditor } from "@/lib/fileChanges";
import * as T from "@/lib/tabs";

const invoke = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: toastError }) }));

import { useStore } from "@/store";

const initial = useStore.getState();
const unregister: (() => void)[] = [];
const note = (path: string) => ({
  id: path, path, title: path, body: "edited", preview: "", tags: [], created: null, updated: null,
});

beforeEach(() => {
  useStore.setState(initial, true);
  invoke.mockReset().mockImplementation(async (cmd: string, args: { path: string }) => {
    if (cmd === "read_note") return note(args.path);
    return [];
  });
  toastError.mockReset();
});

afterEach(() => {
  unregister.splice(0).forEach((remove) => remove());
});

function mountEditor(path: string, blocked = false) {
  let saved = "old";
  unregister.push(registerEditor({
    path: () => path,
    content: () => "edited",
    unsaved: () => saved !== "edited",
    blocked: () => blocked,
    markSaved: (content) => {
      const previous = saved;
      saved = content;
      return () => { saved = previous; };
    },
    follow: () => {},
  }));
}

describe("opening another root", () => {
  it("saves both panes and the old folder's UI before asking the backend to open the path", async () => {
    useStore.setState({ target: { kind: "folder", path: "/old" }, uiLoadedFor: "/old" });
    mountEditor("a.md");
    mountEditor("b.md");

    await useStore.getState().openPath("/new");

    expect(invoke.mock.calls.map(([cmd]) => cmd)).toEqual([
      "write_note", "read_note", "write_note", "read_note", "save_workspace_ui", "open_path_cmd", "get_home_data",
    ]);
    expect(invoke).toHaveBeenCalledWith("write_note", { path: "a.md", content: "edited", force: false });
    expect(invoke).toHaveBeenCalledWith("write_note", { path: "b.md", content: "edited", force: false });
    expect(invoke).toHaveBeenCalledWith("open_path_cmd", { path: "/new" });
  });

  it("keeps the current folder when unsaved edits cannot be written", async () => {
    useStore.setState({ target: { kind: "folder", path: "/old" } });
    mountEditor("a.md");
    invoke.mockRejectedValue(new Error("disk full"));

    await useStore.getState().openPath("/new");

    expect(invoke).not.toHaveBeenCalledWith("open_path_cmd", expect.anything());
    expect(useStore.getState().target?.path).toBe("/old");
    expect(toastError).toHaveBeenCalledWith("Couldn't open path", { description: "Error: disk full" });
  });

  it("keeps a conflicting editor open for resolution", async () => {
    useStore.setState({ target: { kind: "folder", path: "/old" } });
    mountEditor("a.md", true);

    await useStore.getState().openPath("/new");

    expect(invoke).not.toHaveBeenCalled();
    expect(useStore.getState().workspaceError).toContain("Resolve the change on disk");
  });

  it("leaves Home without reloading when its current folder is selected again", async () => {
    useStore.setState({ target: { kind: "folder", path: "/old" }, homeOpen: true });

    await useStore.getState().openPath("/old");

    expect(useStore.getState().homeOpen).toBe(false);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("drops the old root's closed tabs, filters, and errors when applying a new target", async () => {
    useStore.setState({
      target: { kind: "folder", path: "/old" },
      closedTabs: [{ path: "a.md" }],
      sidebarQuery: "old query",
      activeTagFilters: ["old-tag"],
      searchResults: [note("a.md")],
      workspaceError: "old error",
      vaultError: "old error",
      pollExternal: true,
    });

    await useStore.getState().applyTarget({ kind: "file", path: "/new/a.md" });

    const state = useStore.getState();
    expect(state.closedTabs).toEqual([]);
    expect(state.sidebarQuery).toBe("");
    expect(state.activeTagFilters).toEqual([]);
    expect(state.searchResults).toEqual([]);
    expect(state.workspaceError).toBeNull();
    expect(state.vaultError).toBeNull();
    expect(state.pollExternal).toBe(false);
    expect(T.activeTab(state.tabsState).path).toBe("/new/a.md");
  });

  it("ignores a note read that finishes after its root was replaced", async () => {
    useStore.setState({ target: { kind: "folder", path: "/old" } });
    let finish!: (value: ReturnType<typeof note>) => void;
    invoke.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const loading = useStore.getState().loadNote("a.md");

    await useStore.getState().applyTarget({ kind: "file", path: "/new/current.md" });
    finish(note("a.md"));
    await loading;

    expect(useStore.getState().activeNote?.path).toBe("/new/current.md");
    expect(useStore.getState().noteCache["a.md"]).toBeUndefined();
  });

  it("does not discard an empty note because a note with its name was created in the previous root", async () => {
    useStore.setState({ target: { kind: "folder", path: "/old" } });
    invoke.mockImplementationOnce(async () => note("untitled.md"));
    await useStore.getState().createNote();

    await useStore.getState().applyTarget({ kind: "file", path: "/new/current.md" });
    await useStore.getState().leaveNote("untitled.md", "");

    expect(invoke).not.toHaveBeenCalledWith("discard_empty_note", expect.anything());
  });
});
