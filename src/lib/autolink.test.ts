import { describe, expect, it } from "vitest";
import { exactAutoLink, findAutoLinks, isNotePath, pointsToNote, webAddress } from "./autolink";

const linked = (text: string) => findAutoLinks(text).map((l) => text.slice(l.from, l.to));

describe("notes and files are never websites", () => {
	it.each([
		"notes.md", "NOTES.MD", "notes.md.", "(notes.md)", "'notes.md'", "notes.md:12", "notes.md:12:4",
		"notes.md#intro", "notes.md?plain=1", "docs/notes.md", "./notes.md", "../notes.md", "/home/me/notes.md",
		"~/notes.md", "C:\\notes\\a.md", "my-notes.v2.md", "σημειώσεις.md", "notes.mdx", "notes.markdown",
		"example.com.md", "someone@company.md", "my.app/notes.md", "v2.io/plan.md", "file:///x/notes.md",
		"main.rs", "main.rs:12", "install.sh", "script.py", "script.pl", "backup.zip", "Makefile.in", "src/lib.rs",
		"icon@2x.png", "ASP.NET", "Node.js", "sentence.It", "word.This", "look.at", "e.g.", "v1.2.3", "10.0.0.1",
		"10.0.0.1/24", "and/or", "@scope/pkg", "react@19.0", "git@github.com:me/repo.git", "https://", "https://...",
		"www.", "localhost", "response.data", "window.open",
	])("%s", (text) => expect(linked(text)).toEqual([]));

	it("holds for generated paths", () => {
		const names = ["a", "notes", "my-plan", "v1.2", "example.com", "x.io", "read.me", "日本", "Ω"];
		for (const dir of ["", "docs/", "a/b/", "../", "./", "v2.app/", "my.dev/"])
			for (const name of names)
				for (const ext of [".md", ".MD", ".mdx", ".markdown"])
					for (const tail of ["", "#h", ":3", ".", ")", ","])
						expect(linked(`${dir}${name}${ext}${tail}`), `${dir}${name}${ext}${tail}`).toEqual([]);
	});
});

describe("addresses link", () => {
	it.each([
		["https://example.com", "https://example.com"],
		["HTTP://Example.com/A", "HTTP://Example.com/A"],
		["https://notes.md", "https://notes.md"],
		["https://github.com/u/r/blob/main/README.md", "https://github.com/u/r/blob/main/README.md"],
		["github.com/u/r/README.md", "https://github.com/u/r/README.md"],
		["github.com/u/r/README.md#usage", "https://github.com/u/r/README.md#usage"],
		["www.notes.md", "https://www.notes.md"],
		["example.com", "https://example.com"],
		["GitHub.com/Styl", "https://GitHub.com/Styl"],
		["socket.io", "https://socket.io"],
		["bbc.co.uk", "https://bbc.co.uk"],
		["example.com:8080/x", "https://example.com:8080/x"],
		["bun.sh/docs", "https://bun.sh/docs"],
		["youtu.be/abc", "https://youtu.be/abc"],
		["docs.rs/serde", "https://docs.rs/serde"],
		["localhost:3000", "http://localhost:3000"],
		["localhost:3000/a?b=1", "http://localhost:3000/a?b=1"],
		["192.168.1.1:8080", "http://192.168.1.1:8080"],
		["http://nas:8080", "http://nas:8080"],
		["http://[::1]:3000", "http://[::1]:3000"],
		["me@gmail.com", "mailto:me@gmail.com"],
		["first.last+tag@mail.co.uk", "mailto:first.last+tag@mail.co.uk"],
		["mailto:me@x.com", "mailto:me@x.com"],
		["ελλάδα.gr", "https://ελλάδα.gr"],
	])("%s", (text, href) => expect(exactAutoLink(text)).toBe(href));
});

describe("edges of an address", () => {
	it.each([
		["see https://a.com/x.", "https://a.com/x"],
		["(see https://a.com/x),", "https://a.com/x"],
		["(https://a.com)", "https://a.com"],
		["https://en.wikipedia.org/wiki/Foo_(bar)", "https://en.wikipedia.org/wiki/Foo_(bar)"],
		["(https://en.wikipedia.org/wiki/Foo_(bar))", "https://en.wikipedia.org/wiki/Foo_(bar)"],
		["“example.com”", "example.com"],
		["'example.com'!", "example.com"],
		["<https://a.com>", "https://a.com"],
		["see:https://a.com", "https://a.com"],
		["https://a.com/r?next=https://b.com", "https://a.com/r?next=https://b.com"],
		["看https://a.com。", "https://a.com"],
		["example.com?!", "example.com"],
	])("%s", (text, address) => {
		// CJK has no word boundary before the scheme, so that one needs a space.
		expect(linked(text.replace("看", "看 "))).toEqual([address]);
	});

	it("leaves code and hand-written markdown alone", () => {
		expect(linked("`curl https://a.com")).toEqual([]);
		expect(linked("`https://a.com`")).toEqual([]);
		expect(linked("[site](https://a.com)")).toEqual([]);
		expect(linked("`x` then https://b.com")).toEqual(["https://b.com"]);
	});
});

describe("when a name could be either", () => {
	it("an existing note wins", () => {
		const isLocalNote = (path: string) => pointsToNote(path, "a/b.md", ["a/github.com/README.md"]);
		expect(exactAutoLink("github.com/README.md", isLocalNote)).toBeNull();
		expect(exactAutoLink("github.com/OTHER.md", isLocalNote)).toBe("https://github.com/OTHER.md");
	});
	it("a link field accepts short domains but still never a note", () => {
		expect(webAddress("bun.sh", { typedAsLink: true })).toBe("https://bun.sh");
		expect(webAddress("notes.md", { typedAsLink: true })).toBeNull();
	});
	it("knows a note path from an address", () => {
		expect(isNotePath("notes.md:12")).toBe(true);
		expect(isNotePath("https://x.com/notes.md")).toBe(false);
	});
});
