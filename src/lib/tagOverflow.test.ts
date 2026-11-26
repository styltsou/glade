import { describe, expect, it } from "vitest";
import { visibleTagCount } from "./tagOverflow";

const base = { gap: 4, moreWidth: 40 };

describe("visibleTagCount", () => {
	it("shows every tag when they fit", () => {
		expect(visibleTagCount({ ...base, widths: [40, 40, 40], available: 200 })).toBe(3);
		expect(visibleTagCount({ ...base, widths: [], available: 200 })).toBe(0);
	});

	it("keeps the last tag out of the count when they fit exactly, with no gap after it", () => {
		expect(visibleTagCount({ ...base, widths: [50, 50], available: 104 })).toBe(2);
	});

	it("folds the rest into a more tag past the cap", () => {
		expect(visibleTagCount({ ...base, widths: [40, 40, 40, 40, 40], available: 400 })).toBe(3);
	});

	it("never leaves exactly one behind: the last visible tag goes in with it", () => {
		// Four tags, three would show under the cap: that leaves one, so two show.
		expect(visibleTagCount({ ...base, widths: [40, 40, 40, 40], available: 400 })).toBe(2);
		// Three tags where the third doesn't fit beside the more tag: two fit, one is left, so one shows.
		expect(visibleTagCount({ ...base, widths: [60, 60, 60], available: 160 })).toBe(1);
	});

	it("leaves a count of two or more as it is", () => {
		expect(visibleTagCount({ ...base, widths: [40, 40, 40, 40, 40], available: 400 })).toBe(3);
		expect(visibleTagCount({ ...base, widths: [60, 60, 60, 60], available: 170 })).toBe(2);
	});

	it("reserves room for the more tag", () => {
		// Two tags (104) fit alone in 110, but not beside a 40-wide more tag; one tag and the more tag do.
		expect(visibleTagCount({ ...base, widths: [50, 50, 50], available: 110 })).toBe(1);
		expect(visibleTagCount({ ...base, widths: [30, 30, 30, 30], available: 110 })).toBe(2);
	});

	it("can show none, leaving only the more tag", () => {
		expect(visibleTagCount({ ...base, widths: [200, 200], available: 100 })).toBe(0);
	});
});
