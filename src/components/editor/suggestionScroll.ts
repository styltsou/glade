export type SuggestionNavigationDirection = "up" | "down";

interface SuggestionScrollInput {
	direction: SuggestionNavigationDirection;
	selectedIndex: number;
	itemCount: number;
	itemTop: number;
	itemHeight: number;
	scrollTop: number;
	clientHeight: number;
	scrollHeight: number;
}

/**
 * Keeps the keyboard-active row one row in from the edge it is travelling
 * toward, so the list scrolls under the highlight instead of the highlight
 * running to the edge. The first and last items reveal the full scroll extent
 * so group headings and the list gutter stay visible.
 */
export function getSuggestionScrollTop({
	direction,
	selectedIndex,
	itemCount,
	itemTop,
	itemHeight,
	scrollTop,
	clientHeight,
	scrollHeight,
}: SuggestionScrollInput): number {
	const maximumScrollTop = Math.max(0, scrollHeight - clientHeight);
	const currentScrollTop = clamp(scrollTop, 0, maximumScrollTop);

	if (itemCount === 0 || selectedIndex <= 0) return 0;
	if (selectedIndex >= itemCount - 1) return maximumScrollTop;

	if (direction === "down") {
		const anchoredBottom = currentScrollTop + clientHeight - itemHeight;
		const itemBottom = itemTop + itemHeight;
		return itemBottom > anchoredBottom
			? clamp(itemBottom - (clientHeight - itemHeight), 0, maximumScrollTop)
			: currentScrollTop;
	}

	const anchoredTop = currentScrollTop + itemHeight;
	return itemTop < anchoredTop
		? clamp(itemTop - itemHeight, 0, maximumScrollTop)
		: currentScrollTop;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}
