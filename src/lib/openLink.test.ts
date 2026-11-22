import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, openUrl, store } = vi.hoisted(() => ({
	invoke: vi.fn(),
	openUrl: vi.fn(),
	store: { linkNavigate: vi.fn(), setMissingLink: vi.fn() },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));
vi.mock("@/store", () => ({ useStore: { getState: () => store } }));

import { openLink, resolveTypedHref } from "./openLink";

const onDisk = new Set(["notes.md", "github.com/real.md", "main.rs"]);

beforeEach(() => {
	vi.clearAllMocks();
	// The backend's rules: a scheme is web, anything else is looked up on disk.
	invoke.mockImplementation(async (_cmd: string, { hrefs }: { hrefs: string[] }) =>
		hrefs.map((href) => {
			if (/^[a-z][a-z0-9+.-]+:/i.test(href)) return { href, kind: "web", abs: null, rel: null };
			const kind = !onDisk.has(href) ? "missing" : /\.md$/.test(href) ? "inside" : "file";
			return { href, kind, abs: `/root/${href}`, rel: href };
		}),
	);
});

describe("resolveTypedHref", () => {
	it.each([
		["example.com", "https://example.com"],
		["www.example.com", "https://www.example.com"],
		["localhost:3000", "http://localhost:3000"],
		["bun.sh", "https://bun.sh"],
		["me@gmail.com", "mailto:me@gmail.com"],
		["github.com/u/README.md", "https://github.com/u/README.md"],
		["github.com/real.md", "github.com/real.md"],
		["main.rs", "main.rs"],
		["notes.md", "notes.md"],
		["new-note.md", "new-note.md"],
		["notes.md:12", "notes.md"],
		["my notes.md", "my%20notes.md"],
		["https://x.com/a b", "https://x.com/a%20b"],
		["#heading", "#heading"],
	])("%s -> %s", async (typed, href) => expect(await resolveTypedHref(typed, "a.md")).toBe(href));
});

describe("openLink", () => {
	it.each([
		["https://x.com/README.md", "https://x.com/README.md"],
		["www.example.com", "https://www.example.com"],
		["github.com/u/README.md", "https://github.com/u/README.md"],
		["localhost:3000", "http://localhost:3000"],
	])("opens %s in the browser", async (href, url) => {
		await openLink(href, false, "a.md");
		expect(openUrl).toHaveBeenCalledWith(url);
		expect(store.setMissingLink).not.toHaveBeenCalled();
	});

	it.each(["notes.md", "notes.md:12", "github.com/real.md"])("opens %s as a note", async (href) => {
		await openLink(href, false, "a.md");
		expect(store.linkNavigate).toHaveBeenCalled();
		expect(openUrl).not.toHaveBeenCalled();
	});

	it("offers to create a missing note instead of browsing to it", async () => {
		await openLink("new.md", false, "a.md");
		expect(store.setMissingLink).toHaveBeenCalled();
		expect(openUrl).not.toHaveBeenCalled();
	});
});
