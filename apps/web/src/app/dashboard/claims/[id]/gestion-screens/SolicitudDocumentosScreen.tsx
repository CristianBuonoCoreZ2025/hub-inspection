"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { DatePicker } from "@/components/ui/date-picker";
import type { GestionScreenProps } from "./types";

export default function SolicitudDocumentosScreen({ action, onChange, readOnly }: GestionScreenProps) {
 const data = (action.action_data || {}) as Record<string, unknown>;
 const initialDocs = Array.isArray(data.documentos)
 ? (data.documentos as Array<{ nombre: string; solicitado: boolean; recibido: boolean; fechaSolicitado: string; fechaRecibido: string }>)
 : [
 { nombre: "Identificación", solicitado: false, recibido: false, fechaSolicitado: "", fechaRecibido: "" },
 { nombre: "Póliza", solicitado: false, recibido: false, fechaSolicitado: "", fechaRecibido: "" },
 ];

 const [docs, setDocs] = useState(initialDocs);

 useEffect(() => {
 onChange?.({ documentos: docs });
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [docs]);

 return (
 <div className="space-y-2">
 <p className="app-title">Documentos Requeridos</p>
 {docs.map((doc, idx) => (
 <div key={idx} className="grid grid-cols-5 gap-2 items-end rounded-md border border-border p-2">
 <div className="col-span-2">
 <Label className="app-field-label">Documento</Label>
 <Input
 className="app-input h-7"
 value={doc.nombre}
 onChange={(e) => {
 const next = [...docs];
 next[idx].nombre = e.target.value;
 setDocs(next);
 }}
 disabled={readOnly}
 />
 </div>
 <div className="flex items-center gap-1 pb-1.5">
 <ToggleChip
 active={doc.solicitado}
 onClick={(v) => {
 const next = [...docs];
 next[idx].solicitado = v;
 setDocs(next);
 }}
 disabled={readOnly}
 >
 Solicitado
 </ToggleChip>
 </div>
 <div className="flex items-center gap-1 pb-1.5">
 <ToggleChip
 active={doc.recibido}
 onClick={(v) => {
 const next = [...docs];
 next[idx].recibido = v;
 setDocs(next);
 }}
 disabled={readOnly}
 >
 Recibido
 </ToggleChip>
 </div>
 <div>
 <Label className="app-field-label">Fecha Recibido</Label>
 <DatePicker
 value={doc.fechaRecibido}
 onChange={(value) => {
 const next = [...docs];
 next[idx].fechaRecibido = value;
 setDocs(next);
 }}
 disabled={readOnly}
 className="w-[130px]"
 />
 </div>
 </div>
 ))}
 {!readOnly && (
 <button
 className="app-body text-primary hover:underline"
 onClick={() => setDocs([...docs, { nombre: "", solicitado: false, recibido: false, fechaSolicitado: "", fechaRecibido: "" }])}
 >
 + Agregar documento
 </button>
 )}
 </div>
 );
}
