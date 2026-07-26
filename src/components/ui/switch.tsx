"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  checked,
  ...props
}: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      checked={checked}
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "bg-primary shadow-[inset_0_1px_2px_rgba(0,0,0,0.15)]"
          : "bg-input shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ease-out",
          checked
            ? "translate-x-5.5 shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
            : "translate-x-0.5 shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
