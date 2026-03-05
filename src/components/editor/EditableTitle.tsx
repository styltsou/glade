import { useState, useRef } from "react";
import { useVaultStore } from "@/stores/useVaultStore";

interface EditableTitleProps {
  title: string;
  path: string;
}

export function EditableTitle({ title, path }: EditableTitleProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { renameNote } = useVaultStore();

  const handleStartEditing = () => {
    setTempTitle(title);
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleSaveTitle = async () => {
    const trimmed = tempTitle.trim();
    if (trimmed && trimmed !== title) {
      await renameNote(path, trimmed);
    }
    setIsEditingTitle(false);
  };

  const handleCancelEditing = () => {
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      handleCancelEditing();
    }
  };

  return (
    <div className="mb-1 flex items-center overflow-visible">
      {isEditingTitle ? (
        <div className="relative inline-grid items-center -ml-3 px-3 py-2 min-h-[52px] rounded-lg border border-primary/20 bg-background/50 shadow-sm">
          <span className="invisible whitespace-pre text-[32px] font-bold font-sans tracking-tight leading-none px-1 h-full min-w-[50px]">
            {tempTitle || "Untitled"}
          </span>
          <input
            ref={titleInputRef}
            type="text"
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleTitleKeyDown}
            className="absolute inset-x-3 inset-y-2 bg-transparent text-[32px] font-bold font-sans text-foreground tracking-tight underline decoration-primary decoration-2 underline-offset-8 outline-none px-1 h-8 leading-none"
            autoFocus
          />
        </div>
      ) : (
        <div 
          className="group relative flex items-center w-fit border border-transparent rounded-lg -ml-3 px-3 py-2 cursor-pointer active:scale-[0.99] hover:bg-muted/30 hover:border-border"
          onClick={handleStartEditing}
        >
          <h1 className="text-[32px] font-bold font-sans text-foreground tracking-tight leading-none select-none">
            {title}
          </h1>
        </div>
      )}
    </div>
  );
}
