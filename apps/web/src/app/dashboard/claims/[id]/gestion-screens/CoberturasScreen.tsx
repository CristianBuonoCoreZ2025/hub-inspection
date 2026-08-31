"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import type { GestionScreenProps } from "./types";

export default function CoberturasScreen({ action, onChange, readOnly }: GestionScreenProps) {
 const data = (action.action_data || {}) as Record<string, unknown>;
 const initialRows = Array.isArray(data.coberturas)
 ? (data.coberturas as Array<{ cobertura: string; subcobertura: string; montoAsegurado: string; montoAfectado: string; aplica: boolean }>)
 : [
 { cobertura: "", subcobertura: "", montoAsegurado: "", montoAfectado: "", aplica: false },
 ];

 const [rows, setRows] = useState(initialRows);

 useEffect(() => {
 onChange?.({ coberturas: rows });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [rows]);

 return (
 <div className="space-y-2">
 <p className="app-title">Coberturas Afectadas</p>
 {rows.map((row, idx) => (
 <div key={idx} className="grid grid-cols-5 gap-2 items-end rounded-md border border-border p-2">
 <div className="col-span-2">
 <Label className="app-field-label">Cobertura</Label>
 <Input
 className="app-input h-7"
 value={row.cobertura}
 onChange={(e) => {
 const next = [...rows];
 next[idx].cobertura = e.target.value;
 setRows(next);
 }}
 disabled={readOnly}
 />
 </div>
 <div>
 <Label className="app-field-label">Mto. Asegurado</Label>
 <Input
 className="app-input h-7"
 value={row.montoAsegurado}
 onChange={(e) => {
 const next = [...rows];
 next[idx].montoAsegurado = e.target.value;
 setRows(next);
 }}
 disabled={readOnly}
 />
 </div>
 <div>
 <Label className="app-field-label">Mto. Afectado</Label>
 <Input
 className="app-input h-7"
 value={row.montoAfectado}
 onChange={(e) => {
 const next = [...rows];
 next[idx].montoAfectado = e.target.value;
 setRows(next);
 }}
 disabled={readOnly}
 />
 </div>
 <div className="flex items-center gap-1 pb-1.5">
 <ToggleChip
 active={row.aplica}
 onClick={(v) => {
 const next = [...rows];
 next[idx].aplica = v;
 setRows(next);
 }}
 disabled={readOnly}
 >
 Aplica
 </ToggleChip>
 </div>
 </div>
 ))}
 {!readOnly && (
 <button
 className="app-body text-primary hover:underline"
 onClick={() => setRows([...rows, { cobertura: "", subcobertura: "", montoAsegurado: "", montoAfectado: "", aplica: false }])}
 >
 + Agregar cobertura
 </button>
 )}
 </div>
 );
}
