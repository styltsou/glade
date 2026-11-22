import type { EditorEvents } from "@tiptap/core";

/**
 * Whether an editor update is an edit. `setEditable` also emits one, with the
 * document untouched; loading with `emitUpdate: false` emits none at all, so
 * the first update after a load can be a real edit and must never be skipped.
 */
export function isDocumentEdit({ transaction, appendedTransactions }: EditorEvents["update"]): boolean {
	return transaction.docChanged || appendedTransactions.some((tr) => tr.docChanged);
}
