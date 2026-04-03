import {
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface SlashCommandItem {
	id: string;
	label: string;
	icon: string;
	command: string;
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

				if (relativeBottom > containerRect.height - 4) {
					container.scrollTop +=
						relativeBottom - (containerRect.height - 4);
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
				className="relative flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
				data-suggestion-menu="true"
			>
				<div
					ref={commandListRef}
					className="max-h-45 overflow-y-auto p-1"
					style={{ scrollbarWidth: 'none' }}
				>
						{props.items.length ? (
						props.items.map((item, index) => (
							<div
								key={item.id}
								onClick={() => props.command(item)}
								data-selected={index === selectedIndex}
								className={cn(
									"relative flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
									index === selectedIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
								)}
							>
								<span
									className={cn(
										"shrink-0",
										index === selectedIndex
											? "text-accent-foreground/70"
											: "text-muted-foreground",
									)}
								>
									{iconMap[item.icon]}
								</span>
								<span className="truncate font-medium">{item.label}</span>
							</div>
						))
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
