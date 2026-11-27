/**
 * The languages a code block can be set to: the common ones by name, with the
 * aliases people write after a fence, then every other grammar lowlight has.
 */

export type CodeLanguage = {
	/** Lowlight's grammar name; what a pick writes after the fence. */
	id: string;
	label: string;
	aliases: string[];
};

/** Shown first, in this order. Ids are lowlight grammar names. */
export const COMMON_LANGUAGES: CodeLanguage[] = [
	{ id: "bash", label: "Bash", aliases: ["sh", "zsh"] },
	{ id: "c", label: "C", aliases: ["h"] },
	{ id: "cpp", label: "C++", aliases: ["c++", "cc", "cxx", "hpp"] },
	{ id: "csharp", label: "C#", aliases: ["cs", "c#"] },
	{ id: "css", label: "CSS", aliases: [] },
	{ id: "diff", label: "Diff", aliases: ["patch"] },
	{ id: "dockerfile", label: "Dockerfile", aliases: ["docker"] },
	{ id: "go", label: "Go", aliases: ["golang"] },
	{ id: "graphql", label: "GraphQL", aliases: ["gql"] },
	{ id: "xml", label: "HTML", aliases: ["html", "xhtml", "svg", "xml"] },
	{ id: "java", label: "Java", aliases: ["jsp"] },
	{ id: "javascript", label: "JavaScript", aliases: ["js", "jsx", "mjs", "cjs"] },
	{ id: "json", label: "JSON", aliases: ["jsonc"] },
	{ id: "kotlin", label: "Kotlin", aliases: ["kt", "kts"] },
	{ id: "latex", label: "LaTeX", aliases: ["tex"] },
	{ id: "lua", label: "Lua", aliases: [] },
	{ id: "makefile", label: "Makefile", aliases: ["make", "mk"] },
	{ id: "markdown", label: "Markdown", aliases: ["md"] },
	{ id: "objectivec", label: "Objective-C", aliases: ["objc", "obj-c"] },
	{ id: "php", label: "PHP", aliases: [] },
	{ id: "powershell", label: "PowerShell", aliases: ["ps", "ps1", "pwsh"] },
	{ id: "python", label: "Python", aliases: ["py"] },
	{ id: "r", label: "R", aliases: [] },
	{ id: "ruby", label: "Ruby", aliases: ["rb"] },
	{ id: "rust", label: "Rust", aliases: ["rs"] },
	{ id: "scss", label: "SCSS", aliases: ["sass"] },
	{ id: "shell", label: "Shell session", aliases: ["console", "shellsession"] },
	{ id: "sql", label: "SQL", aliases: [] },
	{ id: "swift", label: "Swift", aliases: [] },
	{ id: "ini", label: "TOML", aliases: ["toml", "ini"] },
	{ id: "typescript", label: "TypeScript", aliases: ["ts", "tsx", "mts", "cts"] },
	{ id: "yaml", label: "YAML", aliases: ["yml"] },
];

/** Fence names that mean no language: the block is shown as plain text. */
const PLAIN = new Set(["", "text", "txt", "plaintext", "plain"]);

const byName = new Map<string, CodeLanguage>();
for (const language of COMMON_LANGUAGES) for (const alias of language.aliases) byName.set(alias, language);
// A grammar's own name wins over another's alias.
for (const language of COMMON_LANGUAGES) byName.set(language.id, language);

/** The other grammars, under their own names, for `registered` names not above. */
export function otherLanguages(registered: string[]): CodeLanguage[] {
	return registered
		.filter((id) => !byName.has(id) && !PLAIN.has(id))
		.sort()
		.map((id) => ({ id, label: id, aliases: [] }));
}

/**
 * Where typing `typed` in the list lands: the language it is an alias of
 * ("js" → JavaScript, not JSON), else the first whose name starts with it,
 * else the first whose id or an alias does, else the first whose name
 * contains it. Null when nothing matches.
 */
export function typeaheadMatch(languages: CodeLanguage[], typed: string): CodeLanguage | null {
	const query = typed.trim().toLowerCase();
	if (!query) return null;
	const tests: ((language: CodeLanguage) => boolean)[] = [
		(l) => l.id === query || l.aliases.includes(query),
		(l) => l.label.toLowerCase().startsWith(query),
		(l) => [l.id, ...l.aliases].some((name) => name.startsWith(query)),
		(l) => l.label.toLowerCase().includes(query),
	];
	for (const test of tests) {
		const found = languages.find(test);
		if (found) return found;
	}
	return null;
}

/**
 * What a fence's language names. Null for plain text; for a name not listed
 * above, itself, so the block's label still shows what the file says.
 */
export function resolveLanguage(name: string | null | undefined): CodeLanguage | null {
	const key = (name ?? "").trim().toLowerCase();
	if (PLAIN.has(key)) return null;
	return byName.get(key) ?? { id: key, label: key, aliases: [] };
}
