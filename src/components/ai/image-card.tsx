"use client";

import { ChevronDown, RefreshCw, FileText, AlertCircle } from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { AiProgressOverlay } from "@/components/ai/ai-progress-overlay";
import { AiCopyButton } from "@/components/ai/ai-copy-button";
import { cleanMarkdown } from "@/lib/utils";

/**
 * ImageCard
 *
 * Card reutilizable para grillas de imágenes/evidencias. Unifica:
 * - Thumbnail con aspect-[4/3]
 * - Badge opcional (esquina superior izquierda)
 * - Acciones hover (esquina superior derecha)
 * - Overlay de progreso IA (pending/processing)
 * - Sección de info: código al 100%, split 50/50 con metadata (ext, tipo, peso)
 *   a la izquierda y botones IA a la derecha
 * - Fila extra opcional (fecha, uploader, GPS, etc.)
 *
 * Props variables (slots):
 * - badge: ReactNode para el badge superior izquierdo
 * - hoverActions: ReactNode para acciones hover superior derecho
 * - extraInfo: ReactNode para fila extra abajo de la metadata
 *
 * Props de IA:
 * - aiStatus, aiProgress, aiSummary, aiModel, aiPromptSnapshot, aiAnalyzedAt
 * - onReanalyze: callback al clic en re-analizar
 * - onCancelAi: callback al cancelar análisis pending
 */

interface AiPromptSnapshot {
  system_prompt: string;
  user_prompt: string;
  refinement_prompt: string | null;
  source: string;
}

interface ImageCardProps {
  // Imagen
  imageUrl: string;
  imageAlt: string;
  onImageClick?: () => void;

  // Badge (esquina superior izquierda)
  badge?: React.ReactNode;

  // Acciones hover (esquina superior derecha)
  hoverActions?: React.ReactNode;

  // Overlay IA
  aiStatus?: string | null;
  aiProgress?: string | null;
  aiTable?: string;
  aiRecordId?: string;
  onCancelAi?: () => void;

  // Info
  code: string;
  fileSize: number | null;
  mimeType: string | null;
  fileName?: string;

  // IA
  aiSummary?: string | null;
  aiModel?: string | null;
  aiPromptSnapshot?: AiPromptSnapshot | null;
  aiAnalyzedAt?: string | null;
  onReanalyze: () => void;

  // Fila extra (fecha, uploader, GPS, etc.)
  extraInfo?: React.ReactNode;

  // Niños dentro del thumbnail (video, doc thumbnail, etc.)
  thumbnailContent?: React.ReactNode;
}

function fileExtension(url: string, fileName?: string): string {
  const source = fileName || url || "";
  const match = source.match(/\.([a-zA-Z0-9]+)(?:\?|$|#)/);
  return match ? match[1].toUpperCase() : "—";
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImageCard({
  imageUrl,
  imageAlt,
  onImageClick,
  badge,
  hoverActions,
  aiStatus,
  aiProgress,
  aiTable,
  aiRecordId,
  onCancelAi,
  code,
  fileSize,
  mimeType,
  fileName,
  aiSummary,
  aiModel,
  aiPromptSnapshot,
  aiAnalyzedAt,
  onReanalyze,
  extraInfo,
  thumbnailContent,
}: ImageCardProps) {
  const isPending = aiStatus === "pending" || aiStatus === "processing";

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {/* Thumbnail */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted/30">
        {thumbnailContent ?? (
          <button
            type="button"
            onClick={onImageClick}
            className="block h-full w-full cursor-zoom-in"
            title="Click para ampliar"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded image from R2 */}
            <img
              src={imageUrl}
              alt={imageAlt}
              className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
              loading="lazy"
            />
          </button>
        )}

        {/* Badge (esquina superior izquierda) */}
        {badge && (
          <div className="absolute left-1.5 top-1.5">{badge}</div>
        )}

        {/* Acciones hover (esquina superior derecha) */}
        {hoverActions && (
          <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {hoverActions}
          </div>
        )}

        {/* Overlay termómetro de progreso IA */}
        {isPending && (
          <AiProgressOverlay
            aiStatus={aiStatus || null}
            aiProgress={aiProgress || null}
            table={aiTable || "claim_images"}
            recordId={aiRecordId || ""}
            onCancel={onCancelAi}
          />
        )}
      </div>

      {/* Info debajo de la imagen */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        {/* Row 1: Código al 100% */}
        <span className="font-mono text-[10px] font-medium text-foreground truncate">
          {code}
        </span>

        {/* Split 50/50: metadata izquierda, botones IA derecha */}
        <div className="grid grid-cols-2 gap-1">
          {/* Izquierda: metadata técnica */}
          <div className="space-y-0.5">
            <div className="text-[9px] text-muted-foreground truncate">
              <span className="text-muted-foreground/60">Ext:</span>{" "}
              {fileExtension(imageUrl, fileName)}
            </div>
            <div className="text-[9px] text-muted-foreground truncate">
              <span className="text-muted-foreground/60">Tipo:</span>{" "}
              {mimeType || "—"}
            </div>
            <div className="text-[9px] text-muted-foreground truncate">
              <span className="text-muted-foreground/60">Peso:</span>{" "}
              {formatFileSize(fileSize)}
            </div>
          </div>

          {/* Derecha: control segmentado de IA */}
          <div className="ai-card-controls">
            {/* done → re-analizar + ver resultado */}
            {aiSummary && aiStatus === "done" && (
              <div className="ai-card-controls-group">
                <button
                  onClick={onReanalyze}
                  className="ai-card-ctrl-btn ai-card-ctrl-reanalyze"
                  title="Re-analizar con IA"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Re-IA</span>
                </button>
                <Popover>
                  <PopoverTrigger
                    render={
                      <button className="ai-card-ctrl-btn ai-card-ctrl-log" title="Ver log del análisis">
                        <FileText className="h-3 w-3" />
                        <span>Ver</span>
                      </button>
                    }
                  />
                  <PopoverContent side="top" align="start" className="ai-log-popover">
                    {/* Header: código + fecha */}
                    <div className="ai-log-header">
                      <span className="ai-log-code">{code}</span>
                      {aiAnalyzedAt && (
                        <span className="ai-log-date">
                          {new Date(aiAnalyzedAt).toLocaleString("es-CL", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                      {aiSummary && <AiCopyButton text={cleanMarkdown(aiSummary)} />}
                    </div>
                    {aiModel && (
                      <div className="ai-log-models">
                        {aiModel.split("|").map((m, i) => {
                          const trimmed = m.trim();
                          const isVision = trimmed.startsWith("vision:");
                          const label = isVision ? "Visión" : "Razonamiento";
                          const modelName = trimmed.replace(/^(vision|razonamiento):/, "").trim();
                          return (
                            <div key={i} className="ai-log-model-row">
                              <span className="ai-log-model-tag">{label}</span>
                              <span className="ai-log-model-name">{modelName}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Resumen */}
                    <div className="ai-log-section ai-log-section-summary">
                      <div className="ai-log-summary">{cleanMarkdown(aiSummary)}</div>
                    </div>
                    {/* Prompt enviado */}
                    {aiPromptSnapshot && (
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button className="ai-log-prompt-trigger" title="Ver prompt enviado">
                              <ChevronDown className="h-2.5 w-2.5" />
                              <span>Prompt enviado</span>
                            </button>
                          }
                        />
                        <PopoverContent side="top" align="start" className="ai-prompt-tooltip">
                          <div className="ai-log-prompt">
                            {aiPromptSnapshot.system_prompt && (
                              <div className="ai-log-prompt-block">
                                <span className="ai-log-prompt-tag">system</span>
                                <pre className="ai-log-prompt-text">{aiPromptSnapshot.system_prompt}</pre>
                              </div>
                            )}
                            {aiPromptSnapshot.user_prompt && (
                              <div className="ai-log-prompt-block">
                                <span className="ai-log-prompt-tag">user</span>
                                <pre className="ai-log-prompt-text">{aiPromptSnapshot.user_prompt}</pre>
                              </div>
                            )}
                            {aiPromptSnapshot.refinement_prompt && (
                              <div className="ai-log-prompt-block">
                                <span className="ai-log-prompt-tag">refinement</span>
                                <pre className="ai-log-prompt-text">{aiPromptSnapshot.refinement_prompt}</pre>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* error → re-analizar */}
            {aiStatus === "error" && (
              <div className="ai-card-controls-group">
                <button
                  onClick={onReanalyze}
                  className="ai-card-ctrl-btn ai-card-ctrl-error"
                  title="Re-analizar con IA"
                >
                  <AlertCircle className="h-3 w-3" />
                  <span>Re-IA</span>
                </button>
              </div>
            )}

            {/* skipped → re-analizar (omitido temporalmente) */}
            {aiStatus === "skipped" && (
              <div className="ai-card-controls-group">
                <button
                  onClick={onReanalyze}
                  className="ai-card-ctrl-btn ai-card-ctrl-reanalyze"
                  title="El análisis fue omitido. Volver a analizar con IA."
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Re-IA</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fila extra (fecha, uploader, GPS, etc.) */}
        {extraInfo}
      </div>
    </div>
  );
}
