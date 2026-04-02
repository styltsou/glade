import type { VaultEntry } from "@/types";

export function sortEntries(entries: VaultEntry[]): VaultEntry[] {
  return [...entries].sort((a, b) => {
    if (a.is_dir && !b.is_dir) return -1;
    if (!a.is_dir && b.is_dir) return 1;

    if (a.is_dir && b.is_dir) {
      return a.name.localeCompare(b.name);
    }

    const aModified = a.modified;
    const bModified = b.modified;

    if (aModified === null && bModified === null) return a.name.localeCompare(b.name);
    if (aModified === null) return -1;
    if (bModified === null) return 1;

    return new Date(bModified).getTime() - new Date(aModified).getTime();
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
      // OR logic: show note if it has ANY of the selected tags
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
