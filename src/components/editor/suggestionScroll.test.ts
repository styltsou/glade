import { describe, expect, it } from "vitest";
import { getSuggestionScrollTop } from "./suggestionScroll";

const base = {
	itemCount: 12,
	itemHeight: 32,
	clientHeight: 224,
	scrollHeight: 416,
};

describe("getSuggestionScrollTop", () => {
	it("stays still until the active item reaches the bottom anchor", () => {
		expect(
			getSuggestionScrollTop({
				...base,
				direction: "down",
				selectedIndex: 4,
				itemTop: 128,
				scrollTop: 0,
			}),
		).toBe(0);
	});

	it("pins downward navigation one row from the bottom", () => {
		expect(
			getSuggestionScrollTop({
				...base,
				direction: "down",
				selectedIndex: 6,
				itemTop: 192,
				scrollTop: 0,
			}),
		).toBe(32);
	});

	it("pins upward navigation one row from the top", () => {
		expect(
			getSuggestionScrollTop({
				...base,
				direction: "up",
				selectedIndex: 4,
				itemTop: 128,
				scrollTop: 160,
			}),
		).toBe(96);
	});

	it("reveals the full list at either end, including wrapped navigation", () => {
		for (const direction of ["up", "down"] as const) {
			expect(
				getSuggestionScrollTop({
					...base,
					direction,
					selectedIndex: 0,
					itemTop: 24,
					scrollTop: 120,
				}),
			).toBe(0);
			expect(
				getSuggestionScrollTop({
					...base,
					direction,
					selectedIndex: 11,
					itemTop: 352,
					scrollTop: 96,
				}),
			).toBe(192);
		}
	});

	it("handles empty and non-scrollable lists", () => {
		expect(
			getSuggestionScrollTop({
				direction: "down",
				selectedIndex: 0,
				itemCount: 1,
				itemTop: 24,
				itemHeight: 32,
				scrollTop: 12,
				clientHeight: 224,
				scrollHeight: 160,
			}),
		).toBe(0);
	});
});
