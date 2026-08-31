"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Switch/Toggle visual con la misma API que un checkbox nativo
 * (checked / onChange / defaultChecked / disabled) para reemplazar
 * todos los checkboxes de la app sin cambiar los call sites.
 *
 * Usa un <label> que envuelve un <input type="checkbox"> oculto,
 * así el comportamiento nativo (controlado y no controlado) se preserva.
 */
const Checkbox = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, checked, defaultChecked, onChange, disabled, ...props }, ref) => {
    const isControlled = checked !== undefined;
    const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
    const isChecked = isControlled ? (checked as boolean) : internalChecked;

    return (
      <label
        className={cn(
          "inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          disabled && "cursor-not-allowed opacity-50",
          isChecked ? "bg-primary" : "bg-input",
          className
        )}
        aria-disabled={disabled}
      >
        <input
          type="checkbox"
          ref={ref}
          {...(isControlled ? { checked: checked as boolean } : { defaultChecked: defaultChecked ?? false })}
          disabled={disabled}
          onChange={(e) => {
            if (!isControlled) setInternalChecked(e.target.checked);
            onChange?.(e);
          }}
          className="sr-only"
          {...props}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none block h-[14px] w-[14px] rounded-full bg-white shadow-sm transition-transform",
            isChecked ? "translate-x-[15px]" : "translate-x-[2px]"
          )}
        />
      </label>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
