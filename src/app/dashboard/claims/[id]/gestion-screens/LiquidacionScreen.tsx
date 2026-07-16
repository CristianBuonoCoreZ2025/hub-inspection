"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GestionScreenProps } from "./types";

export default function LiquidacionScreen({ action, onChange, readOnly }: GestionScreenProps) {
  const data = (action.action_data || {}) as Record<string, string>;
  const [form, setForm] = useState({
    montoIndemnizacion: data.montoIndemnizacion || "",
    deducible: data.deducible || "",
    coaseguro: data.coaseguro || "",
    montoFinal: data.montoFinal || "",
    resumen: data.resumen || "",
    numeroInforme: data.numeroInforme || "",
  });

  useEffect(() => {
    onChange?.(form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Label className="app-field-label text-[11px]">N° Informe</Label>
        <Input
          className="app-input h-8 text-[12px]"
          value={form.numeroInforme}
          onChange={(e) => setForm({ ...form, numeroInforme: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Monto Indemnización</Label>
        <Input
          type="number"
          className="app-input h-8 text-[12px]"
          value={form.montoIndemnizacion}
          onChange={(e) => setForm({ ...form, montoIndemnizacion: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Deducible</Label>
        <Input
          type="number"
          className="app-input h-8 text-[12px]"
          value={form.deducible}
          onChange={(e) => setForm({ ...form, deducible: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Coaseguro</Label>
        <Input
          type="number"
          className="app-input h-8 text-[12px]"
          value={form.coaseguro}
          onChange={(e) => setForm({ ...form, coaseguro: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Monto Final</Label>
        <Input
          type="number"
          className="app-input h-8 text-[12px]"
          value={form.montoFinal}
          onChange={(e) => setForm({ ...form, montoFinal: e.target.value })}
          disabled={readOnly}
        />
      </div>
      <div className="col-span-2">
        <Label className="app-field-label text-[11px]">Resumen del Informe</Label>
        <Textarea
          className="app-input text-[12px] min-h-[100px]"
          value={form.resumen}
          onChange={(e) => setForm({ ...form, resumen: e.target.value })}
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
