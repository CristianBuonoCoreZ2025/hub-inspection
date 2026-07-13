"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import {
  addMonths, subMonths,
  startOfMonth, endOfMonth,
  startOfWeek, endOfWeek,
  eachDayOfInterval,
  isSameDay, isSameMonth, isToday,
  format, getYear, setYear, setMonth, getMonth,
} from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

export type CalendarProps = {
  selected?: Date
  onSelect?: (date: Date | undefined) => void
  locale?: typeof es
  className?: string
  mode?: "single"
}

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"]
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

function Calendar({
  selected,
  onSelect,
  className,
}: CalendarProps) {
  const [viewDate, setViewDate] = React.useState(selected ?? new Date())
  const [view, setView] = React.useState<"days" | "months" | "years">("days")

  const monthStart = startOfMonth(viewDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const currentYear = getYear(viewDate)
  const yearStart = currentYear - (currentYear % 12) - 0
  const years = Array.from({ length: 12 }, (_, i) => yearStart + i)

  const handleSelectDay = (day: Date) => {
    onSelect?.(day)
  }

  const handleSelectMonth = (monthIdx: number) => {
    setViewDate(setMonth(viewDate, monthIdx))
    setView("days")
  }

  const handleSelectYear = (year: number) => {
    setViewDate(setYear(viewDate, year))
    setView("months")
  }

  const title = view === "days"
    ? format(viewDate, "MMMM yyyy", { locale: es })
    : view === "months"
      ? String(currentYear)
      : `${yearStart} – ${yearStart + 11}`

  const handleTitleClick = () => {
    if (view === "days") setView("months")
    else if (view === "months") setView("years")
  }

  const handlePrev = () => {
    if (view === "days") setViewDate(subMonths(viewDate, 1))
    else if (view === "months") setViewDate(setYear(viewDate, currentYear - 1))
    else setViewDate(setYear(viewDate, getYear(viewDate) - 12))
  }

  const handleNext = () => {
    if (view === "days") setViewDate(addMonths(viewDate, 1))
    else if (view === "months") setViewDate(setYear(viewDate, currentYear + 1))
    else setViewDate(setYear(viewDate, getYear(viewDate) + 12))
  }

  return (
    <div
      className={cn(
        "rdp-calendar-glass flex w-[280px] flex-col rounded-2xl border border-border/40 p-4",
        "bg-card/95 backdrop-blur-xl saturate-150",
        "shadow-[0_8px_32px_rgba(0,0,0,0.10)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.35)]",
        "select-none",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1 pb-3">
        <button
          type="button"
          onClick={handlePrev}
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-foreground/8 hover:text-foreground active:scale-90"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleTitleClick}
          className="rounded-lg px-3 py-1 text-[13px] font-semibold tracking-tight text-foreground transition-all hover:bg-foreground/8 active:scale-95"
        >
          {title}
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-foreground/8 hover:text-foreground active:scale-90"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Days view */}
      {view === "days" && (
        <>
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map((d, i) => (
              <div
                key={i}
                className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const isOutside = !isSameMonth(day, viewDate)
              const isSelected = selected && isSameDay(day, selected)
              const isTodayDay = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={cn(
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-medium transition-all duration-150",
                    "hover:bg-primary/12 hover:scale-105 active:scale-95",
                    isOutside && "text-muted-foreground/30",
                    !isOutside && !isSelected && "text-foreground/80",
                    isTodayDay && !isSelected && "text-primary font-semibold",
                    isSelected && [
                      "bg-primary text-primary-foreground font-semibold",
                      "shadow-[0_2px_12px_color-mix(in_srgb,var(--primary)_45%,transparent)]",
                      "hover:bg-primary hover:text-primary-foreground hover:scale-105",
                    ],
                  )}
                >
                  {format(day, "d")}
                </button>
              )
            })}
          </div>
        </>
      )}

      {/* Months view */}
      {view === "months" && (
        <div className="grid grid-cols-3 gap-1 py-1">
          {MONTHS.map((m, idx) => {
            const isActive = getMonth(viewDate) === idx
            return (
              <button
                key={m}
                type="button"
                onClick={() => handleSelectMonth(idx)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl text-[12px] font-medium transition-all duration-150",
                  "hover:bg-primary/12 hover:scale-105 active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-[0_2px_12px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                    : "text-foreground/80",
                )}
              >
                {m.slice(0, 3)}
              </button>
            )
          })}
        </div>
      )}

      {/* Years view */}
      {view === "years" && (
        <div className="grid grid-cols-3 gap-1 py-1">
          {years.map((y) => {
            const isActive = currentYear === y
            return (
              <button
                key={y}
                type="button"
                onClick={() => handleSelectYear(y)}
                className={cn(
                  "flex h-12 items-center justify-center rounded-xl text-[12px] font-medium transition-all duration-150",
                  "hover:bg-primary/12 hover:scale-105 active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-[0_2px_12px_color-mix(in_srgb,var(--primary)_45%,transparent)]"
                    : "text-foreground/80",
                )}
              >
                {y}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

Calendar.displayName = "Calendar"

export { Calendar }
