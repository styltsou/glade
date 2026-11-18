import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { BlockDragHandle } from "./blockDragHandle";

/**
 * The "+" and drag-grip buttons, rendered into the mount points owned by the
 * drag-handle extension, plus the pointer/scroll behaviour that keeps the
 * handle from flickering while scrolling or moving between list items.
 */
export function BlockHandles({ editor, blockControls }: { editor: Editor; blockControls: BlockDragHandle }) {
	useEffect(() => {
		let pointer: { x: number; y: number } | undefined;
		let pointerAtScroll: { x: number; y: number } | undefined;
		let suppressed = false;

		// A nested list's vertical gap belongs to its outer list item in the
		// document tree. Keep the previous target until an actual item is hit.
		const isBetweenListItems = (event: MouseEvent) => {
			if (!(event.target instanceof Element) || !editor.view.dom.contains(event.target)) return false;
			const list = event.target.closest("ul, ol");
			if (!list || !editor.view.dom.contains(list)) return false;
			// Innermost list under the pointer wins (document order puts it last).
			const lists: Element[] = [list, ...Array.from(list.querySelectorAll("ul, ol"))];
			let hoveredList: Element | undefined;
			for (let i = lists.length - 1; i >= 0; i--) {
				const rect = lists[i].getBoundingClientRect();
				if (event.clientY >= rect.top && event.clientY < rect.bottom) {
					hoveredList = lists[i];
					break;
				}
			}
			if (!hoveredList) return false;
			return !Array.from(hoveredList.children).some((child: Element) => {
				if (!child.matches("li")) return false;
				const rect = child.getBoundingClientRect();
				return event.clientY >= rect.top && event.clientY < rect.bottom;
			});
		};

		// Scrolling moves blocks under a still pointer; hide the handle until the
		// pointer really moves again instead of letting it jump between blocks.
		const onScroll = (event: Event) => {
			const scrollTarget = event.target;
			if (scrollTarget instanceof Node && scrollTarget !== document && !scrollTarget.contains(editor.view.dom)) return;
			suppressed = true;
			pointerAtScroll = pointer;
			blockControls.controls.dataset.scrollSuppressed = "true";
			blockControls.clearAltGuard();
			editor.commands.setMeta("hideDragHandle", true);
		};

		const onMouseMove = (event: MouseEvent) => {
			const moved =
				pointerAtScroll && (event.clientX !== pointerAtScroll.x || event.clientY !== pointerAtScroll.y);
			pointer = { x: event.clientX, y: event.clientY };
			if (!suppressed) {
				if (isBetweenListItems(event)) event.stopPropagation();
				return;
			}
			if (!moved) {
				pointerAtScroll ??= pointer;
				if (event.target instanceof Node && editor.view.dom.contains(event.target)) event.stopPropagation();
				return;
			}
			suppressed = false;
			editor.commands.setMeta("hideDragHandle", true);
			delete blockControls.controls.dataset.scrollSuppressed;
		};

		const rememberPointer = (event: MouseEvent) => {
			pointer = { x: event.clientX, y: event.clientY };
		};

		document.addEventListener("mousemove", onMouseMove, true);
		document.addEventListener("mousedown", rememberPointer, true);
		document.addEventListener("wheel", rememberPointer, true);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			document.removeEventListener("mousemove", onMouseMove, true);
			document.removeEventListener("mousedown", rememberPointer, true);
			document.removeEventListener("wheel", rememberPointer, true);
			window.removeEventListener("scroll", onScroll, true);
			delete blockControls.controls.dataset.scrollSuppressed;
			blockControls.clearAltGuard();
		};
	}, [editor, blockControls]);

	return (
		<>
			{createPortal(
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							className="note-block-add-button"
							aria-label="Add block below; Alt-click to add above"
							onClick={(event) => blockControls.addBlock(event.altKey)}
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<path d="M5 12h14" />
								<path d="M12 5v14" />
							</svg>
						</button>
					</TooltipTrigger>
					<TooltipContent side="top" className="block space-y-0.5 text-center">
						<div>
							<span className="font-semibold">Click</span>
							<span className="text-background/75"> to add below</span>
						</div>
						<div>
							<span className="font-semibold">Alt-Click</span>
							<span className="text-background/75"> to add above</span>
						</div>
					</TooltipContent>
				</Tooltip>,
				blockControls.addButtonMount,
			)}
			{createPortal(
				<Tooltip>
					<TooltipTrigger asChild>
						<button type="button" draggable data-drag-handle="" aria-label="Drag block to move" className="note-block-drag-button">
							<svg viewBox="6 2 12 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
								<circle cx="9" cy="12" r="1" />
								<circle cx="9" cy="5" r="1" />
								<circle cx="9" cy="19" r="1" />
								<circle cx="15" cy="12" r="1" />
								<circle cx="15" cy="5" r="1" />
								<circle cx="15" cy="19" r="1" />
							</svg>
						</button>
					</TooltipTrigger>
					<TooltipContent side="top" className="transition-none">
						<span className="font-semibold">Drag</span>
						<span className="text-background/75"> to move</span>
					</TooltipContent>
				</Tooltip>,
				blockControls.dragButtonMount,
			)}
		</>
	);
}
