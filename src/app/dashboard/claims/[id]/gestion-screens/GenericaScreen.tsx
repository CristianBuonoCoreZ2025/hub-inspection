"use client";

import { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { GestionScreenProps } from "./types";

export default function GenericaScreen({ action, onChange, readOnly }: GestionScreenProps) {
  const [json, setJson] = useState(() => JSON.stringify(action.action_data || {}, null, 2));

  useEffect(() => {
    try {
      const parsed = JSON.parse(json);
      onChange?.(parsed);
    } catch {
      // JSON inválido - no propagar
    }
  }, [json]);

  return (
    <div className="space-y-2">
      <p className="text-[12px] text-muted-foreground">
        Pantalla genérica. Edita los datos específicos de la gestión en formato JSON.
      </p>
      <Textarea
        className="font-mono text-[11px] min-h-[200px]"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        disabled={readOnly}
      />
      <button
        className="text-[11px] text-primary hover:underline"
        onClick={() => {
          try {
            JSON.parse(json);
            toast.success("JSON válido");
          } catch {
            toast.error("JSON inválido");
          }
        }}
      >
        Validar JSON
      </button>
    </div>
  );
}
