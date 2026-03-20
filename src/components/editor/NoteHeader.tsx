import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BookOpen as ReaderIcon } from "lucide-react";

interface NoteHeaderProps {
  notePath: string;
  noteTitle: string;
  dateLabel: string | null;
  saveStatus: "unsaved" | "saved" | "idle";
}

export function NoteHeader({ notePath, noteTitle, dateLabel, saveStatus }: NoteHeaderProps) {
  const segments = notePath.split("/");
  const parentPath = segments.slice(0, -1).join("/") || null;

  return (
    <div className="flex items-center justify-between px-6 py-3 min-h-[44px] shrink-0 select-none overflow-hidden">
      <div className="flex items-center min-w-0 pr-4">
        <Breadcrumbs path={parentPath} activeItem={noteTitle} />
      </div>

      <div className="flex items-center gap-4 shrink-0 text-[13px] sm:text-[14px] text-muted-foreground">
        {saveStatus !== "idle" && (
          <span className="text-muted-foreground">
            {saveStatus === "saved" ? "Saved" : "Unsaved"}
          </span>
        )}
        {dateLabel && (
          <div className="flex items-center gap-1.5 opacity-70">
            <ReaderIcon className="w-4 h-4" />
            <span>{dateLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
