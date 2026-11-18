import type { HomeData, HomeEntry } from "@/types";

/** Subsequence match score, or null when `query` does not match `text`. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  let qi = 0;
  let score = 0;
  let last = -2;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += last === i - 1 ? 5 : 1;
      if (i === 0 || "/-_. ".includes(t[i - 1])) score += 3;
      last = i;
      qi++;
    }
  }
  return qi === q.length ? score : null;
}

/** Best score of an entry across its name (weighted) and full path. */
export function scoreEntry(query: string, entry: HomeEntry): number | null {
  const byName = fuzzyScore(query, entry.name);
  const byPath = fuzzyScore(query, entry.path);
  if (byName === null && byPath === null) return null;
  return Math.max((byName ?? 0) * 2, byPath ?? 0);
}

function filterList(query: string, list: HomeEntry[]): HomeEntry[] {
  if (!query.trim()) return list;
  return list
    .map((entry) => ({ entry, score: scoreEntry(query.trim(), entry) }))
    .filter((x): x is { entry: HomeEntry; score: number } => x.score !== null)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.entry);
}

/** Filter every Home group; each group keeps its own ordering rules. */
export function filterHome(data: HomeData, query: string): HomeData {
  return {
    pinned_folders: filterList(query, data.pinned_folders),
    recent_folders: filterList(query, data.recent_folders),
    recent_files: filterList(query, data.recent_files),
  };
}

/** Flatten groups into the order they are shown (for keyboard navigation). */
export function flattenHome(data: HomeData): HomeEntry[] {
  return [...data.pinned_folders, ...data.recent_folders, ...data.recent_files];
}
