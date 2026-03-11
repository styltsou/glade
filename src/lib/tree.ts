import type { VaultEntry } from '@/types';

export function addEntryToTree(
  entries: VaultEntry[], 
  folder: string | undefined, 
  newEntry: VaultEntry
): VaultEntry[] {
  if (!folder) {
    return [newEntry, ...entries];
  }
  
  return entries.map(entry => {
    if (entry.path === folder && entry.is_dir) {
      return { ...entry, children: [newEntry, ...(entry.children || [])] };
    }
    if (entry.children && entry.children.length > 0) {
      return { ...entry, children: addEntryToTree(entry.children, folder, newEntry) };
    }
    return entry;
  });
}

export function removeEntryFromTree(
  entries: VaultEntry[], 
  path: string
): VaultEntry[] {
  return entries
    .filter(entry => entry.path !== path)
    .map(entry => ({
      ...entry,
      children: entry.children.length > 0 ? removeEntryFromTree(entry.children, path) : [],
    }));
}

function updatePathsRecursive(
  entry: VaultEntry, 
  oldPath: string, 
  newPath: string
): VaultEntry {
  const relativePath = entry.path.substring(oldPath.length);
  const updatedPath = newPath + relativePath;
  
  return {
    ...entry,
    path: updatedPath,
    children: entry.children.map(child => updatePathsRecursive(child, oldPath, newPath))
  };
}

export function moveEntryInTree(
  entries: VaultEntry[], 
  fromPath: string, 
  toPath: string
): VaultEntry[] {
  let movingEntry: VaultEntry | null = null;
  
  function findAndRemove(list: VaultEntry[]): VaultEntry[] {
    return list.filter(e => {
      if (e.path === fromPath) {
        movingEntry = e;
        return false;
      }
      return true;
    }).map(e => ({
      ...e,
      children: e.children.length > 0 ? findAndRemove(e.children) : [],
    }));
  }
  
  const treeWithoutEntry = findAndRemove(entries);
  if (!movingEntry) return entries;

  const updatedEntry = updatePathsRecursive(movingEntry, fromPath, toPath);
  updatedEntry.name = toPath.split("/").pop() || updatedEntry.name;

  const targetParentPath = toPath.substring(0, toPath.lastIndexOf('/'));
  
  if (!targetParentPath) {
    return [updatedEntry, ...treeWithoutEntry];
  }

  function insertIntoParent(list: VaultEntry[]): VaultEntry[] {
    return list.map(e => {
      if (e.path === targetParentPath && e.is_dir) {
        return { ...e, children: [updatedEntry, ...(e.children || [])] };
      }
      return {
        ...e,
        children: e.children.length > 0 ? insertIntoParent(e.children) : [],
      };
    });
  }

  return insertIntoParent(treeWithoutEntry);
}

export function updateEntryInTree(
  entries: VaultEntry[], 
  path: string, 
  changes: Partial<VaultEntry>
): VaultEntry[] {
  return entries.map(entry => {
    if (entry.path === path) {
      return { ...entry, ...changes };
    }
    if (entry.children.length > 0) {
      return { ...entry, children: updateEntryInTree(entry.children, path, changes) };
    }
    return entry;
  });
}
