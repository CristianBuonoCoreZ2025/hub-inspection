"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import type { GestionScreenProps } from "./types";

export default function SolicitudDocumentosScreen({ action, onChange, readOnly }: GestionScreenProps) {
  const data = (action.action_data || {}) as Record<string, unknown>;
  const initialDocs = Array.isArray(data.documentos)
    ? (data.documentos as any[])
    : [
        { nombre: "Identificación", solicitado: false, recibido: false, fechaSolicitado: "", fechaRecibido: "" },
        { nombre: "Póliza", solicitado: false, recibido: false, fechaSolicitado: "", fechaRecibido: "" },
      ];

  const [docs, setDocs] = useState(initialDocs);

  useEffect(() => {
    onChange?.({ documentos: docs });
  }, [docs]);

  return (
    <div className="space-y-2">
      <p className="text-[12px] font-semibold">Documentos Requeridos</p>
      {docs.map((doc, idx) => (
        <div key={idx} className="grid grid-cols-5 gap-2 items-end rounded-md border border-border p-2">
          <div className="col-span-2">
            <Label className="app-field-label text-[10px]">Documento</Label>
            <Input
              className="app-input h-7 text-[11px]"
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
            <Checkbox
              checked={doc.solicitado}
              onChange={(e) => {
                const next = [...docs];
                next[idx].solicitado = (e.target as HTMLInputElement).checked;
                setDocs(next);
              }}
              disabled={readOnly}
            />
            <span className="text-[11px]">Solicitado</span>
          </div>
          <div className="flex items-center gap-1 pb-1.5">
            <Checkbox
              checked={doc.recibido}
              onChange={(e) => {
                const next = [...docs];
                next[idx].recibido = (e.target as HTMLInputElement).checked;
                setDocs(next);
              }}
              disabled={readOnly}
            />
            <span className="text-[11px]">Recibido</span>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Fecha Recibido</Label>
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
          className="text-[11px] text-primary hover:underline"
          onClick={() => setDocs([...docs, { nombre: "", solicitado: false, recibido: false, fechaSolicitado: "", fechaRecibido: "" }])}
        >
          + Agregar documento
        </button>
      )}
    </div>
  );
}
