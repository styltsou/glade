import { Extension } from "@tiptap/core";

/**
 * Remembers which note this editor instance shows, so extensions (links,
 * images, mentions) resolve paths against the right file even when another
 * pane has focus.
 */
export const PaneNote = Extension.create<Record<string, never>, { path: string | null }>({
  name: "paneNote",
  addStorage() {
    return { path: null };
  },
});

export function paneNotePath(editor: { storage: Record<string, any> }): string | null {
  return (editor.storage.paneNote?.path as string | null | undefined) ?? null;
}
