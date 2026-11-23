import {
	Fragment,
	forwardRef,
	useImperativeHandle,
	useState,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";
import {
	Heading1,
	Heading2,
	Heading3,
	Heading4,
	List,
	ListOrdered,
	CheckSquare,
	Quote,
	Code,
	Minus,
	Link2,
	Table,
	Type,
	GitBranch,
	Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashCommandItem {
	id: string;
	label: string;
	icon: string;
	command: string;
	markdown?: string;
}

export const slashCommands: SlashCommandItem[] = [
	{ id: "text", label: "Text", icon: "Type", command: "paragraph" },
	{ id: "h1", label: "Heading 1", icon: "H1", command: "heading1" },
	{ id: "h2", label: "Heading 2", icon: "H2", command: "heading2" },
	{ id: "h3", label: "Heading 3", icon: "H3", command: "heading3" },
	{ id: "h4", label: "Heading 4", icon: "H4", command: "heading4" },
	{ id: "bullet", label: "Bullet list", icon: "List", command: "bulletList" },
	{
		id: "ordered",
		label: "Ordered list",
		icon: "ListOrdered",
		command: "orderedList",
	},
	{ id: "task", label: "Task list", icon: "CheckSquare", command: "taskList" },
	{ id: "quote", label: "Blockquote", icon: "Quote", command: "blockquote" },
	{ id: "code", label: "Code block", icon: "Code", command: "codeBlock" },
	{ id: "table", label: "Table", icon: "Table", command: "table" },
	{ id: "hr", label: "Separator", icon: "Minus", command: "horizontalRule" },
	{ id: "link", label: "Add link", icon: "Link2", command: "link" },
];

const iconMap: Record<string, React.ReactNode> = {
	Type: <Type className="h-4 w-4" />,
	H1: <Heading1 className="h-4 w-4" />,
	H2: <Heading2 className="h-4 w-4" />,
	H3: <Heading3 className="h-4 w-4" />,
	H4: <Heading4 className="h-4 w-4" />,
	List: <List className="h-4 w-4" />,
	ListOrdered: <ListOrdered className="h-4 w-4" />,
	CheckSquare: <CheckSquare className="h-4 w-4" />,
	Quote: <Quote className="h-4 w-4" />,
	Code: <Code className="h-4 w-4" />,
	Table: <Table className="h-4 w-4" />,
	Minus: <Minus className="h-4 w-4" />,
	Link2: <Link2 className="h-4 w-4" />,
	GitBranch: <GitBranch className="h-4 w-4" />,
	Image: <ImageIcon className="h-4 w-4" />,
};

const sectionById: Record<string, string> = {
	text: "Basic",
	h1: "Basic",
	h2: "Basic",
	h3: "Basic",
	h4: "Basic",
	bullet: "Lists",
	ordered: "Lists",
	task: "Lists",
	quote: "Blocks",
	code: "Blocks",
	table: "Blocks",
	hr: "Blocks",
	diagram: "Blocks",
	link: "Insert",
	image: "Insert",
};

export interface SlashCommandMenuHandle {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashCommandMenuProps {
	items: SlashCommandItem[];
	command: (item: SlashCommandItem) => void;
	position?: {
		top?: number;
		bottom?: number;
		left: number;
	};
}

export const SlashCommandMenu = forwardRef<
	SlashCommandMenuHandle,
	SlashCommandMenuProps
>((props, ref) => {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const commandListRef = useRef<HTMLDivElement>(null);
	const selectedIndexRef = useRef(0);
	selectedIndexRef.current = selectedIndex;

	useEffect(() => {
		setSelectedIndex(0);
	}, [props.items]);

	useLayoutEffect(() => {
		if (commandListRef.current) {
			const container = commandListRef.current;
			const selectedItem = container.querySelector(
				'[data-selected="true"]',
			) as HTMLElement | null;
			if (selectedItem) {
				const containerRect = container.getBoundingClientRect();
				const itemRect = selectedItem.getBoundingClientRect();

				const relativeTop = itemRect.top - containerRect.top;
				const relativeBottom = itemRect.bottom - containerRect.top;

				if (selectedIndexRef.current === 0) {
					container.scrollTop = 0;
				} else if (relativeBottom > containerRect.height - 4) {
					container.scrollTop += relativeBottom - (containerRect.height - 4);
				} else if (relativeTop < 4) {
					container.scrollTop += relativeTop - 4;
				}
			}
		}
	}, [selectedIndex]);

	useImperativeHandle(ref, () => ({
		onKeyDown: ({ event }: { event: KeyboardEvent }) => {
			if (event.key === "ArrowUp") {
				setSelectedIndex(
					(prev) => (prev + props.items.length - 1) % props.items.length,
				);
				return true;
			}
			if (event.key === "ArrowDown") {
				setSelectedIndex((prev) => (prev + 1) % props.items.length);
				return true;
			}
			if (event.key === "Tab") {
				if (event.shiftKey) {
					setSelectedIndex(
						(prev) => (prev + props.items.length - 1) % props.items.length,
					);
				} else {
					setSelectedIndex((prev) => (prev + 1) % props.items.length);
				}
				return true;
			}
			if (event.key === "Enter") {
				const item = props.items[selectedIndex];
				if (item) {
					props.command(item);
				}
				return true;
			}
			return false;
		},
	}));

	return (
		<div
			className="fixed z-1000 min-w-50"
			style={
				props.position
					? {
							top: props.position.top,
							bottom: props.position.bottom,
							left: props.position.left,
						}
					: undefined
			}
		>
			<div
				className="relative flex flex-col overflow-hidden rounded-md border-border/60 border bg-background/65 text-popover-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-xl backdrop-saturate-150"
				data-suggestion-menu="true"
			>
				<div
					ref={commandListRef}
					className="max-h-80 overflow-y-auto p-1"
					style={{ scrollbarWidth: "none" }}
				>
					{props.items.length ? (
						props.items.map((item, index) => {
							const section = sectionById[item.id];
							const showHeader =
								section && section !== sectionById[props.items[index - 1]?.id];
							return (
							<Fragment key={item.id}>
							{showHeader && (
								<div className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground first:pt-1">
									{section}
								</div>
							)}
							<div
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => props.command(item)}
								data-selected={index === selectedIndex}
								className={cn(
									"group relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm outline-hidden select-none",
									index === selectedIndex
										? "bg-foreground/[0.09] text-foreground"
										: "hover:bg-foreground/[0.06]",
								)}
							>
								<span
									className={cn(
										"shrink-0",
										index === selectedIndex
											? "text-foreground/60"
											: "text-muted-foreground",
									)}
								>
									{iconMap[item.icon]}
								</span>
								<span className="truncate font-medium">{item.label}</span>
								{item.markdown && (
									<span
										aria-hidden="true"
										className={cn(
											"ml-auto shrink-0 pl-4 font-mono text-xs group-hover:text-foreground/55",
											index === selectedIndex
												? "text-foreground/55"
												: "text-muted-foreground/60",
										)}
									>
										{item.markdown}
									</span>
								)}
							</div>
							</Fragment>
							);
						})
					) : (
						<div className="px-3 py-2 text-sm text-muted-foreground italic text-center">
							No results
						</div>
					)}
				</div>
			</div>
		</div>
	);
});

SlashCommandMenu.displayName = "SlashCommandMenu";
