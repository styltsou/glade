import { beforeEach, describe, expect, it, vi } from "vitest";
import * as T from "@/lib/tabs";

const invoke = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(async () => true), open: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: toastError }) }));

import { ask } from "@tauri-apps/plugin-dialog";
import { useStore } from "@/store";

const initial = useStore.getState();
const note = (path: string) => ({
	id: path, path, title: path, body: "", preview: "", tags: [], properties: [], created: null, updated: null,
});

beforeEach(() => {
	useStore.setState(initial, true);
	toastError.mockReset();
	invoke.mockReset().mockImplementation(async (cmd: string, args: any) => {
		switch (cmd) {
			case "create_note": return note("untitled.md");
			case "read_note": return note(args.path);
			case "rename_folder": return "new";
			case "rename_note_file": return "Renamed.md";
			case "name_untitled_note": return "meeting-notes.md";
			case "discard_empty_note": return true;
			case "preview_link_updates": return { links: 0, files: 0 };
			default: return [];
		}
	});
});

describe("note files", () => {
	it("opens a new note in the active tab", async () => {
		await useStore.getState().createNote();
		expect(T.activeTab(useStore.getState().tabsState).path).toBe("untitled.md");
		expect(useStore.getState().activeNote?.path).toBe("untitled.md");
	});

	it("carries open tabs and per-note state through a folder rename", async () => {
		await useStore.getState().openNote("old/a.md");
		useStore.setState({
			noteEditMode: { "old/a.md": true },
			isRawMode: { "old/a.md": true },
			expandedFolders: ["old", "older"],
		});
		await useStore.getState().renameFolder("old", "new");
		const s = useStore.getState();
		expect(T.activeTab(s.tabsState).path).toBe("new/a.md");
		expect(s.activeNote?.path).toBe("new/a.md");
		expect(s.noteEditMode).toEqual({ "new/a.md": true });
		expect(s.isRawMode).toEqual({ "new/a.md": true });
		expect(s.expandedFolders).toEqual(["new", "older"]);
	});

	it("renaming a note that isn't open leaves the active tab alone", async () => {
		await useStore.getState().openNote("reading.md");
		await useStore.getState().renameFile("other.md", "Renamed");
		expect(T.activeTab(useStore.getState().tabsState).path).toBe("reading.md");
	});

	it("starts a new note in its title, ready to edit", async () => {
		await useStore.getState().createNote();
		const s = useStore.getState();
		expect(s.focusTitlePath).toBe("untitled.md");
		expect(s.noteEditMode["untitled.md"]).toBe(true);
	});

	it("names an untitled file from its first title and fixes links without asking", async () => {
		const base = invoke.getMockImplementation()!;
		invoke.mockImplementation(async (cmd: string, args: any) =>
			cmd === "preview_link_updates" ? { links: 1, files: 1 } : base(cmd, args),
		);
		vi.mocked(ask).mockClear();
		await useStore.getState().openNote("untitled.md");
		expect(await useStore.getState().commitTitle("untitled.md", "Meeting Notes")).toBe(true);

		expect(invoke).toHaveBeenCalledWith("set_note_title", { path: "untitled.md", title: "Meeting Notes" });
		expect(T.activeTab(useStore.getState().tabsState).path).toBe("meeting-notes.md");
		await vi.waitFor(() =>
			expect(invoke).toHaveBeenCalledWith("apply_link_updates", { from: "untitled.md", to: "meeting-notes.md" }),
		);
		expect(ask).not.toHaveBeenCalled();
	});

	it("never renames a named file when its title changes", async () => {
		await useStore.getState().commitTitle("README.md", "My project");
		const commands = invoke.mock.calls.map(([cmd]) => cmd);
		expect(commands).toContain("set_note_title");
		expect(commands).not.toContain("name_untitled_note");
		expect(commands).not.toContain("rename_note_file");
	});

	it("asks before updating links after Rename file", async () => {
		const base = invoke.getMockImplementation()!;
		invoke.mockImplementation(async (cmd: string, args: any) =>
			cmd === "preview_link_updates" ? { links: 1, files: 1 } : base(cmd, args),
		);
		vi.mocked(ask).mockClear();
		expect(await useStore.getState().renameFile("other.md", "Renamed")).toBeNull();
		await vi.waitFor(() => expect(ask).toHaveBeenCalled());
	});

	it("hands a refused file name back to the dialog", async () => {
		invoke.mockImplementation(async (cmd: string) => {
			if (cmd === "rename_note_file") throw 'Invalid path: "b.md" already exists there';
			return [];
		});
		expect(await useStore.getState().renameFile("a.md", "b")).toBe('"b.md" already exists there');
		expect(toastError).not.toHaveBeenCalled();
	});

	it("says so when a move is refused, and moves no tab", async () => {
		await useStore.getState().openNote("a.md");
		invoke.mockImplementation(async (cmd: string) => {
			if (cmd === "move_entry") throw 'Invalid path: "a.md" already exists there';
			return [];
		});
		await useStore.getState().moveEntry("a.md", "f/a.md");
		expect(toastError).toHaveBeenCalledWith('Couldn\'t move "a.md"', { description: '"a.md" already exists there' });
		expect(T.activeTab(useStore.getState().tabsState).path).toBe("a.md");
	});
});

describe("leaving a note", () => {
	const closeIt = (path: string) => useStore.getState().closePathTab(path);

	it("removes a new note that was closed with nothing in it", async () => {
		await useStore.getState().createNote();
		closeIt("untitled.md");
		await useStore.getState().leaveNote("untitled.md", "\n");
		expect(invoke).toHaveBeenCalledWith("discard_empty_note", { path: "untitled.md" });
		expect(useStore.getState().noteCache["untitled.md"]).toBeUndefined();
	});

	it("waits for the last save before deciding", async () => {
		await useStore.getState().createNote();
		closeIt("untitled.md");
		let finish!: () => void;
		const saved = new Promise<void>((resolve) => (finish = resolve));
		const left = useStore.getState().leaveNote("untitled.md", "", saved);
		await Promise.resolve();
		expect(invoke).not.toHaveBeenCalledWith("discard_empty_note", expect.anything());
		finish();
		await left;
		expect(invoke).toHaveBeenCalledWith("discard_empty_note", { path: "untitled.md" });
	});

	it("keeps an empty note that is still open, or wasn't made here", async () => {
		await useStore.getState().createNote();
		await useStore.getState().leaveNote("untitled.md", "");
		await useStore.getState().leaveNote("untitled-3.md", "");
		expect(invoke).not.toHaveBeenCalledWith("discard_empty_note", expect.anything());
	});

	it("never removes a note with a name of its own", async () => {
		await useStore.getState().leaveNote("plans.md", "");
		expect(invoke).not.toHaveBeenCalledWith("discard_empty_note", expect.anything());
	});

	it("names an untitled note after the title it got in its body", async () => {
		await useStore.getState().createNote();
		closeIt("untitled.md");
		await useStore.getState().leaveNote("untitled.md", "# Meeting Notes\n\nAgenda");
		expect(invoke).toHaveBeenCalledWith("name_untitled_note", { path: "untitled.md" });
		expect(invoke).not.toHaveBeenCalledWith("discard_empty_note", expect.anything());
	});

	it("leaves an untitled note with text but no title as it is", async () => {
		await useStore.getState().createNote();
		closeIt("untitled.md");
		await useStore.getState().leaveNote("untitled.md", "Just a thought");
		expect(invoke).not.toHaveBeenCalledWith("name_untitled_note", expect.anything());
		expect(invoke).not.toHaveBeenCalledWith("discard_empty_note", expect.anything());
	});
});
