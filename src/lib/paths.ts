/** Last path segment. */
export function baseName(path: string): string {
  const parts = path.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** A file name split into its stem and its extension (`.md`, with the dot). */
export function splitExtension(path: string): { stem: string; ext: string } {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? { stem: name.slice(0, dot), ext: name.slice(dot) } : { stem: name, ext: "" };
}

/** Whether a note's file still waits for its first title to name it. */
export function isUntitled(path: string): boolean {
  return /^untitled(?:[- ][0-9]+)?$/i.test(splitExtension(path).stem);
}

/** Directory part of a path. */
export function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i > 0 ? path.slice(0, i) : "/";
}

/** Replace the home directory prefix with `~`. */
export function shortenPath(path: string, home: string): string {
  if (home && (path === home || path.startsWith(home + "/") || path.startsWith(home + "\\"))) {
    return "~" + path.slice(home.length);
  }
  return path;
}

/** Path of `abs` relative to `root`, or null when it is outside the root. */
export function relativeTo(root: string, abs: string): string | null {
  const prefix = root.endsWith("/") ? root : root + "/";
  return abs.startsWith(prefix) ? abs.slice(prefix.length) : null;
}
