"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

function Tooltip({ children, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>;
}

function TooltipTrigger({
  className,
  children,
  delay = 0,
  closeDelay = 0,
  ...props
}: TooltipPrimitive.Trigger.Props & { children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Trigger
      delay={delay}
      closeDelay={closeDelay}
      render={<span className={cn("inline-flex", className)} />}
      {...props}
    >
      {children}
    </TooltipPrimitive.Trigger>
  );
}

function TooltipContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        positionMethod="fixed"
        collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "none" }}
        className="z-9999"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "relative z-9999 w-auto origin-(--transform-origin) overflow-visible rounded-[10px] border border-amber-400",
            "bg-amber-100 px-2 py-1.5 app-body text-amber-950 backdrop-blur-xl",
            "shadow-[0_8px_24px_rgba(0,0,0,0.18)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.45)]",
            "dark:border-amber-500 dark:bg-amber-900 dark:text-amber-50",
            "duration-100 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1",
            "data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1",
            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-100",
            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
