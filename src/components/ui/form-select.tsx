"use client";

import { Controller, type Control, type FieldValues, type FieldPath } from "react-hook-form";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FormSelectProps<TFieldValues extends FieldValues = any> {
  control: Control<TFieldValues>;
  name: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
  items?: { value: string; label: string }[];
}

export function FormSelect<TFieldValues extends FieldValues = any>({ control, name, placeholder, disabled, className, children, onValueChange, items }: FormSelectProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name as FieldPath<TFieldValues>}
      render={({ field }) => (
        <Select
          value={field.value || ""}
          onValueChange={(v) => {
            const value = v || "";
            field.onChange(value);
            onValueChange?.(value);
          }}
          disabled={disabled}
          items={items || []}
        >
          <SelectTrigger className={className}>
            <SelectValue placeholder={placeholder}>{placeholder}</SelectValue>
          </SelectTrigger>
          <SelectContent>{children}</SelectContent>
        </Select>
      )}
    />
  );
}
