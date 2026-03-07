import React from "react";
import { BookOpen as ReaderIcon, Home } from "lucide-react";
import { useStore } from "@/store";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface NoteHeaderProps {
  notePath: string;
  noteTitle: string;
  dateLabel: string | null;
  saveStatus: "idle" | "saving" | "saved";
}

export function NoteHeader({ notePath, noteTitle, dateLabel, saveStatus }: NoteHeaderProps) {
  const goHome = useStore((state) => state.goHome);
  
  const segments = notePath.split("/");
  const folderSegments = segments.slice(0, -1);

  return (
    <div className="flex items-center justify-between px-6 py-3 min-h-[44px] shrink-0 select-none overflow-hidden">
      <div className="flex items-center min-w-0 pr-4">
        <Breadcrumb>
          <BreadcrumbList className="text-[14px] sm:text-[15px]">
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={goHome} 
                className="cursor-pointer flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
                title="Go Home"
              >
                <Home className="h-4 w-4" />
                Home
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            {folderSegments.map((folder, i) => (
              <React.Fragment key={i}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <span className="truncate max-w-[150px] cursor-default opacity-80" title={folder}>
                    {folder}
                  </span>
                </BreadcrumbItem>
              </React.Fragment>
            ))}
            
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="font-semibold text-foreground truncate max-w-[250px]" title={noteTitle}>
                {noteTitle}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-4 shrink-0 text-[13px] sm:text-[14px] text-muted-foreground">
        <span className="w-14 text-right opacity-70">
          {saveStatus === "saving"
            ? "Saving…"
            : saveStatus === "saved"
              ? "Saved"
              : ""}
        </span>
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
