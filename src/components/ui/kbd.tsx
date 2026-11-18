import * as React from "react";
import { cn } from "@/lib/utils";

/** A single key cap. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-border/70 bg-muted/60 px-1 font-sans text-[10px] leading-none font-medium text-muted-foreground [&_svg:not([class*='size-'])]:size-2.5",
        className,
      )}
      {...props}
    />
  );
}

/** Key caps for a shortcut, side by side. */
export function KbdGroup({ keys, className }: { keys: string[]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {keys.map((key, i) => (
        <Kbd key={i}>{key}</Kbd>
      ))}
    </span>
  );
}
