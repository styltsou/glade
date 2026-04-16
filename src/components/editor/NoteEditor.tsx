import {
	useEffect,
	useRef,
	useCallback,
	useState,
	useLayoutEffect,
} from "react";
import { EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
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
} from "lucide-react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { EditableTitle } from "./EditableTitle";
import { TagInput } from "@/components/TagInput";
import { RawEditor } from "./RawEditor";
import { MentionList, MentionListHandle } from "./MentionList";
import {
	SlashCommandMenu,
	SlashCommandMenuHandle,
	SlashCommandItem,
} from "./extensions/SlashCommandMenu";
import {
	registerSuggestionCallbacks,
	unregisterSuggestionCallbacks,
	SuggestionItem,
} from "./suggestion";
import {
	registerSlashCommandCallbacks,
	unregisterSlashCommandCallbacks,
} from "./SlashCommands";
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
	findQuery?: string;
	currentMatchIndex?: number;
	searchOpts?: { caseSensitive?: boolean; matchWholeWord?: boolean; useRegex?: boolean };
	isEditMode?: boolean;
	onEnterEditMode?: (cursorPos?: number) => void;
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

function getCurrentBlockType(editor: Editor): string {
	if (editor.isActive("paragraph")) return "paragraph";
	if (editor.isActive("heading", { level: 1 })) return "heading-1";
	if (editor.isActive("heading", { level: 2 })) return "heading-2";
	if (editor.isActive("heading", { level: 3 })) return "heading-3";
	if (editor.isActive("heading", { level: 4 })) return "heading-4";
	if (editor.isActive("bulletList")) return "bulletList";
	if (editor.isActive("orderedList")) return "orderedList";
	if (editor.isActive("taskList")) return "taskList";
	if (editor.isActive("blockquote")) return "blockquote";
	if (editor.isActive("codeBlock")) return "codeBlock";
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
				"hover:bg-accent hover:text-accent-foreground",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
				isActive && "bg-primary/10 text-primary",
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
	searchOpts,
	isEditMode = false,
	onEnterEditMode,
	onExitEditMode,
}: NoteEditorProps) {
	const [suggestionItems, setSuggestionItems] = useState<SuggestionItem[]>([]);
	const [suggestionPosition, setSuggestionPosition] = useState<{
		top?: number;
		bottom?: number;
		left: number;
	} | null>(null);
	const [suggestionVisible, setSuggestionVisible] = useState(false);
	const [slashItems, setSlashItems] = useState<SlashCommandItem[]>([]);
	const [slashPosition, setSlashPosition] = useState<{
		top?: number;
		bottom?: number;
		left: number;
	} | null>(null);
	const [slashVisible, setSlashVisible] = useState(false);
	const [blockPopoverOpen, setBlockPopoverOpen] = useState(false);
	const [blockSelectedIndex, setBlockSelectedIndex] = useState(0);
	const [currentBlockType, setCurrentBlockType] = useState("paragraph");

	const mentionListRef = useRef<MentionListHandle>(null);
	const slashMenuRef = useRef<SlashCommandMenuHandle>(null);
	const suggestionCommandRef = useRef<((item: SuggestionItem) => void) | null>(
		null,
	);
	const slashCommandRef = useRef<((item: SlashCommandItem) => void) | null>(
		null,
	);
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

	const handleSuggestionCommand = useCallback((item: SuggestionItem) => {
		if (suggestionCommandRef.current) {
			suggestionCommandRef.current(item);
		}
		setSuggestionVisible(false);
	}, []);

	useEffect(() => {
		if (!editor) return;

		registerSuggestionCallbacks(
			(props) => {
				if (!props.clientRect) return;
				const clientRect = props.clientRect();
				if (!clientRect) return;

				const spaceBelow = window.innerHeight - clientRect.bottom;
				const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

				suggestionCommandRef.current = props.command;

				requestAnimationFrame(() => {
					setSuggestionItems(props.items);
					setSuggestionPosition({
						top: showAbove ? undefined : clientRect.bottom + 4,
						bottom: showAbove
							? window.innerHeight - clientRect.top + 4
							: undefined,
						left: clientRect.left,
					});
					setSuggestionVisible(true);
				});
			},
			(props) => {
				if (!props.clientRect) return;
				const clientRect = props.clientRect();
				if (!clientRect) return;

				const spaceBelow = window.innerHeight - clientRect.bottom;
				const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

				suggestionCommandRef.current = props.command;

				requestAnimationFrame(() => {
					setSuggestionItems(props.items);
					setSuggestionPosition({
						top: showAbove ? undefined : clientRect.bottom + 4,
						bottom: showAbove
							? window.innerHeight - clientRect.top + 4
							: undefined,
						left: clientRect.left,
					});
				});
			},
			() => {
				requestAnimationFrame(() => {
					setSuggestionVisible(false);
					suggestionCommandRef.current = null;
				});
			},
		);

		return () => {
			unregisterSuggestionCallbacks();
			setSuggestionVisible(false);
		};
	}, [editor]);

	// Slash command callbacks
	useEffect(() => {
		if (!editor) return;

		registerSlashCommandCallbacks(
			(props) => {
				if (!props.clientRect) return;
				const clientRect = props.clientRect();
				if (!clientRect) return;

				const spaceBelow = window.innerHeight - clientRect.bottom;
				const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

				slashCommandRef.current = (item: SlashCommandItem) => {
					props.command(item);
				};

				requestAnimationFrame(() => {
					setSlashItems(props.items);
					setSlashPosition({
						top: showAbove ? undefined : clientRect.bottom + 4,
						bottom: showAbove
							? window.innerHeight - clientRect.top + 4
							: undefined,
						left: clientRect.left,
					});
					setSlashVisible(true);
				});
			},
			(props) => {
				if (!props.clientRect) return;
				const clientRect = props.clientRect();
				if (!clientRect) return;

				const spaceBelow = window.innerHeight - clientRect.bottom;
				const showAbove = spaceBelow < 300 && clientRect.top > spaceBelow;

				slashCommandRef.current = (item: SlashCommandItem) => {
					props.command(item);
				};

				requestAnimationFrame(() => {
					setSlashItems(props.items);
					setSlashPosition({
						top: showAbove ? undefined : clientRect.bottom + 4,
						bottom: showAbove
							? window.innerHeight - clientRect.top + 4
							: undefined,
						left: clientRect.left,
					});
				});
			},
			() => {
				requestAnimationFrame(() => {
					setSlashVisible(false);
					slashCommandRef.current = null;
				});
			},
		);

		return () => {
			unregisterSlashCommandCallbacks();
			setSlashVisible(false);
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

			// Exit edit mode when clicking outside the editor (e.g., sidebar)
			if (isEditMode && onExitEditMode) {
				onExitEditMode();
			}

			// Capture menu states BEFORE we change them
			const wasAnyMenuOpen =
				suggestionVisible ||
				slashVisible ||
				blockPopoverOpen ||
				isBlockPopoverClosingRef.current;

			// Handle dismissal of suggestion and slash menus
			if (suggestionVisible) setSuggestionVisible(false);
			if (slashVisible) setSlashVisible(false);

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
	}, [suggestionVisible, slashVisible, blockPopoverOpen, editor, isEditMode, onExitEditMode]);

	// Handle keyboard navigation for suggestion menus
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const isMenuOpen = suggestionVisible || slashVisible;
			if (!isMenuOpen) return;

			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				if (suggestionVisible) setSuggestionVisible(false);
				if (slashVisible) setSlashVisible(false);
				return;
			}

			if (e.key === "Tab" || e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "Enter") {
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

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [suggestionVisible, slashVisible]);

	// Track last click position in read mode for double-click to use
	const lastClickPosRef = useRef<number | null>(null);

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
			onClick={(e) => {
				// Track click position in read mode for double-click
				if (!isEditMode && editor) {
					const pos = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
					if (pos) {
						lastClickPosRef.current = pos.pos;
					}
				}
			}}
			onDoubleClick={() => {
				if (!isEditMode && onEnterEditMode) {
					const pos = lastClickPosRef.current;
					onEnterEditMode(pos !== null ? pos : undefined);
				}
			}}
			className="flex-1 overflow-auto px-10 py-8"
		>
			<div className="max-w-[750px] mx-auto">
				{editor && (
					<BubbleMenu editor={editor}>
						<div
							data-suggestion-menu="true"
							className="flex items-center bg-popover border shadow-lg rounded-md p-0.5 gap-0.5"
						>
							<Popover
								open={blockPopoverOpen}
								onOpenChange={(open) => {
									if (open && editor) {
										const index = blockTypes.findIndex(
											(bt) => bt.id === getCurrentBlockType(editor),
										);
										setBlockSelectedIndex(index >= 0 ? index : 0);
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
											"hover:bg-accent hover:text-accent-foreground",
											"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
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
									className="w-48 p-0 border shadow-lg rounded-md bg-popover text-popover-foreground data-[state=open]:animate-none data-[state=open]:zoom-in-100 data-[state=open]:fade-in-100"
									align="start"
									sideOffset={4}
									onKeyDown={handleBlockKeyDown}
								>
									<div
										ref={blockScrollRef}
										className="max-h-45 overflow-y-auto p-1"
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
													"w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left cursor-pointer outline-hidden select-none",
													index === blockSelectedIndex
														? "bg-accent text-accent-foreground"
														: "hover:bg-accent/50",
												)}
											>
												<bt.icon
													className={cn(
														"h-4 w-4 shrink-0",
														index === blockSelectedIndex
															? "text-accent-foreground/70"
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
								onClick={() => {
									if (editor.isActive("link")) {
										editor.chain().focus().unsetLink().run();
									} else {
										const url = window.prompt("Enter URL:");
										if (url)
											editor.chain().focus().setLink({ href: url }).run();
									}
								}}
								isActive={editor.isActive("link")}
							>
								<Link2 className="h-4 w-4" />
							</BubbleButton>
						</div>
					</BubbleMenu>
				)}

				<EditableTitle
					title={activeNote.title}
					path={activeNote.path}
					created={activeNote.created}
				/>

				{activeNote.updated && (
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-4">
						<Clock className="w-4 h-4" />
						<span>Last edited {formatRelativeDate(activeNote.updated)}</span>
					</div>
				)}

				<div className="mb-8">
					<TagInput />
				</div>

				{isRawMode ? (
					<RawEditor 
						content={rawContent} 
						onChange={onRawChange} 
						findQuery={findQuery}
						currentMatchIndex={currentMatchIndex}
						searchOpts={searchOpts}
						readOnly={false}
					/>
				) : (
					<EditorContent editor={editor} />
				)}

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
							if (slashCommandRef.current) {
								slashCommandRef.current(item);
							}
							setSlashVisible(false);
						}}
						position={slashPosition}
					/>
				)}
			</div>
		</div>
	);
}
