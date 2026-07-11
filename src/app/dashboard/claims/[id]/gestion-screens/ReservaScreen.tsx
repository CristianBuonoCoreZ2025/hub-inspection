"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GestionScreenProps } from "./types";

export default function ReservaScreen({ action, onChange, readOnly }: GestionScreenProps) {
  const data = (action.action_data || {}) as Record<string, string>;
  const [form, setForm] = useState({
    monto: data.monto || "",
    moneda: data.moneda || "CLP",
    cuentaBancaria: data.cuentaBancaria || "",
    instruccionPago: data.instruccionPago || "",
    fechaPago: data.fechaPago || "",
  });

  useEffect(() => {
    onChange?.(form);
  }, [form]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="app-field-label text-[11px]">Monto Reservado</Label>
        <Input
          type="number"
          className="app-input h-8 text-[12px]"
          value={form.monto}
          onChange={(e) => setForm({ ...form, monto: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Moneda</Label>
        <select
          className="app-input h-8 text-[12px] w-full"
          value={form.moneda}
          onChange={(e) => setForm({ ...form, moneda: e.target.value })}
          disabled={readOnly}
        >
          <option value="CLP">CLP</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="UF">UF</option>
        </select>
      </div>
      <div className="col-span-2">
        <Label className="app-field-label text-[11px]">Cuenta Bancaria</Label>
        <Input
          className="app-input h-8 text-[12px]"
          value={form.cuentaBancaria}
          onChange={(e) => setForm({ ...form, cuentaBancaria: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Fecha Pago</Label>
        <Input
          type="date"
          className="app-input h-8 text-[12px]"
          value={form.fechaPago}
          onChange={(e) => setForm({ ...form, fechaPago: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div className="col-span-2">
        <Label className="app-field-label text-[11px]">Instrucción de Pago</Label>
        <Textarea
          className="app-input text-[12px] min-h-[80px]"
          value={form.instruccionPago}
          onChange={(e) => setForm({ ...form, instruccionPago: e.target.value })}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
