import { FolderOpen } from "lucide-react";

export function AboutSection() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h3 className="text-lg font-semibold">About</h3>
        <p className="text-sm text-muted-foreground">
          Information about Glade.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
          <FolderOpen className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h4 className="text-xl font-semibold">Glade</h4>
          <p className="text-sm text-muted-foreground">Version 0.1.0</p>
        </div>
      </div>

      <div className="text-sm text-muted-foreground space-y-2">
        <p>
          Glade is a modern, local-first note-taking application built with Tauri and React.
        </p>
        <p>
          Your notes are stored locally in markdown format, giving you full control over your data.
        </p>
      </div>

      <div className="pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Built with Tauri v2 • React • TipTap • Tailwind CSS
        </p>
      </div>
    </div>
  );
}
