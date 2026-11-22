import { Extension } from "@tiptap/core";

/** Elements a line break can follow in the middle of a sentence. */
const INLINE = "a,abbr,b,code,del,em,i,img,ins,kbd,mark,s,small,span,strike,strong,sub,sup,u";

/**
 * tiptap-markdown drops the line break that follows any element, which glues
 * words: `[link](x.md)` then `next line` became `linknext line`. After an
 * inline element that break is a space, as in any markdown renderer.
 */
export const SoftBreaks = Extension.create({
	name: "softBreaks",

	addStorage() {
		return {
			markdown: {
				parse: {
					updateDOM(element: HTMLElement) {
						element.querySelectorAll(INLINE).forEach((el) => {
							const next = el.nextSibling;
							if (next?.nodeType !== Node.TEXT_NODE || el.closest("pre")) return;
							next.textContent = next.textContent!.replace(/^\r?\n/, " ");
						});
					},
				},
			},
		};
	},
});
