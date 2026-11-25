import {
	forwardRef,
	useImperativeHandle,
	useState,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";
import { cn } from "@/lib/utils";
import {
	getSuggestionScrollTop,
	type SuggestionNavigationDirection,
} from "./suggestionScroll";

interface MentionListProps {
	items: {
		id: string;
		label: string;
		folder?: string;
		modified?: string | null;
	}[];
	command: (item: {
		id: string;
		label: string;
		folder?: string;
		modified?: string | null;
	}) => void;
	position?: {
		top?: number;
		bottom?: number;
		left: number;
	};
}

export interface MentionListHandle {
	onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListHandle, MentionListProps>(
	(props, ref) => {
		const [selectedIndex, setSelectedIndex] = useState(0);
		const commandListRef = useRef<HTMLDivElement>(null);

		const selectedIndexRef = useRef(0);
		selectedIndexRef.current = selectedIndex;
		const directionRef = useRef<SuggestionNavigationDirection | null>(null);

		useEffect(() => {
			directionRef.current = null;
			setSelectedIndex(0);
			if (commandListRef.current) commandListRef.current.scrollTop = 0;
		}, [props.items]);

		useLayoutEffect(() => {
			const direction = directionRef.current;
			directionRef.current = null;
			const container = commandListRef.current;
			const selectedItem = container?.querySelector(
				'[data-selected="true"]',
			) as HTMLElement | null;
			if (!direction || !container || !selectedItem) return;

			const containerRect = container.getBoundingClientRect();
			const itemRect = selectedItem.getBoundingClientRect();
			container.scrollTop = getSuggestionScrollTop({
				direction,
				selectedIndex,
				itemCount: props.items.length,
				itemTop: itemRect.top - containerRect.top + container.scrollTop,
				itemHeight: itemRect.height,
				scrollTop: container.scrollTop,
				clientHeight: container.clientHeight,
				scrollHeight: container.scrollHeight,
			});
		}, [selectedIndex, props.items.length]);

		const moveSelection = (direction: SuggestionNavigationDirection) => {
			const count = props.items.length;
			if (count === 0) return;
			const current = selectedIndexRef.current;
			const next =
				direction === "up"
					? (current + count - 1) % count
					: (current + 1) % count;
			if (next !== current) directionRef.current = direction;
			selectedIndexRef.current = next;
			setSelectedIndex(next);
		};

		useImperativeHandle(ref, () => ({
			onKeyDown: ({ event }: { event: KeyboardEvent }) => {
				if (event.key === "ArrowUp") {
					moveSelection("up");
					return true;
				}
				if (event.key === "ArrowDown") {
					moveSelection("down");
					return true;
				}
				if (event.key === "Tab") {
					moveSelection(event.shiftKey ? "up" : "down");
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
							props.items.map((item, index) => (
								<div
									key={item.id}
									onClick={() => props.command(item)}
									data-selected={index === selectedIndex}
									className={cn(
										"relative flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1 text-sm outline-hidden select-none",
										index === selectedIndex
											? "bg-foreground/[0.09] text-foreground"
											: "hover:bg-foreground/[0.06]",
									)}
								>
									<div className="flex flex-col min-w-0 flex-1">
										{item.folder && (
											<span
												className={cn(
													"truncate text-[10px] leading-tight pb-0.5",
													index === selectedIndex
														? "text-foreground/60"
														: "text-muted-foreground",
												)}
											>
												{item.folder}
											</span>
										)}
										<span className="truncate font-medium">{item.label}</span>
									</div>
								</div>
							))
						) : (
							<div className="px-3 py-2 text-sm text-muted-foreground italic text-center">
								No matches
							</div>
						)}
					</div>
				</div>
			</div>
		);
	},
);

MentionList.displayName = "MentionList";
