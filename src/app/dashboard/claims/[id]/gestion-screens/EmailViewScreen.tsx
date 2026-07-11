"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GestionScreenProps } from "./types";

export default function EmailViewScreen({ action }: GestionScreenProps) {
  const data = (action.action_data || {}) as Record<string, string>;

  return (
    <div className="space-y-3">
      <div>
        <Label className="app-field-label text-[11px]">Creado</Label>
        <Input
          className="app-input h-8 text-[12px] bg-sky-50 dark:bg-sky-950"
          value={data.creado || action.issued_on ? new Date(action.issued_on || data.creado || Date.now()).toLocaleString("es-CL") : "—"}
          readOnly
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">De</Label>
        <Input
          className="app-input h-8 text-[12px] bg-sky-50 dark:bg-sky-950"
          value={data.de || "Paula.Torres@mclarens.com"}
          readOnly
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Para</Label>
        <Input
          className="app-input h-8 text-[12px] bg-sky-50 dark:bg-sky-950"
          value={data.para || "paula.torres@mclarens.com"}
          readOnly
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Asunto</Label>
        <Input
          className="app-input h-8 text-[12px] bg-sky-50 dark:bg-sky-950"
          value={data.asunto || "McLarens es liquidador de su siniestro"}
          readOnly
        />
      </div>
      <div>
        <Label className="app-field-label text-[11px]">Mensaje</Label>
        <div className="rounded-md border border-border bg-white dark:bg-zinc-900 p-4 min-h-[180px] text-[13px] leading-relaxed whitespace-pre-wrap text-black dark:text-zinc-100">
          {data.cuerpo || data.preview || "Sin contenido"}
        </div>
      </div>
      <div>
        <p className="text-[12px] font-semibold mt-2">No hay Archivos Adjuntos</p>
      </div>
    </div>
  );
}
