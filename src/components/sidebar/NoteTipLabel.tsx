import { baseName, splitExtension } from "@/lib/paths";

/** Tooltip for a listed note: its title, and its file when that says something else. */
export function NoteTipLabel({ title, path }: { title: string; path: string }) {
  if (title === splitExtension(path).stem) return <>{baseName(path)}</>;
  return (
    <>
      <span className="block">{title}</span>
      <span className="block opacity-60">{baseName(path)}</span>
    </>
  );
}
