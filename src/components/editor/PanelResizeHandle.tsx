import { cn } from "@/lib/utils";

/**
 * The left edge of a right-hand panel, where it is dragged wider or narrower.
 * It draws nothing: while it is hovered or dragged, the left edge of the card
 * after it lights up in the accent, as the page does for the sidebar.
 */
export function PanelResizeHandle({
  dragging,
  className,
  ...props
}: Omit<React.ComponentProps<"div">, "children"> & { dragging: boolean }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      data-dragging={dragging}
      // Reaches 6px over the card's edge; the card has no controls that close to it.
      className={cn("panel-resize-handle absolute bottom-2 left-0 top-2 z-10 w-2.5 cursor-col-resize touch-none", className)}
      {...props}
    />
  );
}

/** The card beside a handle: see `.panel-card` in styles/surfaces.css for how its left edge lights up. */
export const PANEL_CARD = "panel-card";
