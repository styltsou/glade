/** Most tags a card shows before the rest go behind "+N". */
export const MAX_VISIBLE_TAGS = 3;

/**
 * How many tags to show, so that the rest fit behind a "+N" tag that is
 * itself as wide as `moreWidth`. `widths` holds those of the first tags (as many
 * as could show); `total` is how many tags there are in all.
 *
 * Everything shows if it fits and there are no more than MAX_VISIBLE_TAGS.
 * Otherwise as many show as fit beside the "+N" tag, but never so that
 * exactly one is left over: "+1" would take the room of the tag it hides,
 * so that last visible tag goes in with it.
 */
export function visibleTagCount({
	widths,
	total = widths.length,
	available,
	moreWidth,
	gap,
	max = MAX_VISIBLE_TAGS,
}: {
	widths: number[];
	total?: number;
	available: number;
	moreWidth: number;
	gap: number;
	max?: number;
}): number {
	// Width of the first n tags, each followed by a gap (the "+N" tag, or nothing, comes after).
	const used = (n: number) => widths.slice(0, n).reduce((sum, width) => sum + width + gap, 0);

	if (total <= max && used(total) - gap <= available) return total;

	let count = 0;
	while (count < Math.min(total, max, widths.length) && used(count + 1) + moreWidth <= available) count++;
	if (total - count === 1) count--;
	return Math.max(count, 0);
}
