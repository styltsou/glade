/**
 * Renames, moves and link rewrites change files underneath open editors. They
 * all go through `changeFiles`, so that:
 *
 * - unsaved edits are written before the file changes, or nothing changes;
 * - a save that comes due meanwhile waits, then goes to where the file is now;
 * - editors follow a moved file, and show what a rewrite put in it, instead of
 *   saving their old copy over it.
 */

/** What a mounted editor exposes so files can change safely underneath it. */
export interface OpenEditor {
	path(): string | null;
	content(): string;
	unsaved(): boolean;
	/** An external-change conflict is waiting for the user. */
	blocked(): boolean;
	/** Returns how to undo it, for when the write fails. */
	markSaved(content: string): () => void;
	follow(path: string): void;
}

interface WaitingSave {
	path: string;
	run: (path: string) => Promise<void>;
	resolve: () => void;
	reject: (error: unknown) => void;
}

const editors = new Set<OpenEditor>();
const writing = new Map<Promise<void>, string>();
let waiting: WaitingSave[] = [];
let pendingChanges = 0;
let lastChange: Promise<unknown> = Promise.resolve();

/** Whether `path` is `scope` or inside it; a null scope is the whole folder. */
export function isWithin(path: string, scope: string | null): boolean {
	return scope === null || path === scope || path.startsWith(`${scope}/`);
}

/** Where `path` is after `from` (a note or folder) moved to `to`. */
export function relocatePath(path: string, from: string, to: string): string {
	return isWithin(path, from) ? `${to}${path.slice(from.length)}` : path;
}

export function registerEditor(editor: OpenEditor): () => void {
	editors.add(editor);
	return () => void editors.delete(editor);
}

function write(path: string, run: (path: string) => Promise<void>): Promise<void> {
	const done = run(path);
	writing.set(done, path);
	const forget = () => void writing.delete(done);
	done.then(forget, forget);
	return done;
}

/** Run a save now, or once the file change in progress has finished. */
export function scheduleWrite(path: string, run: (path: string) => Promise<void>): Promise<void> {
	if (pendingChanges === 0) return write(path, run);
	return new Promise((resolve, reject) => waiting.push({ path, run, resolve, reject }));
}

async function runWaiting(save: WaitingSave): Promise<void> {
	try {
		await write(save.path, save.run);
		save.resolve();
	} catch (error) {
		save.reject(error);
		throw error;
	}
}

function editorsWithin(scope: string | null): OpenEditor[] {
	return [...editors].filter((editor) => {
		const path = editor.path();
		return path !== null && isWithin(path, scope);
	});
}

function hasEdits(scope: string | null): boolean {
	return waiting.some((s) => isWithin(s.path, scope)) || editorsWithin(scope).some((e) => e.unsaved());
}

async function flush(scope: string | null, save: (path: string, content: string) => Promise<void>) {
	await Promise.all([...writing].filter(([, path]) => isWithin(path, scope)).map(([done]) => done));

	const due = waiting.filter((s) => isWithin(s.path, scope));
	waiting = waiting.filter((s) => !due.includes(s));
	for (const queued of due) await runWaiting(queued);

	for (const editor of editorsWithin(scope)) {
		const path = editor.path()!;
		if (editor.blocked()) throw new Error(`Resolve the change on disk in "${path}" first`);
		if (!editor.unsaved()) continue;
		const content = editor.content();
		// Before the write: its cache update makes the editor save whatever is
		// still unsaved, and that late save would undo the change that follows.
		const undo = editor.markSaved(content);
		try {
			await write(path, (p) => save(p, content));
		} catch (error) {
			undo();
			throw error;
		}
	}
}

interface FileChange<Note> {
	/** The note or folder that changes; null when any open note may. */
	scope: string | null;
	/**
	 * Change the files and return where `scope` is now. One that leaves it in
	 * place is run again if the user typed meanwhile, so must be repeatable.
	 */
	apply: () => Promise<string | null>;
	save: (path: string, content: string) => Promise<void>;
	read: (path: string) => Promise<Note>;
	/** Update the app's state, in one synchronous step. */
	commit: (to: string | null, notes: Map<string, Note>) => void;
}

/** Resolves to where the scope is now; rejects if nothing could be changed. */
export function changeFiles<Note extends { body: string }>(change: FileChange<Note>): Promise<string | null> {
	const { scope, apply, save, read, commit } = change;

	async function run(): Promise<string | null> {
		for (;;) {
			await flush(scope, save);
			const to = await apply();
			const moved = scope !== null && to !== null && to !== scope;
			const pathNow = (path: string) => (moved ? relocatePath(path, scope, to) : path);

			const notes = new Map<string, Note>();
			for (const path of new Set(editorsWithin(scope).map((e) => pathNow(e.path()!)))) {
				try {
					notes.set(path, await read(path));
				} catch {
					// Unreadable: the pane loads it again by itself.
				}
			}

			// Typed while the files changed. A rewrite has to be redone on top of it.
			if (!moved && hasEdits(scope)) continue;

			if (moved) {
				// No awaits from here: editors and state switch paths together.
				for (const editor of editorsWithin(scope)) {
					const from = editor.path()!;
					const path = pathNow(from);
					const note = notes.get(path);
					if (note && (editor.unsaved() || waiting.some((s) => s.path === from))) {
						notes.set(path, { ...note, body: editor.content() });
					}
					editor.follow(path);
				}
				for (const queued of waiting) queued.path = pathNow(queued.path);
			}
			commit(to, notes);
			return to;
		}
	}

	pendingChanges++;
	const result = lastChange
		.then(run)
		.finally(() => {
			if (--pendingChanges > 0) return;
			const due = waiting;
			waiting = [];
			// Each save reports its own failure to whoever asked for it.
			for (const queued of due) runWaiting(queued).catch(() => {});
		});
	lastChange = result.catch(() => {});
	return result;
}
