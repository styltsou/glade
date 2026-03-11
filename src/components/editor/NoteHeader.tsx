import { Breadcrumbs } from "@/components/Breadcrumbs";
import { BookOpen as ReaderIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

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
        <AnimatePresence mode="wait">
          {saveStatus !== "idle" && (
            <motion.span
              key={saveStatus}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "text-muted-foreground",
                saveStatus === "saved" && "text-primary font-medium"
              )}
            >
              {saveStatus === "saved" ? "Saved" : "Unsaved"}
            </motion.span>
          )}
        </AnimatePresence>
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
