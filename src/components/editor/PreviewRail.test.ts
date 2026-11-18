import { describe, expect, it } from "vitest";

import {
  getVisibleSectionIds,
  isPreviewRailSectionHighlighted,
  shouldShowPreviewRail,
} from "./PreviewRail";

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
