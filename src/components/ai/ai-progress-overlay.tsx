"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, X, ImageIcon, FileText, Ban, Cpu } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

/**
 * Panel lateral ahumado tipo "widget de CPU" que se sobrepone al
 * costado derecho de la imagen mientras la IA procesa.
 *
 * Muestra un log en vivo de los modelos que se van probando:
 *
 *   VISION
 *     ✗ qwen-vl-max
 *     ✗ gemma-2-9b
 *     ✓ gpt-4o-mini
 *   REFINAMIENTO
 *     ⟳ deepseek-r1
 *
 * El log se acumula mientras se procesa. Cuando un modelo responde
 * OK, se corta esa fase y pasa a la siguiente (si hay refinamiento).
 *
 * Formato de ai_progress: "phase:model:status|phase:model:status|..."
 */
interface ProgressStep {
  phase: string;
  model: string;
  status: "trying" | "failed" | "ok";
}

function parseProgress(progress: string | null): ProgressStep[] {
  if (!progress) return [];
  return progress
    .split("|")
    .filter(Boolean)
    .map((step) => {
      // phase:model:status — pero el modelo puede tener ":"
      const lastColon = step.lastIndexOf(":");
      const status = step.slice(lastColon + 1) as "trying" | "failed" | "ok";
      const rest = step.slice(0, lastColon);
      const firstColon = rest.indexOf(":");
      const phase = rest.slice(0, firstColon);
      const model = rest.slice(firstColon + 1);
      return { phase, model, status };
    });
}

/** Acorta el nombre del modelo. */
function shortModelName(model: string): string {
  const withoutOrg = model.includes("/") ? model.split("/")[1] : model;
  return withoutOrg.length > 16 ? withoutOrg.slice(0, 16) + "…" : withoutOrg;
}

const PHASE_ICON = {
  vision: ImageIcon,
  document: FileText,
  refinement: Cpu,
};

const PHASE_LABEL = {
  vision: "Visión",
  document: "Documento",
  refinement: "Refinamiento",
};

export function AiProgressOverlay({
  aiStatus,
  aiProgress,
  table,
  recordId,
  onCancel,
}: {
  aiStatus: string | null;
  aiProgress: string | null;
  table: string;
  recordId: string;
  onCancel?: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (aiStatus !== "processing") return;
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [aiStatus]);

  if (aiStatus !== "pending" && aiStatus !== "processing") return null;

  const steps = parseProgress(aiProgress);

  // Agrupar pasos por fase, manteniendo el orden
  const phases: { name: string; steps: ProgressStep[] }[] = [];
  for (const step of steps) {
    let phase = phases.find((p) => p.name === step.phase);
    if (!phase) {
      phase = { name: step.phase, steps: [] };
      phases.push(phase);
    }
    phase.steps.push(step);
  }

  const handleCancel = async () => {
    if (!onCancel) return;
    setCanceling(true);
    try {
      await fetch("/api/ai/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, id: recordId }),
      });
      onCancel();
    } catch {
      setCanceling(false);
    }
  };

  // Estado: en cola
  if (aiStatus === "pending") {
    return (
      <div className="ai-progress-overlay">
        <div className="ai-progress-panel">
          <div className="ai-progress-panel-queued">
            <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
            <span>En cola</span>
            {onCancel && (
              <Tooltip>
                <TooltipTrigger render={
                  <button
                    onClick={handleCancel}
                    className="ai-progress-panel-cancel"
                    disabled={canceling}
                  />
                }>
                  <Ban className="h-3 w-3" />
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Omitir</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Estado: procesando — panel lateral con log en vivo
  const hasActiveStep = steps.some((s) => s.status === "trying");

  return (
    <div className="ai-progress-overlay">
      <div className="ai-progress-panel">
        {/* Header: timer + cancel */}
        <div className="ai-progress-panel-header">
          <div className="ai-progress-panel-timer-wrap">
            <Cpu className={`ai-progress-panel-cpu ${hasActiveStep ? "ai-progress-cpu-run" : "ai-progress-cpu-ok"}`} />
            <span className="ai-progress-panel-timer">{elapsed}s</span>
          </div>
          {onCancel && (
            <Tooltip>
              <TooltipTrigger render={
                <button
                  onClick={handleCancel}
                  className="ai-progress-panel-cancel"
                  disabled={canceling}
                />
              }>
                <Ban className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p>Detener</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Log de pasos acumulados */}
        <div className="ai-progress-panel-log">
          {phases.length === 0 ? (
            <div className="ai-progress-panel-log-init">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />
              <span>Iniciando...</span>
            </div>
          ) : (
            phases.map((phase, pi) => {
              const Icon = PHASE_ICON[phase.name as keyof typeof PHASE_ICON] || Cpu;
              const label = PHASE_LABEL[phase.name as keyof typeof PHASE_LABEL] || phase.name;
              return (
                <div key={pi} className="ai-progress-log-phase">
                  <div className="ai-progress-log-phase-header">
                    <Icon className="ai-progress-log-phase-icon" />
                    <span className="ai-progress-log-phase-label">{label}</span>
                  </div>
                  {phase.steps.map((step, si) => (
                    <div key={si} className={`ai-progress-log-step ai-progress-log-step-${step.status}`}>
                      {step.status === "ok" && <Check className="h-2.5 w-2.5 shrink-0" />}
                      {step.status === "failed" && <X className="h-2.5 w-2.5 shrink-0" />}
                      {step.status === "trying" && <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />}
                      <span className="ai-progress-log-step-model">{shortModelName(step.model)}</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        {/* Barra de actividad animada */}
        {hasActiveStep && (
          <div className="ai-progress-panel-bar">
            <div className="ai-progress-panel-bar-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}
