"use client";

import { Controller, type Control, type FieldValues, type FieldPath } from "react-hook-form";
import { DatePicker } from "@/components/ui/date-picker";

interface FormDatePickerProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  name: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  minDate?: string;
  maxDate?: string;
  /** Se ejecuta tras el cambio, con el nuevo valor. Útil para validación cruzada de rangos. */
  onDateChange?: (value: string) => void;
}

export function FormDatePicker<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  placeholder,
  disabled,
  className,
  clearable,
  minDate,
  maxDate,
  onDateChange,
}: FormDatePickerProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name as FieldPath<TFieldValues>}
      render={({ field }) => (
        <DatePicker
          value={field.value || ""}
          onChange={(value) => {
            field.onChange(value || "");
            onDateChange?.(value || "");
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          clearable={clearable}
          minDate={minDate}
          maxDate={maxDate}
        />
      )}
    />
  );
}
