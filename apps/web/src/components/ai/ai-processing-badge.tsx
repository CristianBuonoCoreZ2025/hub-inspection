"use client";

import { useEffect, useState } from "react";
import { Loader2, Clock } from "lucide-react";

/**
 * Badge que muestra el estado de procesamiento de IA.
 *
 * - "pending" → "En cola..." (esperando turno, sin timer)
 * - "processing" → "Analizando... Xs" (con timer en tiempo real)
 *
 * Solo UN registro a la vez debería estar en "processing".
 * El timer empieza desde que el componente se monta (cuando el estado
 * cambia a "processing") y se detiene al desmontarse.
 */
export function AiProcessingBadge({ status }: { status: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (status !== "processing") return;
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === "processing") {
    return (
      <div className="mt-0.5 flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
        <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />
        <span className="font-medium">
          Analizando... {elapsed}s
        </span>
      </div>
    );
  }

  // pending = en cola, esperando turno
  return (
    <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
      <Clock className="h-2.5 w-2.5 shrink-0" />
      <span className="font-medium">En cola...</span>
    </div>
  );
}
