import { cn } from "@/lib/utils";
import { SPLIT_GAP } from "@/lib/surfaces";

/** How wide the area a resizer can be grabbed in is, whichever seam it sits on. */
export const GRIP_REACH = 10;

/**
 * The draggable seam between split panes: a strip of frame, `SPLIT_GAP` wide.
 * It draws nothing itself: on hover and while dragging, the right-hand page's
 * left edge lights up (see styles/surfaces.css), as the sidebar's seam lights
 * the page to its right. The grab area is always `GRIP_REACH` wide.
 *
 * Only the grab area responds to the pointer, so its width is exactly that and
 * not also the strip's. The strip is placed by the caller, against the
 * right-hand page's left edge.
 * `before` is how far the grab area reaches past the strip's left side, over
 * the left page's edge. The rest of the reach goes over the right-hand page.
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
      className={cn("pane-resize-handle pointer-events-none absolute z-10 cursor-col-resize", className)}
      style={{ width: SPLIT_GAP, ...style }}
      {...props}
    >
      <span className="pointer-events-auto absolute inset-y-0" style={{ left: -before, right: before + SPLIT_GAP - GRIP_REACH }} />
    </div>
  );
}
