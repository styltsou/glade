import type { ThemeId } from "@/themes";
import { cn } from "@/lib/utils";

/** A tiny live render of a theme: its background and its accent, side by side. */
export function ThemeSwatch({ theme, mode, className }: { theme: ThemeId; mode: "light" | "dark"; className?: string }) {
  return (
    <span
      data-theme={theme}
      data-mode={mode}
      aria-hidden
      className={cn("inline-flex size-4 shrink-0 overflow-hidden rounded-full border border-border", className)}
    >
      <span className="h-full w-1/2 bg-background" />
      <span className="h-full w-1/2 bg-primary" />
    </span>
  );
}
