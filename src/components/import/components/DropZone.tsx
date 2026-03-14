import { Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface DropZoneProps {
  isDragging: boolean;
  isLoading: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

export function DropZone({
  isDragging,
  isLoading,
  onDragOver,
  onDragLeave,
  onDrop,
  onClick,
}: DropZoneProps) {
  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 transition-colors cursor-pointer",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50",
        isLoading && "pointer-events-none opacity-50",
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        {isLoading ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Scanning files...</p>
          </>
        ) : (
          <>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">Click to select or drag and drop</p>
              <p className="text-sm text-muted-foreground mt-1">
                Select a markdown file or folder containing .md files
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
