import { describe, expect, it } from "vitest";
import { filterHome, flattenHome, fuzzyScore } from "./fuzzy";
import type { HomeData, HomeEntry } from "@/types";

const e = (path: string): HomeEntry => ({ path, name: path.split("/").pop()!, exists: true });

const data: HomeData = {
  pinned_folders: [e("/home/u/code/glade"), e("/home/u/notes")],
  recent_folders: [e("/home/u/code/api")],
  recent_files: [e("/home/u/Downloads/plan.md")],
};

describe("fuzzyScore", () => {
  it("matches subsequences and rejects others", () => {
    expect(fuzzyScore("gla", "glade")).not.toBeNull();
    expect(fuzzyScore("gde", "glade")).not.toBeNull();
    expect(fuzzyScore("xyz", "glade")).toBeNull();
  });

  it("prefers consecutive and word-start matches", () => {
    expect(fuzzyScore("gla", "glade")!).toBeGreaterThan(fuzzyScore("gla", "g-l-a")!);
    expect(fuzzyScore("api", "api")!).toBeGreaterThan(fuzzyScore("api", "a-p-i-x")!);
  });
});

describe("filterHome", () => {
  it("returns everything for an empty query", () => {
    expect(filterHome(data, "")).toEqual(data);
  });

  it("filters every group by name or path and keeps the first match first", () => {
    const out = filterHome(data, "gla");
    expect(out.pinned_folders.map((x) => x.name)).toEqual(["glade"]);
    expect(out.recent_folders).toEqual([]);
    expect(flattenHome(out)[0].name).toBe("glade");
  });

  it("matches on the path as well as the name", () => {
    const out = filterHome(data, "downloads");
    expect(out.recent_files).toHaveLength(1);
  });

  it("flattens in display order", () => {
    expect(flattenHome(data).map((x) => x.name)).toEqual(["glade", "notes", "api", "plan.md"]);
  });
});
