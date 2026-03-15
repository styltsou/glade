import type { ImportedFile, FolderNode } from "./types";

export function buildFolderTree(files: ImportedFile[]): FolderNode[] {
  const root: FolderNode[] = [];

  for (const file of files) {
    const parts = file.relative_path.split("/").filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");

      if (isLast) {
        current.push({
          name: part,
          path: file.relative_path,
          isDir: false,
          children: [],
        });
      } else {
        let node = current.find((n) => n.name === part && n.isDir) as
          | FolderNode
          | undefined;
        if (!node) {
          node = {
            name: part,
            path,
            isDir: true,
            children: [],
            fileCount: 0,
          };
          current.push(node);
        }
        current = node.children;
      }
    }
  }

  function countFiles(nodes: FolderNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (!node.isDir) count++;
      count += countFiles(node.children);
    }
    return count;
  }

  function setFileCounts(nodes: FolderNode[]) {
    for (const node of nodes) {
      if (node.isDir) {
        node.fileCount = countFiles(node.children);
        setFileCounts(node.children);
      }
    }
  }
  setFileCounts(root);

  return root;
}
