"use client"

import * as React from "react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DatePickerProps {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  clearable?: boolean
}

function DatePicker({
  value,
  onChange,
  placeholder = "dd-mm-aaaa",
  className,
  disabled,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const date = value ? parseISO(value) : undefined

  const handleSelect = (selected: Date | undefined) => {
    if (selected) {
      const year = selected.getFullYear()
      const month = String(selected.getMonth() + 1).padStart(2, "0")
      const day = String(selected.getDate()).padStart(2, "0")
      onChange(`${year}-${month}-${day}`)
    } else {
      onChange("")
    }
    setOpen(false)
  }

  const displayValue = date ? format(date, "dd-MM-yyyy") : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "liquid-date-picker group/date-picker flex w-fit items-center justify-between gap-2",
              !date && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[12px]">{displayValue}</span>
            {clearable && date && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange("")
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation()
                    onChange("")
                  }
                }}
                className="ml-1 inline-flex rounded-full p-0.5 hover:bg-white/20 focus-visible:outline-hidden"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        }
      />
      <PopoverContent
        align="start"
        className="w-auto p-0"
        sideOffset={4}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          locale={es}
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
