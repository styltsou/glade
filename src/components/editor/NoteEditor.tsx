import {
	useEffect,
	useRef,
	useCallback,
	useMemo,
	useState,
	useLayoutEffect,
} from "react";
import { EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
	BUBBLE_EDGE,
	BUBBLE_MENU_KEY,
	BUBBLE_OFFSET,
	blockMenuSide,
	bubbleGlide,
	selectedTextBox,
	shouldShowBubble,
	trackPointerSelection,
} from "./bubbleMenu";
import {
	Bold,
	Italic,
	Strikethrough,
	Link2,
	ChevronDown,
	Clock,
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	List,
	ListOrdered,
	CheckSquare,
	Quote,
	Code,
	Type,
	Underline,
} from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { EditableTitle } from "./EditableTitle";
import { TagInput } from "@/components/TagInput";
import { RawEditor, type RawEditorHandle } from "./RawEditor";
import { PropertiesPanel } from "./PropertiesPanel";
import { LinkInteractionPopover } from "./LinkPopover";
import { CaretLinkPopover, LinkUrlForm } from "./LinkUrlForm";
import { TableControls } from "./tables/TableControls";
import { MentionList, MentionListHandle } from "./MentionList";
import {
	SlashCommandMenu,
	SlashCommandMenuHandle,
} from "./extensions/SlashCommandMenu";
import { useSuggestionCallbacks } from "@/hooks/useSuggestionCallbacks";
import { useSlashCommandCallbacks } from "@/hooks/useSlashCommandCallbacks";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/dates";

interface NoteEditorProps {
	activeNote: {
		title: string;
		path: string;
		updated: string | null;
		created: string | null;
		[key: string]: any;
	};
	editor: Editor | null;
	isRawMode: boolean;
	rawContent: string;
	onRawChange: (value: string) => void;
	scrollRef: React.RefObject<HTMLDivElement | null>;
	onScroll: () => void;
	/** What the find bar is looking for, highlighted in the raw view. */
	findQuery?: string;
	currentMatchIndex?: number;
	caseSensitive?: boolean;
	wholeWord?: boolean;
	rawEditorRef?: React.Ref<RawEditorHandle>;
	isEditMode?: boolean;
	onExitEditMode?: () => void;
}

const blockTypes = [
	{ id: "paragraph", label: "Text", icon: Type },
	{ id: "heading-1", label: "Heading 1", level: 1, icon: Heading1 },
	{ id: "heading-2", label: "Heading 2", level: 2, icon: Heading2 },
	{ id: "heading-3", label: "Heading 3", level: 3, icon: Heading3 },
	{ id: "heading-4", label: "Heading 4", level: 4, icon: Heading4 },
	{ id: "bulletList", label: "Bullet list", icon: List },
	{ id: "orderedList", label: "Ordered list", icon: ListOrdered },
	{ id: "taskList", label: "Task list", icon: CheckSquare },
	{ id: "blockquote", label: "Blockquote", icon: Quote },
	{ id: "codeBlock", label: "Code block", icon: Code },
];

function convertToBlockType(editor: Editor, blockTypeId: string) {
	switch (blockTypeId) {
		case "paragraph":
			editor.chain().focus().setParagraph().run();
			break;
		case "heading-1":
			editor.chain().focus().toggleHeading({ level: 1 }).run();
			break;
		case "heading-2":
			editor.chain().focus().toggleHeading({ level: 2 }).run();
			break;
		case "heading-3":
			editor.chain().focus().toggleHeading({ level: 3 }).run();
			break;
		case "heading-4":
			editor.chain().focus().toggleHeading({ level: 4 }).run();
			break;
		case "bulletList":
			editor.chain().focus().toggleBulletList().run();
			break;
		case "orderedList":
			editor.chain().focus().toggleOrderedList().run();
			break;
		case "taskList":
			editor.chain().focus().toggleTaskList().run();
			break;
		case "blockquote":
			editor.chain().focus().toggleBlockquote().run();
			break;
		case "codeBlock":
			editor.chain().focus().toggleCodeBlock().run();
			break;
	}
}

/**
 * The block type the selection starts in: the innermost block that has one.
 * Paragraphs sit inside list items and quotes, so checking "is a paragraph
 * active" first would call a list item "Text"; walking up from the selection
 * finds the list (or quote, heading, code block) it really belongs to.
 */
function getCurrentBlockType(editor: Editor): string {
	const { $from } = editor.state.selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		const node = $from.node(depth);
		switch (node.type.name) {
			case "heading":
				return `heading-${Math.min(4, Math.max(1, node.attrs.level ?? 1))}`;
			case "bulletList":
			case "orderedList":
			case "taskList":
			case "blockquote":
			case "codeBlock":
				return node.type.name;
		}
	}
	return "paragraph";
}

function BubbleButton({
	children,
	onClick,
	isActive = false,
	className = "",
}: {
	children: React.ReactNode;
	onClick?: () => void;
	isActive?: boolean;
	className?: string;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"inline-flex items-center justify-center h-8 w-8 rounded-sm text-sm font-medium transition-colors",
				// A wash of the text colour, as in the menus: a solid fill would sit on the glass.
				"hover:bg-foreground/[0.06] active:bg-foreground/[0.09]",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
				isActive && "bg-primary/10 text-primary hover:bg-primary/15",
				className,
			)}
		>
			{children}
		</button>
	);
}

export function NoteEditor({
	activeNote,
	editor,
	isRawMode,
	rawContent,
	onRawChange,
	scrollRef,
	onScroll,
	findQuery,
	currentMatchIndex,
	caseSensitive,
	wholeWord,
	rawEditorRef,
	isEditMode = false,
}: NoteEditorProps) {
	const [blockPopoverOpen, setBlockPopoverOpen] = useState(false);
	const [blockPopoverSide, setBlockPopoverSide] = useState<"top" | "bottom">("bottom");
	const [linkFormOpen, setLinkFormOpen] = useState(false);
	const [blockSelectedIndex, setBlockSelectedIndex] = useState(0);
	const [currentBlockType, setCurrentBlockType] = useState("paragraph");

	const {
		suggestionItems,
		suggestionPosition,
		suggestionVisible,
		handleSuggestionCommand,
		closeSuggestion,
	} = useSuggestionCallbacks(editor);
	const {
		slashItems,
		slashPosition,
		slashVisible,
		handleSlashCommand,
		closeSlash,
	} = useSlashCommandCallbacks(editor);

	const mentionListRef = useRef<MentionListHandle>(null);
	const slashMenuRef = useRef<SlashCommandMenuHandle>(null);
	const blockTriggerRef = useRef<HTMLButtonElement>(null);
	const blockScrollRef = useRef<HTMLDivElement>(null);
	const isBlockPopoverClosingRef = useRef(false);

	// Handle scroll padding in block selector
	useLayoutEffect(() => {
		if (blockPopoverOpen && blockScrollRef.current) {
			const container = blockScrollRef.current;
			const selectedItem = container.querySelector(
				'[data-selected="true"]',
			) as HTMLElement | null;
			if (selectedItem) {
				const containerRect = container.getBoundingClientRect();
				const itemRect = selectedItem.getBoundingClientRect();

				const relativeTop = itemRect.top - containerRect.top;
				const relativeBottom = itemRect.bottom - containerRect.top;

				if (relativeBottom > containerRect.height - 4) {
					container.scrollTop += relativeBottom - (containerRect.height - 4);
				} else if (relativeTop < 4) {
					container.scrollTop += relativeTop - 4;
				}
			}
		}
	}, [blockSelectedIndex, blockPopoverOpen]);

	const handleBlockKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setBlockSelectedIndex((prev) => (prev + 1) % blockTypes.length);
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setBlockSelectedIndex(
					(prev) => (prev + blockTypes.length - 1) % blockTypes.length,
				);
			} else if (e.key === "Tab") {
				e.preventDefault();
				if (e.shiftKey) {
					setBlockSelectedIndex(
						(prev) => (prev + blockTypes.length - 1) % blockTypes.length,
					);
				} else {
					setBlockSelectedIndex((prev) => (prev + 1) % blockTypes.length);
				}
			} else if (e.key === "Enter") {
				e.preventDefault();
				const item = blockTypes[blockSelectedIndex];
				if (item && editor) {
					convertToBlockType(editor, item.id);
					setBlockPopoverOpen(false);
				}
			} else if (e.key === "Escape") {
				setBlockPopoverOpen(false);
			}
		},
		[blockSelectedIndex, editor],
	);

	useEffect(() => {
		if (!editor) return;

		const updateBlockType = () => {
			setCurrentBlockType(getCurrentBlockType(editor));
		};

		updateBlockType();
		editor.on("selectionUpdate", updateBlockType);
		editor.on("transaction", updateBlockType);

		return () => {
			editor.off("selectionUpdate", updateBlockType);
			editor.off("transaction", updateBlockType);
		};
	}, [editor]);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;

			// If click is inside any of our menus (or the trigger), keep it open
			const isInsideMenu = target.closest('[data-suggestion-menu="true"]');
			if (isInsideMenu) return;

			// Check if we clicked on any element that belongs to our menus
			// Popover Content from shadcn/Radix usually closes on its own with its own dismissal logic.

			// If click is inside the editor content area, let Tiptap handle selection changes
			const isInsideEditor = editor && editor.view.dom.contains(target);
			if (isInsideEditor) return;

			// Capture menu states BEFORE we change them
			const wasAnyMenuOpen =
				suggestionVisible ||
				slashVisible ||
				blockPopoverOpen ||
				isBlockPopoverClosingRef.current;

			// Handle dismissal of suggestion and slash menus
			if (suggestionVisible) closeSuggestion();
			if (slashVisible) closeSlash();

			// If any menu was open, we only close them and return (don't clear selection yet)
			if (wasAnyMenuOpen) return;

			// Dismiss text selection (Bubble Menu) if clicking elsewhere
			if (editor && !editor.state.selection.empty) {
				editor.commands.setTextSelection({
					from: editor.state.selection.to,
					to: editor.state.selection.to,
				});
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [suggestionVisible, slashVisible, blockPopoverOpen, editor]);

	// Handle keyboard navigation for suggestion menus
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isMenuOpen = suggestionVisible || slashVisible;
			if (!isMenuOpen) return;

			if (
				e.target instanceof HTMLInputElement ||
				e.target instanceof HTMLTextAreaElement
			) {
				return;
			}

			if (e.key === "Escape") {
				// Left to bubble, so the suggestion plugin sees it first and exits.
				if (e.eventPhase === Event.CAPTURING_PHASE) return;
				e.preventDefault();
				e.stopPropagation();
				if (suggestionVisible) closeSuggestion();
				if (slashVisible) closeSlash();
				return;
			}

			// The rest must be taken before the editor acts on them (Enter would split
			// the paragraph), but only when there is something to choose.
			if (e.eventPhase !== Event.CAPTURING_PHASE || e.isComposing) return;
			const hasItems =
				(suggestionVisible && suggestionItems.length > 0) ||
				(slashVisible && slashItems.length > 0);
			if (!hasItems) return;

			if (
				e.key === "Tab" ||
				e.key === "ArrowUp" ||
				e.key === "ArrowDown" ||
				e.key === "Enter"
			) {
				e.preventDefault();
				e.stopPropagation();

				if (suggestionVisible && mentionListRef.current) {
					const handled = mentionListRef.current.onKeyDown({ event: e });
					if (handled) return;
				}

				if (slashVisible && slashMenuRef.current) {
					const handled = slashMenuRef.current.onKeyDown({ event: e });
					if (handled) return;
				}
			}
		};

		document.addEventListener("keydown", handleKeyDown, true);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("keydown", handleKeyDown, true);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [suggestionVisible, slashVisible, suggestionItems.length, slashItems.length]);

	// The menu changes width when the link form replaces the toolbar; re-center it on the selection.
	useEffect(() => {
		if (!editor) return;
		const id = requestAnimationFrame(() => {
			editor.view.dispatch(editor.state.tr.setMeta(BUBBLE_MENU_KEY, "updatePosition"));
		});
		return () => cancelAnimationFrame(id);
	}, [editor, linkFormOpen]);

	// A new selection abandons an open link form.
	useEffect(() => {
		if (!editor) return;
		const close = () => setLinkFormOpen(false);
		editor.on("selectionUpdate", close);
		return () => {
			editor.off("selectionUpdate", close);
		};
	}, [editor]);

	// Kept clear of the edges: the bubble's offset is applied after the decision to
	// flip, so without padding a bubble just short of the top edge ends up past it
	// instead of moving below the text. It glides when it moves. (Made once: a new
	// object each render would re-send the options on every render.)
	const bubbleRef = useRef<HTMLDivElement>(null);
	// It is also placed again as the pane scrolls, which keeps it with the part of a
	// long selection that is showing. (The bubble is mounted once the pane is known:
	// its wrapper ignores the first change to its options after it starts.)
	const [scroller, setScroller] = useState<HTMLElement | null>(null);
	useEffect(() => setScroller(scrollRef.current), [scrollRef]);
	const bubbleOptions = useMemo(
		() => ({
			offset: BUBBLE_OFFSET,
			flip: { padding: BUBBLE_EDGE },
			shift: { padding: 8 },
			...(scroller ? { scrollTarget: scroller } : {}),
			...bubbleGlide(() => bubbleRef.current),
		}),
		[scroller],
	);
	const keepInView = useMemo(
		() => ({
			area: () => scrollRef.current?.getBoundingClientRect() ?? null,
			barHeight: () => bubbleRef.current?.offsetHeight || 38,
		}),
		[scrollRef],
	);

	// The bubble waits for the mouse button to come up before it shows.
	useEffect(() => (editor ? trackPointerSelection(editor) : undefined), [editor]);

	// Where the bubble goes: over the selected words. Read again on every position update.
	const getSelectedTextBox = useCallback(() => (editor ? selectedTextBox(editor, keepInView) : null), [editor, keepInView]);

	// Update editor editable state when isEditMode changes
	useEffect(() => {
		if (editor) {
			editor.setEditable(isEditMode);
		}
	}, [editor, isEditMode]);

	return (
		<div
			ref={scrollRef as React.RefObject<HTMLDivElement>}
			onScroll={onScroll}
			className="flex-1 overflow-auto px-16 @[46rem]/pane:px-24 py-8 note-scroll"
		>
			<div className="max-w-215 mx-auto">
				{editor && scroller && (
					<BubbleMenu
						editor={editor}
						pluginKey={BUBBLE_MENU_KEY}
						ref={bubbleRef}
						shouldShow={shouldShowBubble}
						updateDelay={0}
						options={bubbleOptions}
						getReferencedVirtualElement={getSelectedTextBox}
					>
						{linkFormOpen ? (
							<LinkUrlForm editor={editor} onDone={() => setLinkFormOpen(false)} />
						) : (
						<div
							data-suggestion-menu="true"
							className="glass-bubble flex items-center shadow-[var(--elev-pop)] rounded-md p-0.5 gap-0.5"
						>
							<Popover
								open={blockPopoverOpen}
								onOpenChange={(open) => {
									if (open && editor) {
										const index = blockTypes.findIndex(
											(bt) => bt.id === getCurrentBlockType(editor),
										);
										setBlockSelectedIndex(index >= 0 ? index : 0);
										setBlockPopoverSide(
											blockMenuSide(
												blockTriggerRef.current?.getBoundingClientRect() ?? null,
												selectedTextBox(editor)?.getBoundingClientRect().top ?? null,
											),
										);
									}

									if (!open && blockPopoverOpen) {
										isBlockPopoverClosingRef.current = true;
										setTimeout(() => {
											isBlockPopoverClosingRef.current = false;
										}, 0);
									}

									setBlockPopoverOpen(open);
								}}
							>
								<PopoverTrigger asChild>
									<button
										ref={blockTriggerRef}
										type="button"
										className={cn(
											"inline-flex items-center justify-center gap-2 h-8 px-2 rounded-sm text-sm font-medium outline-hidden select-none",
											"hover:bg-foreground/[0.06] data-[state=open]:bg-foreground/[0.09]",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
										)}
									>
										{(() => {
											const currentBT =
												blockTypes.find((bt) => bt.id === currentBlockType) ||
												blockTypes[0];
											const Icon = currentBT.icon;
											return (
												<>
													<Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
													<span className="text-sm">{currentBT.label}</span>
												</>
											);
										})()}
										<ChevronDown className="h-3 w-3 text-muted-foreground" />
									</button>
								</PopoverTrigger>
								<PopoverContent
									className="glass-bubble w-48 p-0 rounded-md text-popover-foreground data-[state=open]:animate-none data-[state=open]:zoom-in-100 data-[state=open]:fade-in-100"
									side={blockPopoverSide}
									align="start"
									sideOffset={4}
									collisionPadding={8}
									onKeyDown={handleBlockKeyDown}
								>
									<div
										ref={blockScrollRef}
										className="max-h-[min(20rem,calc(var(--radix-popover-content-available-height)_-_2px))] overflow-y-auto p-1"
										style={{ scrollbarWidth: "none" }}
										data-suggestion-menu="true"
									>
										{blockTypes.map((bt, index) => (
											<div
												key={bt.id}
												data-selected={index === blockSelectedIndex}
												onClick={() => {
													convertToBlockType(editor, bt.id);
													setBlockPopoverOpen(false);
												}}
												className={cn(
													"w-full flex items-center gap-2 rounded-sm px-2 py-1 text-sm text-left cursor-pointer outline-hidden select-none",
													index === blockSelectedIndex
														? "bg-foreground/[0.09] text-foreground"
														: "hover:bg-foreground/[0.06]",
												)}
											>
												<bt.icon
													className={cn(
														"h-4 w-4 shrink-0",
														index === blockSelectedIndex
															? "text-foreground/60"
															: "text-muted-foreground",
													)}
												/>
												<span className="font-medium">{bt.label}</span>
											</div>
										))}
									</div>
								</PopoverContent>
							</Popover>

							<BubbleButton
								onClick={() => {
									setLinkFormOpen(true);
								}}
								isActive={editor.isActive("link")}
							>
								<Link2 className="h-4 w-4" />
							</BubbleButton>

							<div className="w-px h-5 bg-foreground/10 mx-0.5" />

							<BubbleButton
								onClick={() => editor.chain().focus().toggleBold().run()}
								isActive={editor.isActive("bold")}
							>
								<Bold className="h-4 w-4" />
							</BubbleButton>
							<BubbleButton
								onClick={() => editor.chain().focus().toggleItalic().run()}
								isActive={editor.isActive("italic")}
							>
								<Italic className="h-4 w-4" />
							</BubbleButton>
							<BubbleButton
								onClick={() => editor.chain().focus().toggleStrike().run()}
								isActive={editor.isActive("strike")}
							>
								<Strikethrough className="h-4 w-4" />
							</BubbleButton>
							<BubbleButton
								onClick={() => editor.chain().focus().toggleUnderline().run()}
								isActive={editor.isActive("underline")}
							>
								<Underline className="h-4 w-4" />
							</BubbleButton>
							<BubbleButton
								onClick={() => editor.chain().focus().toggleCode().run()}
								isActive={editor.isActive("code")}
							>
								<Code className="h-4 w-4" />
							</BubbleButton>
						</div>
						)}
					</BubbleMenu>
				)}

				{editor && !isRawMode && <LinkInteractionPopover editor={editor} />}
				{editor && !isRawMode && <CaretLinkPopover editor={editor} />}

				<EditableTitle
					title={activeNote.title}
					path={activeNote.path}
					created={activeNote.created}
					onDone={() => {
						if (editor && isEditMode && !isRawMode) editor.commands.focus("start");
					}}
				/>

				{activeNote.updated && (
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
						<Clock className="w-4 h-4" />
						<span>Last edited {formatRelativeDate(activeNote.updated)}</span>
					</div>
				)}

				<div className="mb-8">
					<TagInput />
					<PropertiesPanel />
				</div>

				{isRawMode ? (
					<RawEditor
						ref={rawEditorRef}
						content={rawContent}
						onChange={onRawChange}
						findQuery={findQuery}
						currentMatchIndex={currentMatchIndex}
						caseSensitive={caseSensitive}
						wholeWord={wholeWord}
						readOnly={false}
					/>
				) : (
					<EditorContent editor={editor} className="tiptap-editor-host" />
				)}

				{editor && isEditMode && !isRawMode && <TableControls editor={editor} />}

				{suggestionVisible && suggestionPosition && (
					<MentionList
						ref={mentionListRef}
						items={suggestionItems}
						position={suggestionPosition}
						command={handleSuggestionCommand}
					/>
				)}

				{slashVisible && slashPosition && (
					<SlashCommandMenu
						ref={slashMenuRef}
						items={slashItems}
						command={(item) => {
							handleSlashCommand(item);
						}}
						position={slashPosition}
					/>
				)}
			</div>
		</div>
	);
}
