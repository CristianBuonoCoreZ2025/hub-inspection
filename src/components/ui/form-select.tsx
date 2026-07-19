"use client";

import { Controller, type Control, type FieldValues, type FieldPath } from "react-hook-form";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";

const CLEAR_VALUE = "__none";

interface FormSelectProps<TFieldValues extends FieldValues = FieldValues> {
  control: Control<TFieldValues>;
  name: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
  onValueChange?: (value: string) => void;
  items?: { value: string; label: string }[];
  /** Si true, agrega una opción "Sin selección" con valor vacío al inicio (para campos no obligatorios) */
  clearable?: boolean;
  /** Texto de la opción de limpiar (default: "Sin selección") */
  clearLabel?: string;
}

export function FormSelect<TFieldValues extends FieldValues = FieldValues>({ control, name, placeholder, disabled, className, children, onValueChange, items, clearable, clearLabel = "Sin selección" }: FormSelectProps<TFieldValues>) {
  const allItems = [
    ...(clearable ? [{ value: CLEAR_VALUE, label: clearLabel }] : []),
    ...(items || []),
  ];
  return (
    <Controller
      control={control}
      name={name as FieldPath<TFieldValues>}
      render={({ field }) => (
        <Select
          value={field.value || CLEAR_VALUE}
          onValueChange={(v: string | null) => {
            const value = !v || v === CLEAR_VALUE ? "" : v;
            field.onChange(value);
            onValueChange?.(value);
          }}
          disabled={disabled}
          items={allItems}
        >
          <SelectTrigger className={className}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {clearable && (
              <SelectItem value={CLEAR_VALUE}>{clearLabel}</SelectItem>
            )}
            {children}
          </SelectContent>
        </Select>
      )}
    />
  );
}
