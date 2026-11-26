import * as React from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function InputGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="group"
      data-slot="input-group"
      className={cn(
        "flex h-9 w-full min-w-0 items-center rounded-md border border-input bg-transparent shadow-xs transition-[border-color,box-shadow] dark:bg-input/30",
        "has-[[data-slot=input-group-control]:focus:not([aria-invalid=true])]:border-primary has-[[data-slot=input-group-control]:focus-visible]:ring-2 has-[[data-slot=input-group-control]:focus-visible:not([aria-invalid=true])]:ring-primary/20",
        "has-[[aria-invalid=true]]:border-destructive has-[[aria-invalid=true]]:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

const InputGroupInput = React.forwardRef<HTMLInputElement, React.ComponentProps<typeof Input>>(
  function InputGroupInput({ className, ...props }, ref) {
    return (
      <Input
        ref={ref}
        data-slot="input-group-control"
        className={cn("h-full flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent", className)}
        {...props}
      />
    )
  }
)

function InputGroupAddon({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn("flex h-full shrink-0 cursor-text items-center pr-3 text-sm text-muted-foreground select-none", className)}
      onMouseDown={(event) => {
        event.preventDefault()
        event.currentTarget.parentElement?.querySelector("input")?.focus()
      }}
      {...props}
    />
  )
}

export { InputGroup, InputGroupInput, InputGroupAddon }
