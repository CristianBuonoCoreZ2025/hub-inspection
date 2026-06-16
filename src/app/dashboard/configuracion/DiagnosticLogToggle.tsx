"use client";

import { useEffect, useState } from "react";
import { requestLogger } from "@/lib/request-logger";

export default function DiagnosticLogToggle() {
  const [enabled, setEnabled] = useState(() => requestLogger.getEnabled());

  useEffect(() => {
    return requestLogger.subscribeEnabled((v) => setEnabled(v));
  }, []);

  return (
    <section className="app-panel">
      <h2 className="text-sm font-semibold">Log de diagnóstico</h2>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Muestra un panel de diagnóstico con llamados, tiempos, errores y eventos de la aplicación.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300"
            checked={enabled}
            onChange={(e) => requestLogger.setEnabled(e.target.checked)}
          />
          <span className="text-sm">{enabled ? "Activo" : "Apagado"}</span>
        </label>
      </div>
    </section>
  );
}
