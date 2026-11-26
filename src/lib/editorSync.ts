/**
 * Whether the editor should be given a note's stored body again.
 *
 * Only when the note changed, or when its body is not what the editor last
 * loaded or saved: a reload from disk. Anything else leaves the editor alone,
 * above all its own save coming back (the body is then what was just written)
 * and unrelated store changes such as a scroll position, which must not undo
 * what was typed since the last save.
 */
export function shouldResetEditor({
	pathChanged,
	storedBody,
	lastSaved,
	editorMarkdown,
}: {
	pathChanged: boolean;
	/** The body the store holds for the note. */
	storedBody: string;
	/** What the editor last loaded or wrote to disk. */
	lastSaved: string;
	/** What the editor holds now. */
	editorMarkdown: string;
}): boolean {
	if (pathChanged) return true;
	return storedBody !== lastSaved && storedBody !== editorMarkdown;
}
