import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Copy, CopyPlus, Trash2 } from "lucide-react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BlockDragHandle } from "./blockDragHandle";
import { blockText, deleteBlock, duplicateBlock, selectBlock } from "./blockActions";

/**
 * The "+" and drag-grip buttons, rendered into the mount points owned by the
 * drag-handle extension, plus the pointer/scroll behaviour that keeps the
 * handle from flickering while scrolling or moving between list items.
 */
export function BlockHandles({ editor, blockControls }: { editor: Editor; blockControls: BlockDragHandle }) {
	// The block the grip menu is open for: the one pressed, whatever is hovered later.
	const [menuBlock, setMenuBlock] = useState<{ node: ProseMirrorNode; pos: number } | null>(null);

	const openMenu = (block: { node: ProseMirrorNode; pos: number }) => {
		const tr = selectBlock(editor.state, block.pos, block.node);
		if (!tr) return;
		// Picked as a whole, so it is clear what the menu acts on (and Backspace would remove it).
		editor.view.dispatch(tr);
		editor.commands.setMeta("lockDragHandle", true);
		setMenuBlock(block);
	};

	const closeMenu = () => {
		setMenuBlock(null);
		editor.commands.setMeta("lockDragHandle", false);
		editor.commands.setMeta("hideDragHandle", true);
	};

	const run = (action: typeof deleteBlock) => {
		if (!menuBlock) return;
		const tr = action(editor.state, menuBlock.pos, menuBlock.node);
		if (tr) editor.view.dispatch(tr);
	};

	const copyBlock = async () => {
		const text = menuBlock && blockText(editor.view, menuBlock.pos, menuBlock.node);
		if (text == null) return;
		try {
			// The webview's clipboard API is not reliably allowed; the rest of the app copies this way too.
			await writeText(text);
			toast.success("Block copied");
		} catch {
			toast.error("Couldn't copy the block");
		}
	};

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

		// The editor column is narrower than the scroll area: hovering the empty
		// margins beside a line should still reveal that line's handles. Forward
		// such moves to the editor as if the pointer were just inside its edge.
		const scroller = editor.view.dom.closest<HTMLElement>(".note-scroll");
		let forwardFrame = 0;
		const onScrollerMove = (event: MouseEvent) => {
			if (!event.isTrusted || suppressed) return;
			const target = event.target;
			if (!(target instanceof Node) || editor.view.dom.contains(target) || blockControls.controls.contains(target)) return;
			if (target instanceof Element && target.closest("[data-slot], button, input, [role=dialog]")) return;
			const rect = editor.view.dom.getBoundingClientRect();
			if (event.clientY < rect.top || event.clientY > rect.bottom) return;
			if (event.clientX >= rect.left && event.clientX <= rect.right) return;
			const clientX = event.clientX < rect.left ? rect.left + 4 : rect.right - 4;
			const clientY = event.clientY;
			cancelAnimationFrame(forwardFrame);
			forwardFrame = requestAnimationFrame(() => {
				editor.view.dom.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX, clientY }));
			});
		};
		scroller?.addEventListener("mousemove", onScrollerMove);

		document.addEventListener("mousemove", onMouseMove, true);
		document.addEventListener("mousedown", rememberPointer, true);
		document.addEventListener("wheel", rememberPointer, true);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			scroller?.removeEventListener("mousemove", onScrollerMove);
			cancelAnimationFrame(forwardFrame);
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
				<div className="relative flex">
				{/* Where the menu anchors: the grip itself, which can't also be its trigger. */}
				<DropdownMenu open={menuBlock !== null} onOpenChange={(open) => !open && closeMenu()}>
					<DropdownMenuTrigger asChild>
						<span aria-hidden className="pointer-events-none absolute inset-0" />
					</DropdownMenuTrigger>
					<DropdownMenuContent
						side="bottom"
						align="start"
						className="min-w-40"
						onCloseAutoFocus={(event) => {
							event.preventDefault();
							editor.view.focus();
						}}
					>
						<DropdownMenuItem onSelect={copyBlock}>
							<Copy />
							Copy
						</DropdownMenuItem>
						<DropdownMenuItem onSelect={() => run(duplicateBlock)}>
							<CopyPlus />
							Duplicate
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onSelect={() => run(deleteBlock)}>
							<Trash2 />
							Delete
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
				<Tooltip open={menuBlock ? false : undefined}>
					<TooltipTrigger asChild>
						<button
							type="button"
							data-drag-handle=""
							aria-label="Drag block to move; click for more"
							aria-haspopup="menu"
							aria-expanded={menuBlock !== null}
							className="note-block-drag-button"
							onPointerDown={(event) => blockControls.startDrag(event.nativeEvent, openMenu)}
						>
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
					<TooltipContent side="top" className="block space-y-0.5 text-center transition-none">
						<div>
							<span className="font-semibold">Drag</span>
							<span className="text-background/75"> to move</span>
						</div>
						<div>
							<span className="font-semibold">Click</span>
							<span className="text-background/75"> for options</span>
						</div>
					</TooltipContent>
				</Tooltip>
				</div>,
				blockControls.dragButtonMount,
			)}
		</>
	);
}
