"use client";

import { Controller, type Control, type FieldValues, type FieldPath } from "react-hook-form";
import { Select, SelectContent, SelectTrigger, SelectValue, SelectItem } from "@/components/ui/select";

interface FormSelectProps<TFieldValues extends FieldValues = any> {
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

export function FormSelect<TFieldValues extends FieldValues = any>({ control, name, placeholder, disabled, className, children, onValueChange, items, clearable, clearLabel = "Sin selección" }: FormSelectProps<TFieldValues>) {
  return (
    <Controller
      control={control}
      name={name as FieldPath<TFieldValues>}
      render={({ field }) => (
        <Select
          value={field.value || ""}
          onValueChange={(v: any) => {
            const value = v || "";
            field.onChange(value);
            onValueChange?.(value);
          }}
          disabled={disabled}
          items={items}
        >
          <SelectTrigger className={className}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {clearable && (
              <SelectItem value="">{clearLabel}</SelectItem>
            )}
            {children}
          </SelectContent>
        </Select>
      )}
    />
  );
}
