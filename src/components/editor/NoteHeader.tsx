import { BookOpen as ReaderIcon } from "lucide-react";

interface NoteHeaderProps {
  dateLabel: string | null;
  saveStatus: "idle" | "saving" | "saved";
}

export function NoteHeader({ dateLabel, saveStatus }: NoteHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 h-9 shrink-0 text-[12px] text-muted-foreground select-none">
      <div className="flex items-center gap-1.5">
        <ReaderIcon className="w-3 h-3" />
        {dateLabel && <span>{dateLabel}</span>}
      </div>
      <span className="text-muted-foreground">
        {saveStatus === "saving"
          ? "Saving…"
          : saveStatus === "saved"
            ? "Saved"
            : ""}
      </span>
    </div>
  );
}
