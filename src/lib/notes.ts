import type { VaultEntry, NoteSearchResult } from '@/types';

export function flattenNotes(
  entries: VaultEntry[],
): NoteSearchResult[] {
  if (!entries) return [];
  const notes: NoteSearchResult[] = [];
  
  for (const entry of entries) {
    if (!entry) continue;
    if (entry.is_dir) {
      if (entry.children && entry.children.length > 0) {
        notes.push(...flattenNotes(entry.children));
      }
    } else {
      notes.push({ 
        title: entry.name, 
        path: entry.path, 
        tags: entry.tags 
      });
    }
  }
  
  return notes;
}
