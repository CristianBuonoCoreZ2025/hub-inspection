"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bot, Loader2, CheckCircle2, XCircle, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * AiAnalysisButton
 *
 * Botón con icono Brain que dispara el análisis IA de un archivo y muestra
 * un modal con progreso interactivo etapa por etapa, para que el usuario
 * sepa qué está pasando (no se quede "pegado" mirando un spinner).
 *
 * Etapas:
 *  1. Descargando archivo
 *  2. Detectando tipo
 *  3. Extrayendo contenido (texto / imagen / PDF escaneado)
 *  4. Analizando con IA
 *  5. Guardando resultado
 *
 * Props:
 *  - table: "policy_documents" | "claim_documents" | "inspection_evidences"
 *  - id:    UUID del registro
 *  - fileName: nombre para mostrar en el modal
 *  - hasSummary: si ya tiene análisis (cambia tooltip a "Re-analizar")
 *  - queryKey: clave para invalidar tras éxito
 *  - size: tamaño del icono ("sm" | "md")
 *  - variant: "row" (botón en grilla, fondo transparente) | "overlay" (sobre imagen)
 */

type Stage =
  | "idle"
  | "downloading"
  | "detecting"
  | "extracting"
  | "analyzing"
  | "saving"
  | "done"
  | "error";

const STAGE_ORDER: Stage[] = [
  "downloading",
  "detecting",
  "extracting",
  "analyzing",
  "saving",
];

const STAGE_LABELS: Record<Stage, string> = {
  idle: "",
  downloading: "Descargando archivo",
  detecting: "Detectando tipo de documento",
  extracting: "Extrayendo contenido",
  analyzing: "Analizando con IA",
  saving: "Guardando resultado",
  done: "Análisis completado",
  error: "Error",
};

const STAGE_ICONS: Record<Stage, typeof FileText> = {
  idle: FileText,
  downloading: FileText,
  detecting: FileText,
  extracting: FileText,
  analyzing: Bot,
  saving: CheckCircle2,
  done: CheckCircle2,
  error: XCircle,
};

interface AiAnalysisButtonProps {
  table: "policy_documents" | "claim_documents" | "inspection_evidences" | "claim_images";
  id: string;
  fileName?: string;
  hasSummary?: boolean;
  queryKey: unknown[];
  disabled?: boolean;
}

export function AiAnalysisButton({
  table,
  id,
  fileName,
  hasSummary,
  queryKey,
  disabled,
}: AiAnalysisButtonProps) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const queryClient = useQueryClient();
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Cronómetro para mostrar cuánto tiempo lleva el análisis
  useEffect(() => {
    if (open && stage !== "idle" && stage !== "done" && stage !== "error") {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 100) / 10);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open, stage]);

  const runAnalysis = useCallback(async () => {
    setOpen(true);
    setStage("downloading");
    setErrorMsg(null);
    setSummary(null);
    setModel(null);
    setElapsed(0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Pequeña pausa para que el usuario vea la primera etapa
      await sleep(250);
      if (controller.signal.aborted) return;

      setStage("detecting");
      await sleep(200);
      if (controller.signal.aborted) return;

      setStage("extracting");
      await sleep(300);
      if (controller.signal.aborted) return;

      setStage("analyzing");

      const res = await fetch("/api/ai/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id, force: true }),
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setStage("error");
        setErrorMsg(data.error || `Error ${res.status}`);
        toast.error(data.error || "No se pudo analizar el documento");
        return;
      }

      setStage("saving");
      await sleep(300);
      if (controller.signal.aborted) return;

      setSummary(data.ai_summary || null);
      setModel(data.ai_model || null);
      setStage("done");
      queryClient.invalidateQueries({ queryKey });
      toast.success("Análisis IA generado");
    } catch (err) {
      if (controller.signal.aborted) return;
      setStage("error");
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      toast.error(msg);
    }
  }, [table, id, queryKey, queryClient]);

  const handleClose = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setOpen(false);
    setStage("idle");
  }, []);

  const isBusy = stage !== "idle" && stage !== "done" && stage !== "error";

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="btn-icon-sm btn-danger-hover"
        title={hasSummary ? "Re-analizar con IA" : "Analizar con IA"}
        disabled={isBusy || disabled}
        onClick={runAnalysis}
      >
        {isBusy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              <DialogTitle className="modal-title">
                {hasSummary ? "Re-análisis con IA" : "Análisis con IA"}
              </DialogTitle>
            </div>
            {fileName && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[300px]">
                {fileName}
              </span>
            )}
          </div>

          <div className="modal-body space-y-3">
            {/* Estado: en progreso o done/error */}
            {stage === "done" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-[11px] font-medium">Análisis completado</span>
                  <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                    {elapsed.toFixed(1)}s
                  </span>
                </div>
                {summary && (
                  <div className="rounded-md border border-violet-200 dark:border-violet-900/50 bg-violet-50/50 dark:bg-violet-950/20 p-3">
                    <div className="flex items-start gap-2">
                      <Bot className="h-3 w-3 shrink-0 mt-0.5 text-violet-600 dark:text-violet-400" />
                      <div className="space-y-1">
                        <p className="text-[11px] leading-relaxed text-foreground">
                          {summary}
                        </p>
                        {model && model !== "none" && (
                          <p className="text-[9px] text-muted-foreground">
                            Modelo: <span className="font-mono">{model}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : stage === "error" ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" />
                  <span className="text-[11px] font-medium">No se pudo analizar</span>
                  <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                    {elapsed.toFixed(1)}s
                  </span>
                </div>
                <div className="rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-3">
                  <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                    {errorMsg || "Error desconocido"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Header con tiempo */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-violet-600 dark:text-violet-400" />
                    <span className="text-[11px] font-medium">Procesando...</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {elapsed.toFixed(1)}s
                  </span>
                </div>

                {/* Lista de etapas */}
                <div className="space-y-1.5">
                  {STAGE_ORDER.map((s) => {
                    const Icon = STAGE_ICONS[s];
                    const currentIdx = STAGE_ORDER.indexOf(stage as Stage);
                    const thisIdx = STAGE_ORDER.indexOf(s);
                    const isCurrent = stage === s;
                    const isDone = currentIdx > thisIdx;
                    const isPending = currentIdx < thisIdx;

                    return (
                      <div
                        key={s}
                        className={`flex items-center gap-2 py-1 px-2 rounded transition-colors ${
                          isCurrent
                            ? "bg-violet-50 dark:bg-violet-950/30"
                            : ""
                        }`}
                      >
                        <span className="flex h-4 w-4 items-center justify-center shrink-0">
                          {isCurrent ? (
                            <Loader2 className="h-3 w-3 animate-spin text-violet-600 dark:text-violet-400" />
                          ) : isDone ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                          ) : isPending ? (
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                          ) : (
                            <Icon className="h-3 w-3 text-muted-foreground" />
                          )}
                        </span>
                        <span
                          className={`text-[11px] ${
                            isCurrent
                              ? "text-violet-700 dark:text-violet-300 font-medium"
                              : isDone
                              ? "text-muted-foreground line-through decoration-muted-foreground/30"
                              : "text-muted-foreground/60"
                          }`}
                        >
                          {STAGE_LABELS[s]}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Pista contextual según etapa */}
                <div className="text-[10px] text-muted-foreground/70 italic pl-2">
                  {stage === "downloading" && "Obteniendo el archivo desde el almacenamiento..."}
                  {stage === "detecting" && "Identificando si es PDF, imagen, Word u otro formato..."}
                  {stage === "extracting" && "Si es PDF escaneado, se renderiza a imagen para visión..."}
                  {stage === "analyzing" && "Enviando a OpenRouter (modelos free → paid). Esto puede tardar varios segundos..."}
                  {stage === "saving" && "Guardando el resumen en la base de datos..."}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            {stage === "done" || stage === "error" ? (
              <button
                type="button"
                className="pg-btn-platinum"
                onClick={handleClose}
              >
                Cerrar
              </button>
            ) : (
              <button
                type="button"
                className="pg-btn-platinum"
                onClick={handleClose}
              >
                <X className="h-3 w-3" /> Cancelar
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
