import { useStore } from "@/store";
import { shortenPath, splitExtension } from "@/lib/paths";
import { noteLabel } from "@/lib/noteLabel";

/**
 * Tooltip for a note: the name its row shows, then what the row hides. Showing
 * titles, that is the file's path; showing file names, it is the title, or the
 * path when the note has no title of its own.
 */
export function NoteTipLabel({ path, title }: { path: string; title?: string | null }) {
  const home = useStore((s) => s.homeDir);
  const mode = useStore((s) => s.noteLabel);
  const shown = noteLabel(mode, path, title);
  const ownTitle = title?.trim() && title.trim() !== splitExtension(path).stem ? title.trim() : null;
  const hidden = mode === "filename" && ownTitle ? ownTitle : shortenPath(path, home);
  return (
    <>
      <span className="block">{shown}</span>
      <span className="block opacity-60">{hidden}</span>
    </>
  );
}
