import type { SortMode, VaultEntry } from "@/types";

export function sortEntries(
  entries: VaultEntry[],
  sort: SortMode
): VaultEntry[] {
  const copy = [...entries];
  if (sort === "name-asc") {
    return copy.sort((a, b) => a.name.localeCompare(b.name));
  }
  if (sort === "name-desc") {
    return copy.sort((a, b) => b.name.localeCompare(a.name));
  }
  return copy.sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;
    if (!a.modified || !b.modified) return 0;
    return new Date(b.modified).getTime() - new Date(a.modified).getTime();
  });
}

export function filterByTags(
  entries: VaultEntry[],
  tagFilters: string[]
): VaultEntry[] {
  if (tagFilters.length === 0) return entries;
  
  return entries
    .map((entry) => {
      if (entry.is_dir) {
        const filteredChildren = filterByTags(entry.children, tagFilters);
        return { ...entry, children: filteredChildren };
      }
      return entry;
    })
    .filter((entry) => {
      if (entry.is_dir) return entry.children.length > 0;
      // Show note if it has ANY of the selected tags
      return entry.tags.some((tag) => tagFilters.includes(tag));
    });
}

export function findEntryByPath(entries: VaultEntry[], path: string): VaultEntry | null {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    if (entry.children) {
      const found = findEntryByPath(entry.children, path);
      if (found) return found;
    }
  }
  return null;
}
