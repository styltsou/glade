"use client"

import * as React from "react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

interface IconSwitchProps {
  checkedIcon?: React.ReactNode
  uncheckedIcon?: React.ReactNode
  className?: string
  checked?: boolean
  disabled?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const IconSwitch = React.forwardRef<HTMLDivElement, IconSwitchProps>(
  ({ className, checkedIcon, uncheckedIcon, checked = false, disabled, onCheckedChange }, ref) => {
    return (
      <ToggleGroup
        ref={ref}
        type="single"
        variant="outline"
        size="sm"
        spacing={0}
        value={checked ? "checked" : "unchecked"}
        onValueChange={(val) => {
          if (val) onCheckedChange?.(val === "checked")
        }}
        className={cn("bg-muted", className)}
        disabled={disabled}
      >
        <ToggleGroupItem value="unchecked" aria-label="Unchecked Mode" disabled={disabled}>
          {uncheckedIcon}
        </ToggleGroupItem>
        <ToggleGroupItem value="checked" aria-label="Checked Mode" disabled={disabled}>
          {checkedIcon}
        </ToggleGroupItem>
      </ToggleGroup>
    )
  }
)
IconSwitch.displayName = "IconSwitch"

export { IconSwitch }
