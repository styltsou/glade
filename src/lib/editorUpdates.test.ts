import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { expect, it } from "vitest";
import { isDocumentEdit } from "./editorUpdates";

it("counts the first edit after a load, but not loading or a mode switch", () => {
	const edits: boolean[] = [];
	const editor = new Editor({ extensions: [StarterKit], onUpdate: (update) => edits.push(isDocumentEdit(update)) });
	editor.commands.setContent("<p>loaded</p>", { emitUpdate: false });
	expect(edits).toEqual([]);
	editor.setEditable(false);
	editor.setEditable(true);
	expect(edits).toEqual([false, false]);
	editor.commands.insertContent("x");
	expect(edits).toEqual([false, false, true]);
	editor.destroy();
});
