import * as React from "react"
import { Tooltip as TooltipPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * The first tooltip waits a moment so passing the pointer over a toolbar does
 * not set them off. Once one is open, moving to a neighbour opens it at once
 * and without animation (Radix marks it `instant-open`), for a short while
 * after the last one closes.
 */
function TooltipProvider({
  delayDuration = 450,
  skipDelayDuration = 400,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

const TooltipTrigger = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Trigger>,
  React.ComponentProps<typeof TooltipPrimitive.Trigger>
>(function TooltipTrigger(props, ref) {
  return <TooltipPrimitive.Trigger ref={ref} data-slot="tooltip-trigger" {...props} />
})
TooltipTrigger.displayName = "TooltipTrigger"

/** No arrow. Motion is tuned in globals.css: a short ease-out fade and
 * near-1 scale from the trigger, a quicker exit, none when `instant-open`. */
function TooltipContent({
  className,
  side = "right",
  sideOffset = 6,
  collisionPadding = 8,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        side={side}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-50 w-fit origin-(--radix-tooltip-content-transform-origin) animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 max-w-80 rounded-md bg-foreground px-2 py-1 text-xs text-balance break-words text-background shadow-md select-none",
          className
        )}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

/**
 * The app's replacement for the native `title` attribute: wraps one element
 * (which must accept a ref and props, like a button or span) in a tooltip.
 * With no `label` it renders the child untouched.
 */
function Tip({
  label,
  side = "bottom",
  align,
  className,
  children,
}: {
  label: React.ReactNode
  side?: React.ComponentProps<typeof TooltipPrimitive.Content>["side"]
  align?: React.ComponentProps<typeof TooltipPrimitive.Content>["align"]
  className?: string
  children: React.ReactElement
}) {
  if (label == null || label === "") return children
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} align={align} className={className}>{label}</TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, Tip }
