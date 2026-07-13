"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout="dropdown"
      className={cn("p-3", className)}
      classNames={{
        root: cn("w-fit"),
        months: cn("relative flex flex-col gap-4"),
        month: cn("flex flex-col gap-3"),
        month_caption: cn("relative flex items-center justify-center pt-1 pb-1"),
        caption_label: cn("text-sm font-medium text-foreground"),
        weeks: cn(""),
        nav: cn("flex items-center justify-between gap-1 absolute top-3 left-0 right-0 px-1"),
        button_previous: cn(
          "inline-flex size-7 items-center justify-center rounded-lg bg-transparent p-0",
          "text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted/50 transition-opacity"
        ),
        button_next: cn(
          "inline-flex size-7 items-center justify-center rounded-lg bg-transparent p-0",
          "text-muted-foreground opacity-60 hover:opacity-100 hover:bg-muted/50 transition-opacity"
        ),
        month_grid: cn("w-full border-collapse"),
        weekdays: cn("flex"),
        weekday: cn(
          "flex-1 text-[11px] font-medium text-muted-foreground text-center"
        ),
        week: cn("mt-1 flex w-full"),
        day: cn(
          "relative flex-1 p-0 text-center text-[12px] focus-within:relative focus-within:z-20"
        ),
        day_button: cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-lg text-[12px] transition-all",
          "hover:bg-primary/10 hover:text-foreground",
          "focus-visible:ring-2 focus-visible:ring-primary/30"
        ),
        selected: cn(
          "[&_.rdp-day_button]:bg-primary [&_.rdp-day_button]:text-primary-foreground [&_.rdp-day_button]:hover:bg-primary/90 [&_.rdp-day_button]:hover:text-primary-foreground"
        ),
        today: cn(
          "[&_.rdp-day_button]:border [&_.rdp-day_button]:border-primary/50"
        ),
        outside: cn(
          "text-muted-foreground opacity-50 aria-selected:bg-primary/10 aria-selected:text-muted-foreground"
        ),
        disabled: cn(
          "text-muted-foreground opacity-30"
        ),
        hidden: cn("invisible"),
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
          }
          return <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        },
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
