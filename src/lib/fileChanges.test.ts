import { afterEach, describe, expect, it } from "vitest";
import { changeFiles, registerEditor, relocatePath, scheduleWrite } from "./fileChanges";

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach((fn) => fn()));

/** A fake disk plus the handle a mounted editor would register. */
function setup(path: string, body: string) {
	const disk = new Map([[path, body]]);
	const editor = { path, latest: body, saved: body, blocked: false };
	cleanups.push(
		registerEditor({
			path: () => editor.path,
			content: () => editor.latest,
			unsaved: () => editor.latest !== editor.saved,
			blocked: () => editor.blocked,
			markSaved: (content) => {
				const previous = editor.saved;
				editor.saved = content;
				return () => {
					editor.saved = previous;
				};
			},
			follow: (to) => {
				editor.path = to;
			},
		}),
	);
	const save = async (p: string, content: string) => {
		if (!disk.has(p)) throw new Error(`Not found: ${p}`);
		disk.set(p, content);
	};
	const read = async (p: string) => ({ body: disk.get(p)! });
	const move = (from: string, to: string) => {
		for (const [p, content] of [...disk]) {
			const next = relocatePath(p, from, to);
			if (next === p) continue;
			disk.delete(p);
			disk.set(next, content);
		}
	};
	let shown = new Map<string, { body: string }>();
	const commit = (_to: string | null, notes: typeof shown) => {
		shown = notes;
	};
	return { disk, editor, save, read, move, commit, shown: () => shown };
}

describe("relocatePath", () => {
	it("moves a path and what is inside it, not names that only share a prefix", () => {
		expect(relocatePath("d", "d", "box/d")).toBe("box/d");
		expect(relocatePath("d/a.md", "d", "box/d")).toBe("box/d/a.md");
		expect(relocatePath("d2/a.md", "d", "box/d")).toBe("d2/a.md");
	});
});

describe("changeFiles", () => {
	it("writes unsaved edits before a folder moves and leaves nothing behind", async () => {
		const t = setup("d/a.md", "old");
		t.editor.latest = "edited";
		await changeFiles({ ...t, scope: "d", apply: async () => (t.move("d", "e"), "e") });
		expect([...t.disk]).toEqual([["e/a.md", "edited"]]);
		expect(t.editor.path).toBe("e/a.md");
	});

	it("sends a save that came due during the move to the new path", async () => {
		const t = setup("a.md", "old");
		let late!: Promise<void>;
		await changeFiles({
			...t,
			scope: "a.md",
			apply: async () => {
				t.editor.latest = "typed meanwhile";
				late = scheduleWrite("a.md", (p) => t.save(p, "typed meanwhile"));
				t.move("a.md", "b.md");
				return "b.md";
			},
		});
		await late;
		expect([...t.disk]).toEqual([["b.md", "typed meanwhile"]]);
		expect(t.shown().get("b.md")?.body).toBe("typed meanwhile");
	});

	it("waits for a save already being written", async () => {
		const t = setup("a.md", "old");
		let finish!: () => void;
		const saving = scheduleWrite("a.md", async (p) => {
			await new Promise<void>((resolve) => (finish = resolve));
			await t.save(p, "slow save");
		});
		const changed = changeFiles({ ...t, scope: "a.md", apply: async () => (t.move("a.md", "b.md"), "b.md") });
		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(t.disk.has("a.md")).toBe(true);
		finish();
		await Promise.all([saving, changed]);
		expect([...t.disk]).toEqual([["b.md", "slow save"]]);
	});

	it("redoes a rewrite on top of what was typed meanwhile", async () => {
		const t = setup("a.md", "# Old");
		let runs = 0;
		await changeFiles({
			...t,
			scope: "a.md",
			apply: async () => {
				t.disk.set("a.md", t.disk.get("a.md")!.replace("# Old", "# New"));
				if (runs++ === 0) t.editor.latest = "# Old\n\ntyped";
				return "a.md";
			},
		});
		expect(t.disk.get("a.md")).toBe("# New\n\ntyped");
		expect(t.shown().get("a.md")?.body).toBe("# New\n\ntyped");
	});

	it("marks an editor saved before the write can notify it", async () => {
		const t = setup("a.md", "old");
		t.editor.latest = "edited";
		let unsavedDuringWrite = true;
		await changeFiles({
			...t,
			scope: "a.md",
			save: async (p, content) => {
				unsavedDuringWrite = t.editor.latest !== t.editor.saved;
				await t.save(p, content);
			},
			apply: async () => "a.md",
		});
		expect(unsavedDuringWrite).toBe(false);
	});

	it("changes nothing when the edits can't be saved", async () => {
		const t = setup("a.md", "old");
		t.editor.latest = "edited";
		let applied = false;
		const result = changeFiles({
			...t,
			scope: "a.md",
			save: async () => {
				throw new Error("disk full");
			},
			apply: async () => ((applied = true), "b.md"),
		});
		await expect(result).rejects.toThrow("disk full");
		expect(applied).toBe(false);
		expect(t.editor.saved).toBe("old");
	});

	it("refuses while a conflict waits for the user", async () => {
		const t = setup("a.md", "old");
		t.editor.blocked = true;
		await expect(changeFiles({ ...t, scope: "a.md", apply: async () => "b.md" })).rejects.toThrow("Resolve");
		expect([...t.disk]).toEqual([["a.md", "old"]]);
	});

	it("lets saves through again after a failed change", async () => {
		const t = setup("a.md", "old");
		let late!: Promise<void>;
		const result = changeFiles({
			...t,
			scope: "a.md",
			apply: async () => {
				late = scheduleWrite("a.md", (p) => t.save(p, "saved"));
				throw new Error("name taken");
			},
		});
		await expect(result).rejects.toThrow("name taken");
		await late;
		expect(t.disk.get("a.md")).toBe("saved");
	});
});
