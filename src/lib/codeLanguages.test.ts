import { describe, expect, it, vi } from "vitest";
import { all } from "lowlight";
import { Editor } from "@tiptap/core";

vi.mock("@tauri-apps/api/core", () => ({
	invoke: async () => [],
	convertFileSrc: (path: string) => `glade-img://localhost/${path}`,
}));
import { extensions } from "@/components/editor/extensions";
import { COMMON_LANGUAGES, otherLanguages, resolveLanguage, typeaheadMatch } from "./codeLanguages";

describe("code languages", () => {
	it("names only grammars lowlight has", () => {
		for (const { id } of COMMON_LANGUAGES) expect(Object.keys(all)).toContain(id);
	});

	it("reads a fence's alias as its language", () => {
		expect(resolveLanguage("ts")?.label).toBe("TypeScript");
		expect(resolveLanguage("JS")?.label).toBe("JavaScript");
		expect(resolveLanguage("html")?.id).toBe("xml");
		expect(resolveLanguage("shell")?.label).toBe("Shell session");
		expect(resolveLanguage("sh")?.label).toBe("Bash");
	});

	it("takes no language, or text, as plain text", () => {
		for (const name of [null, undefined, "", "text", "txt", "plaintext"]) expect(resolveLanguage(name)).toBeNull();
	});

	it("keeps a fence name it doesn't know", () => {
		expect(resolveLanguage("vue")).toEqual({ id: "vue", label: "vue", aliases: [] });
	});

	it("lists every other grammar once, after the common ones", () => {
		const others = otherLanguages(Object.keys(all)).map((l) => l.id);
		const common = COMMON_LANGUAGES.map((l) => l.id);
		expect(others.some((id) => common.includes(id))).toBe(false);
		expect(new Set([...common, ...others]).size).toBe(common.length + others.length);
		expect(others).toContain("haskell");
		expect(others).not.toContain("plaintext");
	});

	it("moves the highlight to what is being typed", () => {
		const listed = [...COMMON_LANGUAGES, ...otherLanguages(Object.keys(all))];
		const land = (typed: string) => typeaheadMatch(listed, typed)?.label;
		expect(land("js")).toBe("JavaScript");
		expect(land("jso")).toBe("JSON");
		expect(land("ts")).toBe("TypeScript");
		expect(land("sh")).toBe("Bash");
		expect(land("shel")).toBe("Shell session");
		expect(land("c")).toBe("C");
		expect(land("c+")).toBe("C++");
		expect(land("Py")).toBe("Python");
		expect(land("java")).toBe("Java");
		expect(land("hask")).toBe("haskell");
		expect(land("script")).toBe("JavaScript");
		expect(land("zzz")).toBeUndefined();
		expect(land("")).toBeUndefined();
	});

	it("leaves a bare fence bare", () => {
		const editor = new Editor({ extensions, content: "```\nx = 1\n```\n" });
		expect(editor.state.doc.firstChild?.attrs.language).toBeNull();
		expect((editor.storage as any).markdown.getMarkdown()).toBe("```\nx = 1\n```");
		editor.commands.insertContent({ type: "codeBlock" });
		expect(editor.state.doc.lastChild?.attrs.language ?? null).toBeNull();
		editor.destroy();
	});

	it("writes a picked language after the fence, and drops it for plain text", () => {
		const editor = new Editor({ extensions, content: "```\nx = 1\n```\n" });
		const markdown = () => (editor.storage as any).markdown.getMarkdown();
		editor.commands.updateAttributes("codeBlock", { language: "python" });
		expect(markdown()).toBe("```python\nx = 1\n```");
		editor.commands.updateAttributes("codeBlock", { language: null });
		expect(markdown()).toBe("```\nx = 1\n```");
		editor.destroy();
	});
});
