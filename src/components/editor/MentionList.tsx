import {
	forwardRef,
	useImperativeHandle,
	useState,
	useEffect,
	useLayoutEffect,
	useRef,
} from "react";
import { cn } from "@/lib/utils";

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
					className="relative flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
					data-suggestion-menu="true"
				>
					<div
						ref={commandListRef}
						className="max-h-56.25 overflow-y-auto p-1"
						style={{ scrollbarWidth: "none" }}
					>
						{props.items.length ? (
							props.items.map((item, index) => (
								<div
									key={item.id}
									onClick={() => props.command(item)}
									data-selected={index === selectedIndex}
									className={cn(
										"relative flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none",
										index === selectedIndex
											? "bg-accent text-accent-foreground"
											: "hover:bg-accent/50",
									)}
								>
									<div className="flex flex-col min-w-0 flex-1">
										{item.folder && (
											<span
												className={cn(
													"truncate text-[10px] leading-tight pb-0.5",
													index === selectedIndex
														? "text-accent-foreground/70"
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
