import { cn } from "@/lib/utils";
import { SPLIT_GAP } from "@/lib/surfaces";

/** How wide the area a resizer can be grabbed in is, whichever seam it sits on. */
export const GRIP_REACH = 10;

/**
 * The draggable seam between two surfaces: between split panes, and between
 * the sidebar and the page. It is one component so the two can't drift apart:
 * a strip of frame, `SPLIT_GAP` wide, holds a 3px rounded line that shows on
 * hover and while dragging, and the grab area around it is always `GRIP_REACH`.
 *
 * Only the grab area responds to the pointer, so its width is exactly that and
 * not also the strip's. The strip is placed by the caller, against the
 * right-hand page's left edge.
 * `before` is how far the grab area reaches past the strip's left side, over
 * whatever is there (the left page's edge, or the sidebar's scrollbar), and
 * may be negative to start inside the strip. The rest of the reach goes over
 * the right-hand page.
 */
export function ResizeGrip({
  before,
  dragging,
  className,
  style,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { before: number; dragging?: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      data-dragging={dragging ? "true" : undefined}
      className={cn("group pointer-events-none absolute z-10 cursor-col-resize", className)}
      style={{ width: SPLIT_GAP, ...style }}
      {...props}
    >
      <span className="pointer-events-auto absolute inset-y-0" style={{ left: -before, right: before + SPLIT_GAP - GRIP_REACH }} />
      <span className="absolute inset-x-px inset-y-2 rounded-full transition-colors group-hover:bg-primary/40 group-data-[dragging=true]:bg-primary/60" />
    </div>
  );
}
