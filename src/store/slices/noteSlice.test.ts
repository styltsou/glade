import { beforeEach, describe, expect, it, vi } from "vitest";
import * as T from "@/lib/tabs";

const invoke = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ ask: vi.fn(async () => true), open: vi.fn() }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: toastError }) }));

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
			case "create_note": return note("Untitled.md");
			case "read_note": return note(args.path);
			case "rename_folder": return "new";
			case "rename_note": return "Renamed.md";
			case "preview_link_updates": return { links: 0, files: 0 };
			default: return [];
		}
	});
});

describe("note files", () => {
	it("opens a new note in the active tab", async () => {
		await useStore.getState().createNote();
		expect(T.activeTab(useStore.getState().tabsState).path).toBe("Untitled.md");
		expect(useStore.getState().activeNote?.path).toBe("Untitled.md");
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
		await useStore.getState().renameNote("other.md", "Renamed");
		expect(T.activeTab(useStore.getState().tabsState).path).toBe("reading.md");
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
