import { describe, expect, it } from "vitest";

import {
  getOutlineScrollAdjustment,
  getVisibleSectionIds,
  isPreviewRailSectionHighlighted,
  shouldShowPreviewRail,
} from "./PreviewRail";

describe("getOutlineScrollAdjustment", () => {
  it("leaves comfortably visible headings in place", () => {
    expect(getOutlineScrollAdjustment(100, 500, 200, 240)).toBe(0);
  });

  it("brings headings near or beyond either edge toward the center", () => {
    expect(getOutlineScrollAdjustment(100, 500, 105, 145)).toBe(-175);
    expect(getOutlineScrollAdjustment(100, 500, 520, 560)).toBe(240);
  });
});

describe("shouldShowPreviewRail", () => {
  it("requires at least 1 heading", () => {
    expect(shouldShowPreviewRail(0, 3_000, 1_000)).toBe(false);
  });

  it("hides the rail when overflow is less than a quarter viewport", () => {
    expect(shouldShowPreviewRail(2, 1_249, 1_000)).toBe(false);
  });

  it("shows the rail at a quarter viewport of overflow", () => {
    expect(shouldShowPreviewRail(2, 1_250, 1_000)).toBe(true);
  });

  it("shows the rail for a long note with a single section", () => {
    expect(shouldShowPreviewRail(1, 1_500, 1_000)).toBe(true);
  });

  it("waits for a measurable viewport", () => {
    expect(shouldShowPreviewRail(3, 4_000, 0)).toBe(false);
  });
});

describe("getVisibleSectionIds", () => {
  const sections = [
    { id: "introduction", top: 100 },
    { id: "planning", top: 400 },
    { id: "delivery", top: 800 },
  ];

  it("marks every section occupying the viewport as visible", () => {
    expect(getVisibleSectionIds(sections, 250, 900)).toEqual([
      "introduction",
      "planning",
      "delivery",
    ]);
  });

  it("excludes sections that end before the viewport", () => {
    expect(getVisibleSectionIds(sections, 450, 700)).toEqual(["planning"]);
  });
});

describe("isPreviewRailSectionHighlighted", () => {
  it("colors every visible section while the rail is idle", () => {
    expect(isPreviewRailSectionHighlighted(0, null, true)).toBe(true);
    expect(isPreviewRailSectionHighlighted(1, null, false)).toBe(false);
  });

  it("colors only the hovered section during hover", () => {
    expect(isPreviewRailSectionHighlighted(0, 1, true)).toBe(false);
    expect(isPreviewRailSectionHighlighted(1, 1, false)).toBe(true);
  });
});
