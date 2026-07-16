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
}

export function FormDatePicker<TFieldValues extends FieldValues = FieldValues>({
  control,
  name,
  placeholder,
  disabled,
  className,
  clearable,
}: FormDatePickerProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name as FieldPath<TFieldValues>}
      render={({ field }) => (
        <DatePicker
          value={field.value || ""}
          onChange={(value) => field.onChange(value || "")}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
          clearable={clearable}
        />
      )}
    />
  );
}
