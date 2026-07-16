"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  Mail,
  CheckCircle,
  Send,
  Shield,
  Eye,
  Truck,
  Clock,
  AlertTriangle,
  Download,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getClaimActionById,
  issueClaimAction,
  reviewClaimAction,
  approveClaimAction,
  dispatchClaimAction,
  rejectClaimAction,
  updateClaimAction,
} from "@/services/claim-actions";
import { getDocumentTemplates, type DocumentTemplate } from "@/services/document-templates";
import { getClaimById } from "@/services/claims";

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  todo: "Pendiente",
  issued: "Emitida",
  reviewed: "Revisada",
  approved: "Aprobada",
  dispatched: "Despachada",
  rejected: "Rechazada",
  cancelled: "Cancelada",
};

const statusColors: Record<string, string> = {
  todo: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  issued: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  reviewed: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  dispatched: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  rejected: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  cancelled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

// ──────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────

export default function GestionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { canEdit } = usePermissions();
  const claimId = params.id as string;
  const actionId = params.actionId as string;

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectStage, setRejectStage] = useState<"review" | "approve" | "dispatch">("review");
  const [rejectComment, setRejectComment] = useState("");
  const [actionDataJson, setActionDataJson] = useState("");

  // Cargar la acción
  const { data: action, isLoading } = useQuery({
    queryKey: ["claim-action", actionId],
    queryFn: () => getClaimActionById(actionId),
    enabled: !!actionId,
  });

  // Cargar el siniestro
  const { data: claim } = useQuery({
    queryKey: ["claim", claimId],
    queryFn: () => getClaimById(claimId),
    enabled: !!claimId,
  });

  // Cargar plantillas de documento si la característica lo requiere
  const { data: docTemplates } = useQuery({
    queryKey: ["doc-templates-by-action", action?.action_template_id],
    queryFn: () => getDocumentTemplates({ actionTemplateId: action?.action_template_id || undefined }),
    enabled: !!action?.action_template_id,
  });

  // Mutations
  const issueMut = useMutation({
    mutationFn: () => issueClaimAction(actionId, profile?.id),
    onSuccess: () => {
      toast.success("Gestión emitida");
      queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMut = useMutation({
    mutationFn: () => reviewClaimAction(actionId, profile?.id),
    onSuccess: () => {
      toast.success("Gestión revisada");
      queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMut = useMutation({
    mutationFn: () => approveClaimAction(actionId, profile?.id),
    onSuccess: () => {
      toast.success("Gestión aprobada");
      queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dispatchMut = useMutation({
    mutationFn: () => dispatchClaimAction(actionId, profile?.id),
    onSuccess: () => {
      toast.success("Gestión despachada");
      queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectClaimAction(actionId, rejectStage, profile?.id, rejectComment || undefined),
    onSuccess: () => {
      toast.success("Gestión rechazada");
      queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", claimId] });
      setRejectModalOpen(false);
      setRejectComment("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDataMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => updateClaimAction(actionId, { action_data: data }, profile?.id),
    onSuccess: () => {
      toast.success("Datos guardados");
      queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Render ───

  if (isLoading) {
    return (
      <div className="app-page">
        <p className="text-muted-foreground py-20 text-center">Cargando gestión...</p>
      </div>
    );
  }

  if (!action) {
    return (
      <div className="app-page">
        <p className="text-muted-foreground py-20 text-center">Gestión no encontrada.</p>
      </div>
    );
  }

  const statusCode = action.action_status?.code || "todo";
  const shortCode = action.code ? action.code.split("-").slice(2).join("-") : null;
  const feature = action.action_feature;
  const template = action.action_template;

  // Determinar qué acciones están disponibles según el estado actual
  const canIssue = feature?.has_issue && statusCode === "todo";
  const canReview = feature?.has_review && statusCode === "issued";
  const canApprove = feature?.has_approve && statusCode === "reviewed";
  const canDispatch = action.is_blocker && statusCode === "approved";
  const canReject = canReview || canApprove || canDispatch;

  // Calcular días transcurridos y alertas
  const daysSinceCreated = daysBetween(action.created_on, new Date().toISOString());
  const daysToIssue = template?.days_to_issue ?? 0;
  const issueOverdue = canIssue && daysSinceCreated !== null && daysToIssue > 0 && daysSinceCreated > daysToIssue;

  // Inicializar actionDataJson cuando carga la acción
  const currentDataJson = action.action_data ? JSON.stringify(action.action_data, null, 2) : "{}";

  return (
    <div className="app-page">
      {/* Header */}
      <div className="app-page-header">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            className="btn-cancel btn-icon"
            onClick={() => router.push(`/dashboard/claims/${claimId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="app-page-title truncate">{action.name}</h1>
              <Badge className={statusColors[statusCode] || ""}>
                {statusLabels[statusCode] || statusCode}
              </Badge>
              {action.is_blocker && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                  Bloqueante
                </Badge>
              )}
            </div>
            <p className="app-page-lead">
              {claim?.claim_number && `Siniestro #${claim.claim_number}`}
              {shortCode && ` · Código ${shortCode}`}
              {feature?.name && ` · ${feature.name}`}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 app-stack">
          {/* Descripción */}
          {action.description && (
            <div className="app-panel">
              <h3 className="app-section-title">Descripción</h3>
              <p className="text-[13px] text-muted-foreground">{action.description}</p>
            </div>
          )}

          {/* Alerta de plazo vencido */}
          {issueOverdue && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-[12px] text-amber-700 dark:text-amber-300">
                Plazo de emisión vencido: {daysSinceCreated} días transcurridos de {daysToIssue} permitidos.
              </p>
            </div>
          )}

          {/* Datos de la gestión (action_data) — editable si has_control */}
          {feature?.has_control && (
            <div className="app-panel">
              <h3 className="app-section-title">Datos de la Gestión</h3>
              <p className="text-[11px] text-muted-foreground mb-2">
                Datos específicos en formato JSON. Editable según permisos.
              </p>
              <Textarea
                className="font-mono text-[11px] min-h-[150px]"
                value={actionDataJson || currentDataJson}
                onChange={(e) => setActionDataJson(e.target.value)}
                disabled={statusCode !== "todo" && statusCode !== "issued"}
              />
              {(statusCode === "todo" || statusCode === "issued") && (
                <div className="mt-2 flex justify-end">
                  <Button
                    size="sm"
                    className="pg-btn-platinum"
                    disabled={saveDataMut.isPending}
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(actionDataJson || currentDataJson);
                        saveDataMut.mutate(parsed);
                      } catch {
                        toast.error("JSON inválido");
                      }
                    }}
                  >
                    Guardar
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Plantillas de documento */}
          {docTemplates && docTemplates.length > 0 && (
            <div className="app-panel">
              <h3 className="app-section-title flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Plantillas de Documento
              </h3>
              <div className="space-y-1.5">
                {docTemplates.map((tpl: DocumentTemplate) => (
                  <div
                    key={tpl.id}
                    className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{tpl.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {tpl.file_name} · {tpl.detected_placeholders?.length || 0} placeholders
                      </p>
                    </div>
                    <a
                      href={tpl.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sección de email si aplica */}
          {feature?.name?.toLowerCase().includes("email") && (
            <div className="app-panel">
              <h3 className="app-section-title flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Envío de Email
              </h3>
              <div className="space-y-2">
                <div>
                  <Label className="app-field-label">Para</Label>
                  <Input className="app-input" placeholder="email@asegurado.cl" />
                </div>
                <div>
                  <Label className="app-field-label">Asunto</Label>
                  <Input className="app-input" placeholder="Asunto del correo" />
                </div>
                <div>
                  <Label className="app-field-label">Mensaje</Label>
                  <Textarea className="app-input min-h-[100px]" placeholder="Cuerpo del mensaje..." />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Columna lateral: workflow */}
        <div className="app-stack">
          {/* Timeline de workflow */}
          <div className="app-panel">
            <h3 className="app-section-title">Workflow</h3>
            <div className="space-y-3">
              <WorkflowStep
                icon={ClipboardList}
                label="Creación"
                date={action.created_on}
                done
              />
              <WorkflowStep
                icon={Send}
                label="Emisión"
                date={action.issued_on}
                done={!!action.issued_on}
                active={canIssue}
                overdue={issueOverdue}
              />
              {feature?.has_review && (
                <WorkflowStep
                  icon={Eye}
                  label="Revisión"
                  date={action.reviewed_on}
                  done={!!action.reviewed_on}
                  active={canReview}
                />
              )}
              {feature?.has_approve && (
                <WorkflowStep
                  icon={Shield}
                  label="Aprobación"
                  date={action.approved_on}
                  done={!!action.approved_on}
                  active={canApprove}
                />
              )}
              {action.is_blocker && (
                <WorkflowStep
                  icon={Truck}
                  label="Despacho"
                  date={action.dispatched_on}
                  done={!!action.dispatched_on}
                  active={canDispatch}
                />
              )}
            </div>
          </div>

          {/* Plazos */}
          <div className="app-panel">
            <h3 className="app-section-title flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Plazos
            </h3>
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <span className="app-data-label">Emitir</span>
                <p className="font-medium">{template?.days_to_issue ?? "—"} días</p>
              </div>
              {feature?.has_review && (
                <div>
                  <span className="app-data-label">Revisar</span>
                  <p className="font-medium">{template?.days_to_review ?? "—"} días</p>
                </div>
              )}
              {feature?.has_approve && (
                <div>
                  <span className="app-data-label">Aprobar</span>
                  <p className="font-medium">{template?.days_to_approve ?? "—"} días</p>
                </div>
              )}
            </div>
          </div>

          {/* Acciones */}
          {canEdit("claims") && (
            <div className="app-panel">
              <h3 className="app-section-title">Acciones</h3>
              <div className="flex flex-col gap-2">
                {canIssue && (
                  <Button
                    size="sm"
                    className="pg-btn-platinum w-full"
                    disabled={issueMut.isPending}
                    onClick={() => issueMut.mutate()}
                  >
                    {issueMut.isPending ? "Emitiendo..." : "Emitir"}
                  </Button>
                )}
                {canReview && (
                  <Button
                    size="sm"
                    className="pg-btn-platinum w-full"
                    disabled={reviewMut.isPending}
                    onClick={() => reviewMut.mutate()}
                  >
                    {reviewMut.isPending ? "Revisando..." : "Revisar"}
                  </Button>
                )}
                {canApprove && (
                  <Button
                    size="sm"
                    className="pg-btn-platinum w-full"
                    disabled={approveMut.isPending}
                    onClick={() => approveMut.mutate()}
                  >
                    {approveMut.isPending ? "Aprobando..." : "Aprobar"}
                  </Button>
                )}
                {canDispatch && (
                  <Button
                    size="sm"
                    className="pg-btn-platinum w-full"
                    disabled={dispatchMut.isPending}
                    onClick={() => dispatchMut.mutate()}
                  >
                    {dispatchMut.isPending ? "Despachando..." : "Despachar"}
                  </Button>
                )}
                {canReject && (
                  <Button
                    size="sm"
                    className="pg-btn-platinum w-full"
                    onClick={() => {
                      setRejectStage(canReview ? "review" : canApprove ? "approve" : "dispatch");
                      setRejectModalOpen(true);
                    }}
                  >
                    Rechazar
                  </Button>
                )}
                {!canIssue && !canReview && !canApprove && !canDispatch && !canReject && (
                  <p className="text-[12px] text-muted-foreground text-center py-2">
                    No hay acciones disponibles.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de rechazo */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setRejectModalOpen(false)}>
          <div className="modal-md bg-card rounded-xl shadow-lg p-6 max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">Rechazar Gestión</h3>
            <p className="text-[12px] text-muted-foreground mb-3">
              Indica el motivo del rechazo. La gestión volverá a estado pendiente.
            </p>
            <Textarea
              className="app-input min-h-[80px] mb-3"
              placeholder="Motivo del rechazo..."
              value={rejectComment}
              onChange={(e) => setRejectComment(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                className="pg-btn-platinum"
                onClick={() => { setRejectModalOpen(false); setRejectComment(""); }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="pg-btn-platinum"
                disabled={rejectMut.isPending}
                onClick={() => rejectMut.mutate()}
              >
                {rejectMut.isPending ? "Rechazando..." : "Rechazar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Sub-componente: WorkflowStep
// ──────────────────────────────────────────────────────────────

function WorkflowStep({
  icon: Icon,
  label,
  date,
  done,
  active,
  overdue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  date: string | null;
  done?: boolean;
  active?: boolean;
  overdue?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          done
            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-400"
            : active
              ? overdue
                ? "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400"
                : "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[12px] font-medium ${done ? "text-foreground" : active ? "text-primary" : "text-muted-foreground"}`}>
          {label}
          {active && overdue && " (vencido)"}
        </p>
        <p className="text-[11px] text-muted-foreground">{formatDate(date)}</p>
      </div>
      {done && <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
    </div>
  );
}
