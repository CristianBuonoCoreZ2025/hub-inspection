"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { Bot, Loader2, Upload, CheckCircle2, XCircle, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Página de diagnóstico de IA.
 *
 * Permite subir una imagen de prueba y ejecutar el flujo COMPLETO de visión
 * (describeImage) contra el entorno actual (UAT/producción/local) para
 * detectar por qué la IA no funciona en ese entorno.
 *
 * Usa el endpoint POST /api/ai/health que no toca BD ni R2 — es solo
 * diagnóstico. Reporta tiempo por etapa, modelo que respondió y descripción.
 */
export default function DiagnosticoIAPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onPick(f: File | null) {
    setFile(f);
    setResult(null);
    setError(null);
    if (f && f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function runTest() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ai/health", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Bot className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          Diagnóstico de IA
        </h1>
        <p className="text-sm text-muted-foreground">
          Sube una imagen de prueba para ejecutar el flujo completo de visión
          (describeImage) en este entorno y ver exactamente dónde falla.
          No toca la base de datos ni R2 — es solo diagnóstico.
        </p>
      </div>

      {/* Selector de archivo */}
      <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
        <label className="text-sm font-medium">Imagen de prueba</label>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-1" />
            Seleccionar imagen
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          {file && (
            <span className="text-xs text-muted-foreground truncate max-w-70">
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </span>
          )}
        </div>

        {preview && (
          <div className="mt-2 rounded-md border border-border overflow-hidden bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element -- preview local de diagnóstico */}
            <img src={preview} alt="preview" className="max-h-48 mx-auto" />
          </div>
        )}

        <Button
          type="button"
          onClick={runTest}
          disabled={!file || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Bot className="h-4 w-4 mr-1" />
              Ejecutar análisis de IA
            </>
          )}
        </Button>
      </div>

      {/* Error de red */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 shrink-0" />
            <span className="font-medium">Error de red</span>
          </div>
          <pre className="mt-2 text-xs whitespace-pre-wrap break-all">{error}</pre>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            {result.ok ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <span className="text-sm font-medium">
              {result.ok ? "Análisis exitoso" : "Análisis falló"}
            </span>
            {typeof result.totalMs === "number" && (
              <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                {result.totalMs} ms
              </span>
            )}
          </div>

          {/* Descripción generada */}
          {typeof result.description === "string" && (
            <div className="rounded-md border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900/50 dark:bg-violet-950/20">
              <div className="flex items-start gap-2">
                <ImageIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
                <p className="text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                  {result.description}
                </p>
              </div>
              {typeof result.model === "string" && result.model && (
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Modelo: <span className="font-mono">{result.model}</span>
                </p>
              )}
            </div>
          )}

          {/* Error reportado por el endpoint */}
          {typeof result.error === "string" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
              {result.error}
            </div>
          )}

          {/* Pasos (timeline de diagnóstico) */}
          {Array.isArray(result.steps) && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Pasos:</p>
              {result.steps.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  {s.ok ? (
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-600 dark:text-red-400 shrink-0" />
                  )}
                  <span className="font-mono">{s.step}</span>
                  <span className="text-muted-foreground tabular-nums">{s.ms}ms</span>
                  {typeof s.detail === "string" && (
                    <span className="text-muted-foreground truncate">— {s.detail}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* JSON crudo para debugging */}
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Ver JSON completo
            </summary>
            <pre className="mt-2 p-2 rounded bg-muted/50 text-[10px] overflow-auto max-h-60 whitespace-pre-wrap break-all">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
