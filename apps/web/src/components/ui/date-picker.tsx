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
  maxDate?: string // ISO yyyy-MM-dd
  minDate?: string // ISO yyyy-MM-dd
}

function DatePicker({
  value,
  onChange,
  placeholder = "dd-mm-aaaa",
  className,
  disabled,
  clearable = true,
  maxDate,
  minDate,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const date = value ? parseISO(value) : undefined
  const maxDateObj = maxDate ? parseISO(maxDate) : undefined
  const minDateObj = minDate ? parseISO(minDate) : undefined

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
  const showClear = clearable && date

  return (
    <div className={cn("relative flex w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              disabled={disabled}
              className={cn(
                "liquid-date-picker group/date-picker flex w-full items-center gap-1.5",
                !date && "text-muted-foreground",
                showClear && "has-clear"
              )}
            >
              <CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="truncate tabular-nums min-w-0 flex-1">{displayValue}</span>
            </button>
          }
        />
        <PopoverContent
          align="start"
          className="!border-none !bg-transparent !backdrop-blur-none !shadow-none p-0"
          sideOffset={6}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            locale={es}
            maxDate={maxDateObj}
            minDate={minDateObj}
          />
        </PopoverContent>
      </Popover>
      {showClear && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange("")}
          className="absolute right-1.5 top-0.75 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:pointer-events-none"
          aria-label="Limpiar fecha"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

export { DatePicker }
