/** Most tags a card shows before the rest go behind "N more". */
export const MAX_VISIBLE_TAGS = 3;

/**
 * How many tags to show, given each one's width, so that the rest fit behind a
 * "N more" tag that is itself as wide as `moreWidth`.
 *
 * Everything shows if it fits and there are no more than MAX_VISIBLE_TAGS.
 * Otherwise as many show as fit beside the "more" tag, but never so that
 * exactly one is left over: "1 more" would take the room of the tag it hides,
 * so that last visible tag goes in with it.
 */
export function visibleTagCount({
	widths,
	available,
	moreWidth,
	gap,
	max = MAX_VISIBLE_TAGS,
}: {
	widths: number[];
	available: number;
	moreWidth: number;
	gap: number;
	max?: number;
}): number {
	const total = widths.length;
	// Width of the first n tags, each followed by a gap (the "more" tag, or nothing, comes after).
	const used = (n: number) => widths.slice(0, n).reduce((sum, width) => sum + width + gap, 0);

	if (total <= max && used(total) - gap <= available) return total;

	let count = 0;
	while (count < Math.min(total, max) && used(count + 1) + moreWidth <= available) count++;
	if (total - count === 1) count--;
	return Math.max(count, 0);
}
