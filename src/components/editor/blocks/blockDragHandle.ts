import type { Editor } from "@tiptap/core";
import DragHandle from "@tiptap/extension-drag-handle";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Floating block-gutter controls in the spirit of Notion: a "+" button and a
 * drag handle that follow the hovered block in the editor's left gutter.
 * The DragHandle extension owns hover detection, read-only hiding and the
 * drag-and-drop wiring; this file supplies the DOM, the positioning and the
 * "add block" action. Nested mode is on, so list items and other nested blocks
 * get their own handle (needs the patch in `patches/`).
 */
export function createBlockDragHandleExtension() {
	let target: { editor: Editor; node: ProseMirrorNode; pos: number } | undefined;
	let dragDataListenerAttached = false;

	const preserveBlockControlsOnAlt = (event: KeyboardEvent) => {
		if (event.key !== "Alt" || !controls.matches(":hover")) return;
		// The drag-handle extension hides its controls on any editor keydown.
		// Keep Alt available for the add button's Alt-click while the pointer is
		// over the controls, and stop the browser menu from stealing focus.
		event.preventDefault();
		event.stopPropagation();
	};

	const controls = document.createElement("div");
	controls.className = "note-float-block-controls";
	// The extension positions and reveals the controls on the first block hover.
	controls.style.visibility = "hidden";
	controls.addEventListener("mouseenter", () => {
		document.addEventListener("keydown", preserveBlockControlsOnAlt, true);
	});
	controls.addEventListener("mouseleave", (event) => {
		document.removeEventListener("keydown", preserveBlockControlsOnAlt, true);
		if (!target || controls.dataset.dragging === "true") return;
		const editorElement = target.editor.view.dom;
		if (event.relatedTarget instanceof Node && editorElement.contains(event.relatedTarget)) return;
		// Let the extension clear its hover target when leaving the controls too.
		editorElement.dispatchEvent(new MouseEvent("mouseleave", { relatedTarget: event.relatedTarget }));
	});

	const addButtonMount = document.createElement("div");
	addButtonMount.className = "flex";
	const dragButtonMount = document.createElement("div");
	dragButtonMount.className = "flex";
	controls.append(addButtonMount, dragButtonMount);

	/** Insert an empty paragraph below (or above) the hovered block and focus it. */
	function addBlock(above: boolean) {
		if (!target) return;
		const insertPosition = above ? target.pos : target.pos + target.node.nodeSize;
		target.editor
			.chain()
			.focus()
			.insertContentAt(insertPosition, { type: "paragraph" }, { updateSelection: true })
			.focus()
			.run();
	}

	const extension = DragHandle.configure({
		nested: {
			edgeDetection: "none",
			rules: [
				{
					// Anything inside a table belongs to the table: one handle for the
					// whole table, not one per cell paragraph.
					id: "table-cell-content",
					evaluate: ({ $pos, depth }) =>
						Array.from({ length: depth }, (_, index) => $pos.node(index)).some(
							(node) => node.type.name === "table",
						)
							? 1000
							: 0,
				},
			],
		},
		computePositionConfig: {
			placement: "left-start",
			strategy: "absolute",
		},
		getReferencedVirtualElement: () => {
			if (!target) return null;
			const currentTarget = target;
			const editorElement = currentTarget.editor.view.dom;
			const blockElement = currentTarget.editor.view.nodeDOM(currentTarget.pos);
			if (!(blockElement instanceof Element)) return null;
			return {
				contextElement: editorElement,
				getBoundingClientRect: () => {
					const editorRect = editorElement.getBoundingClientRect();
					const blockRect = blockElement.getBoundingClientRect();
					const padding = parseFloat(getComputedStyle(editorElement).paddingLeft) || 0;
					// Tables line the controls up with the first row, not the middle.
					const firstRow =
						currentTarget.node.type.name === "table" ? blockElement.querySelector("table tr") : null;
					const rowRect = firstRow?.getBoundingClientRect();
					const top = rowRect
						? rowRect.top + (rowRect.height - (controls.offsetHeight || 28)) / 2
						: blockRect.top;
					return new DOMRect(editorRect.left + padding, top, 0, rowRect?.height ?? blockRect.height);
				},
			};
		},
		render: () => controls,
		onNodeChange: ({
			node,
			editor: targetEditor,
			pos,
		}: {
			node: ProseMirrorNode | null;
			editor: Editor;
			pos?: number;
		}) => {
			const wrapper = controls.parentElement;
			if (wrapper && !dragDataListenerAttached) {
				dragDataListenerAttached = true;
				// The extension clears DataTransfer during dragstart. Populate it after
				// its handler so browsers recognize the operation as a native drag.
				wrapper.addEventListener("dragstart", (event) => {
					if (
						!(event.target instanceof Node) ||
						!dragButtonMount.contains(event.target) ||
						!event.dataTransfer ||
						!target
					)
						return;
					event.dataTransfer.setData("text/plain", target.node.textContent);
					event.dataTransfer.effectAllowed = "copyMove";
				});
			}
			target = node && typeof pos === "number" && pos >= 0 ? { editor: targetEditor, node, pos } : undefined;
		},
	});

	return {
		extension,
		controls,
		addButtonMount,
		dragButtonMount,
		addBlock,
		clearAltGuard: () => document.removeEventListener("keydown", preserveBlockControlsOnAlt, true),
	};
}

export type BlockDragHandle = ReturnType<typeof createBlockDragHandleExtension>;
