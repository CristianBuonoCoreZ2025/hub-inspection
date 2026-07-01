"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInspectionSessionById,
  updateInspectionSession,
  cancelInspectionSession,
  rescheduleInspectionSession,
  getInspectorSchedule,
} from "@/services/inspections";
import { updateClaimStatus, updateClaimFields } from "@/services/claims";
import { getLookupCatalog } from "@/services/catalogs";
import { getUsers } from "@/services/users";
import { toast } from "sonner";
import {
  ArrowLeft,
  ClipboardCheck,
  Calendar,
  Play,
  CheckCircle,
  XCircle,
  FileText,
  MapPin,
  User,
  Clock,
  ShieldCheck,
  MessageSquare,
  RotateCcw,
  CalendarClock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InspectionSession } from "@/types";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import ActaForm from "./acta-form";
import ChecklistTab from "./checklist-tab";
import DamagesTab from "./damages-tab";
import EvidencesTab from "./evidences-tab";
import SignaturesTab from "./signatures-tab";
import ReportTab from "./report-tab";
import SketchesTab from "./sketches-tab";
import ChatTab from "./chat-tab";

// Mapea estado de inspección → código de estado de claim
const sessionToClaimStatusCode: Record<string, string> = {
  scheduled: "scheduled",
  active: "in_progress",
  completed: "in_review",
  cancelled: "pending_info",
};
// Nota: "pending" ya no existe en el flujo. La inspección nace como "scheduled".

const sessionStatusLabels: Record<string, string> = {
  pending: "Pendiente",
  scheduled: "Agendada",
  active: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const sessionStatusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  active: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
  completed: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionId = params.id as string;
  const [activeTab, setActiveTab] = useState("resumen");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState<string>("");
  const [cancelNotes, setCancelNotes] = useState<string>("");
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleTime, setRescheduleTime] = useState<string>("");
  const [rescheduleType, setRescheduleType] = useState<"onsite" | "remote">("onsite");
  const [rescheduleInspectorId, setRescheduleInspectorId] = useState<string>("");
  const { codeToId } = useClaimStatuses();

  const { data: session, isLoading } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });
  const inspectors = users?.filter((u) => u.role === "inspector") || [];

  // Pre-seleccionar el inspector del siniestro al abrir el modal de reagendamiento
  useEffect(() => {
    if (rescheduleModalOpen && session?.claim?.inspector_id) {
      setRescheduleInspectorId(session.claim.inspector_id);
    }
  }, [rescheduleModalOpen, session]);

  // Query: agenda del inspector para la fecha seleccionada (reagendamiento)
  const rescheduleDateForQuery = rescheduleDate ? new Date(`${rescheduleDate}T00:00:00`) : null;
  const { data: rescheduleSchedule, isLoading: rescheduleScheduleLoading } = useQuery({
    queryKey: ["inspector-schedule", rescheduleInspectorId, rescheduleDate],
    queryFn: () => {
      if (!rescheduleDateForQuery) return [];
      const start = new Date(rescheduleDateForQuery);
      const end = new Date(rescheduleDateForQuery);
      end.setDate(end.getDate() + 1);
      return getInspectorSchedule(rescheduleInspectorId, start.toISOString(), end.toISOString());
    },
    enabled: !!rescheduleInspectorId && !!rescheduleDate && rescheduleModalOpen,
  });

  // Generar slots para reagendamiento
  const RESCHEDULE_SLOT_MIN = rescheduleType === "onsite" ? 120 : 30;
  const generateRescheduleSlots = () => {
    const slots: { time: string; label: string; available: boolean; extra: boolean; bookedInfo?: string }[] = [];
    const DAY_START = 6, DAY_END = 22, NORMAL_START = 9, NORMAL_END = 18;
    const totalMin = (DAY_END - DAY_START) * 60;
    const now = new Date();
    const isToday = rescheduleDate === now.toISOString().split("T")[0];
    for (let offset = 0; offset + RESCHEDULE_SLOT_MIN <= totalMin; offset += RESCHEDULE_SLOT_MIN) {
      const startHour = DAY_START + Math.floor(offset / 60);
      const startMin = offset % 60;
      const endHour = DAY_START + Math.floor((offset + RESCHEDULE_SLOT_MIN) / 60);
      const endMin = (offset + RESCHEDULE_SLOT_MIN) % 60;
      const timeStr = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
      const endStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;
      // Si es hoy, saltar slots que ya pasaron
      if (isToday) {
        const slotStartCheck = new Date(`${rescheduleDate}T${timeStr}:00`);
        if (slotStartCheck <= now) continue;
      }
      const isExtra = startHour < NORMAL_START || startHour >= NORMAL_END;
      const slotStart = new Date(`${rescheduleDate}T${timeStr}:00`);
      const slotEnd = new Date(`${rescheduleDate}T${endStr}:00`);
      const booked = rescheduleSchedule?.find((s) => {
        const sStart = new Date(s.scheduled_at);
        const sDuration = s.inspection_type === "onsite" ? 120 : 30;
        const sEnd = new Date(sStart.getTime() + sDuration * 60000);
        return sStart < slotEnd && sEnd > slotStart;
      });
      slots.push({
        time: timeStr,
        label: `${timeStr} - ${endStr}`,
        available: !booked,
        extra: isExtra,
        bookedInfo: booked ? `${booked.claim.claim_number}` : undefined,
      });
    }
    return slots;
  };
  const rescheduleSlots = rescheduleDate && rescheduleInspectorId ? generateRescheduleSlots() : [];

  // Cargar motivos de cancelación
  const { data: cancellationReasons } = useQuery({
    queryKey: ["lookup-catalog", "cancellation_reason"],
    queryFn: () => getLookupCatalog("cancellation_reason"),
    enabled: cancelModalOpen || rescheduleModalOpen,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InspectionSession> }) =>
      updateInspectionSession(id, input),
    onSuccess: async (_data, variables) => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });

      const newStatus = variables.input.status;
      if (newStatus && session?.claim_id) {
        const statusCode = sessionToClaimStatusCode[newStatus];
        const statusId = statusCode ? codeToId[statusCode] : null;
        if (statusId) {
          try {
            await updateClaimStatus(session.claim_id, statusId);
            queryClient.invalidateQueries({ queryKey: ["claim", session.claim_id] });
            queryClient.invalidateQueries({ queryKey: ["claims"] });
          } catch {
            // No bloquear la UI si el claim no se puede actualizar
          }
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reasonId, notes }: { id: string; reasonId: string; notes?: string }) =>
      cancelInspectionSession(id, reasonId, notes),
    onSuccess: async () => {
      toast.success("Inspección cancelada");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", sessionId] });
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      setCancelModalOpen(false);
      setCancelReasonId("");
      setCancelNotes("");
      // Actualizar estado del claim
      if (session?.claim_id) {
        const statusId = codeToId["pending_info"];
        if (statusId) {
          try {
            await updateClaimStatus(session.claim_id, statusId);
            queryClient.invalidateQueries({ queryKey: ["claim", session.claim_id] });
            queryClient.invalidateQueries({ queryKey: ["claims"] });
          } catch {}
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ currentId, claimId, reasonId, notes, newOptions }: {
      currentId: string;
      claimId: string;
      reasonId: string;
      notes?: string;
      newOptions: { inspectionType: "onsite" | "remote"; scheduledAt: string; inspectorId?: string };
    }) => rescheduleInspectionSession(currentId, claimId, reasonId, notes, newOptions),
    onSuccess: (newSession) => {
      toast.success("Inspección reagendada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      setRescheduleModalOpen(false);
      setCancelReasonId("");
      setCancelNotes("");
      setRescheduleDate("");
      setRescheduleTime("");
      setRescheduleInspectorId("");
      // Navegar a la nueva inspección
      if (newSession?.id) {
        router.push(`/dashboard/inspecciones/${newSession.id}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="app-page">
        <div className="flex items-center justify-center py-20">
          <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Cargando inspeccion...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-page">
        <p className="text-muted-foreground py-20 text-center">
          No se encontro la sesion de inspeccion.
        </p>
      </div>
    );
  }

  const claim = session.claim as any;
  const insuredParticipant = claim?.claims_participants?.find((p: any) => p.type === "insured");
  const contactParticipant = claim?.claims_participants?.find((p: any) => p.type === "contact");

  const statusActions = () => {
    switch (session.status) {
      case "scheduled":
        return (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              className="btn-create btn-footer"
              onClick={() => updateMutation.mutate({ id: session.id, input: { status: "active" } })}
            >
              <Play className="mr-2 h-3.5 w-3.5" />
              Iniciar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="btn-cancel btn-footer"
              onClick={() => setRescheduleModalOpen(true)}
            >
              <RotateCcw className="mr-2 h-3.5 w-3.5" />
              Reagendar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="btn-cancel btn-footer"
              onClick={() => setCancelModalOpen(true)}
            >
              <XCircle className="mr-2 h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        );
      case "active":
        return (
          <div className="flex gap-2 flex-wrap">
            <Button
              size="sm"
              className="btn-save btn-footer"
              onClick={() => updateMutation.mutate({ id: session.id, input: { status: "completed" } })}
            >
              <CheckCircle className="mr-2 h-3.5 w-3.5" />
              Finalizar
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-page">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => router.push("/dashboard/inspecciones")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="app-page-title">
                {session.inspection_number || `Inspección ${session.id.slice(0, 8)}`}
              </h1>
              <span className="text-[13px] text-muted-foreground">
                Siniestro #{session.claim?.claim_number as string}
              </span>
              <Badge className={sessionStatusColors[session.status]}>
                {sessionStatusLabels[session.status]}
              </Badge>
              {session.inspection_type === "remote" && (
                <Badge className="bg-violet-500/10 text-violet-600 border-violet-500/20">
                  Remota
                </Badge>
              )}
            </div>
            <p className="app-page-lead">
              {insuredParticipant?.full_name || "—"} — {claim?.claim_address || "—"}
            </p>
            {session.inspection_type === "remote" && session.magic_link_token && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-2 text-[12px]">
                <span className="text-violet-700 dark:text-violet-300">Magic link:</span>
                <code className="flex-1 truncate text-muted-foreground">
                  {typeof window !== "undefined" ? `${window.location.origin}/inspection/${session.magic_link_token}` : `/inspection/${session.magic_link_token}`}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                      navigator.clipboard.writeText(`${window.location.origin}/inspection/${session.magic_link_token}`);
                      toast.success("Link copiado");
                    }
                  }}
                >
                  Copiar
                </Button>
              </div>
            )}
          </div>
        </div>
        {statusActions()}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-full overflow-x-auto flex justify-start sm:justify-center">
          <TabsTrigger value="resumen">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="acta">
            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
            Acta
          </TabsTrigger>
          <TabsTrigger value="checklist">
            <ClipboardCheck className="mr-1.5 h-3.5 w-3.5" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="danos">
            <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
            Danos
          </TabsTrigger>
          <TabsTrigger value="evidencias">
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            Evidencias
          </TabsTrigger>
          <TabsTrigger value="croquis">
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            Croquis
          </TabsTrigger>
          <TabsTrigger value="firmas">
            <User className="mr-1.5 h-3.5 w-3.5" />
            Firmas
          </TabsTrigger>
          <TabsTrigger value="informe">
            <FileText className="mr-1.5 h-3.5 w-3.5" />
            Informe
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Chat
          </TabsTrigger>
        </TabsList>

        {/* ── TAB: RESUMEN ── */}
        <TabsContent value="resumen" className="mt-4 space-y-4">
          {/* Datos del Siniestro */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Datos del Siniestro
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">N° Siniestro</span>
                <p className="font-medium">{claim?.claim_number as string}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">N° Poliza</span>
                <p className="font-medium">{claim?.policy_number as string}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Compañia</span>
                <p className="font-medium">{claim?.insurance_company?.name || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Fecha Siniestro</span>
                <p className="font-medium">{formatDate(claim?.claim_date as string | null)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Liquidacion</span>
                <p className="font-medium">{(claim?.liquidation_number as string) || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Liquidacion</span>
                <p className="font-medium">{(claim?.liquidation_number as string) || "—"}</p>
              </div>
            </div>
          </div>

          {/* Asegurado */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Asegurado
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Nombre</span>
                <p className="font-medium">{insuredParticipant?.full_name || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Email</span>
                <p className="font-medium">{insuredParticipant?.email || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Telefono</span>
                <p className="font-medium">{insuredParticipant?.phone || insuredParticipant?.cell_phone || "—"}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Direccion</span>
                <p className="font-medium">{claim?.claim_address || "—"}</p>
              </div>
            </div>
          </div>

          {/* Contacto */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Persona de Contacto
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Nombre</span>
                <p className="font-medium">{contactParticipant?.full_name || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Email</span>
                <p className="font-medium">{contactParticipant?.email || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Telefono</span>
                <p className="font-medium">{contactParticipant?.phone || contactParticipant?.cell_phone || "—"}</p>
              </div>
            </div>
          </div>

          {/* Estado de la Sesion */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Estado de la Sesion
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Estado</span>
                <p>
                  <Badge className={sessionStatusColors[session.status]}>
                    {sessionStatusLabels[session.status]}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Programada</span>
                <p className="font-medium">{session.scheduled_at ? formatDate(session.scheduled_at) : "Sin programar"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Iniciada</span>
                <p className="font-medium">{session.started_at ? formatDate(session.started_at) : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Finalizada</span>
                <p className="font-medium">{session.ended_at ? formatDate(session.ended_at) : "—"}</p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── TAB: ACTA DE INSPECCION ── */}
        <TabsContent value="acta" className="mt-4">
          {session.status === "scheduled" ? (
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Acta de Inspeccion
              </h3>
              <div className="mt-4 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
                <p className="text-sm text-amber-950 dark:text-amber-100">
                  Inicia la inspeccion para acceder al formulario del Acta.
                </p>
              </div>
            </div>
          ) : (
            <ActaForm session={session} />
          )}
        </TabsContent>

        {/* ── TAB: CHECKLIST ── */}
        <TabsContent value="checklist" className="mt-4">
          <ChecklistTab sessionId={session.id} />
        </TabsContent>

        {/* ── TAB: DANOS ── */}
        <TabsContent value="danos" className="mt-4">
          <DamagesTab sessionId={session.id} />
        </TabsContent>

        {/* ── TAB: EVIDENCIAS ── */}
        <TabsContent value="evidencias" className="mt-4">
          <EvidencesTab sessionId={session.id} />
        </TabsContent>

        {/* ── TAB: CROQUIS ── */}
        <TabsContent value="croquis" className="mt-4">
          <SketchesTab sessionId={session.id} />
        </TabsContent>

        {/* ── TAB: FIRMAS ── */}
        <TabsContent value="firmas" className="mt-4">
          <SignaturesTab sessionId={session.id} />
        </TabsContent>

        {/* ── TAB: INFORME ── */}
        <TabsContent value="informe" className="mt-4">
          <ReportTab
            sessionId={session.id}
            claimNumber={session.claim?.claim_number}
            sessionStatus={session.status}
            cancellationReason={cancellationReasons?.find(r => r.id === session.cancellation_reason_id)?.name || null}
            cancellationNotes={session.cancellation_notes}
            cancelledAt={session.cancelled_at}
          />
        </TabsContent>

        {/* ── TAB: CHAT ── */}
        <TabsContent value="chat" className="mt-4">
          <ChatTab sessionId={session.id} />
        </TabsContent>
      </Tabs>

      {/* Modal de Cancelación */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="modal-content max-w-[480px]">
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2">
              <XCircle className="h-4 w-4 text-rose-500" />
              Cancelar Inspección
            </DialogTitle>
            <DialogDescription className="modal-subtitle">
              Registra el motivo de cancelación. Se generará un informe de cancelación.
            </DialogDescription>
          </div>
          <div className="modal-body space-y-4">
            <div className="modal-field">
              <Label className="app-field-label">Motivo de cancelación *</Label>
              <Select value={cancelReasonId} onValueChange={(v) => setCancelReasonId(v ?? "")}>
                <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
                <SelectContent>
                  {cancellationReasons?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Notas adicionales</Label>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                rows={3}
                className="app-input resize-none"
                placeholder="Detalle del motivo de cancelación..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(false)} className="btn-cancel btn-footer">
              Cerrar
            </Button>
            <Button
              size="sm"
              disabled={!cancelReasonId || cancelMutation.isPending}
              onClick={() => cancelMutation.mutate({
                id: session.id,
                reasonId: cancelReasonId,
                notes: cancelNotes || undefined,
              })}
              className="btn-cancel btn-footer"
            >
              {cancelMutation.isPending ? <Clock className="mr-2 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-2 h-3.5 w-3.5" />}
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Reagendamiento */}
      <Dialog open={rescheduleModalOpen} onOpenChange={setRescheduleModalOpen}>
        <DialogContent className="modal-lg" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-sky-500" />
              Reagendar Inspección
            </DialogTitle>
            <DialogDescription className="modal-subtitle">
              La inspección actual se cancelará y se creará una nueva agendada.
            </DialogDescription>
          </div>
          <div className="modal-body space-y-4">
            <div className="modal-grid-3">
              <div className="modal-field">
                <Label className="app-field-label">Inspector *</Label>
                <Select value={rescheduleInspectorId} onValueChange={(v) => setRescheduleInspectorId(v ?? "")}>
                  <SelectTrigger className="app-input">
                    <SelectValue placeholder="Seleccionar...">
                      {inspectors.find((i) => i.id === rescheduleInspectorId)?.full_name || inspectors.find((i) => i.id === rescheduleInspectorId)?.email || "Seleccionar..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {inspectors.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Tipo *</Label>
                <Select value={rescheduleType} onValueChange={(v) => setRescheduleType(v as "onsite" | "remote")}>
                  <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onsite">Presencial (2h)</SelectItem>
                    <SelectItem value="remote">Remota (30min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field">
                <Label className="app-field-label">Fecha *</Label>
                <Input type="date" min={new Date().toISOString().split("T")[0]} value={rescheduleDate} onChange={(e) => { setRescheduleDate(e.target.value); setRescheduleTime(""); }} className="app-input" />
              </div>
            </div>

            {/* Disponibilidad del inspector */}
            {rescheduleInspectorId && rescheduleDate ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="app-field-label flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Disponibilidad
                  </Label>
                  <span className="text-[11px] text-muted-foreground">
                    {rescheduleType === "onsite" ? "Bloques de 2h" : "Bloques de 30min"} · Normal 9-18 · Extra 6-9 / 18-22
                  </span>
                </div>
                {rescheduleScheduleLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando...</span>
                  </div>
                ) : rescheduleSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin horarios disponibles.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[160px] overflow-y-auto p-1">
                    {rescheduleSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        title={slot.bookedInfo ? `Ocupado: ${slot.bookedInfo}` : slot.extra ? "Extra horario" : "Disponible"}
                        onClick={() => setRescheduleTime(slot.time)}
                        className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-all text-center ${
                          !slot.available
                            ? "border-rose-500/20 bg-rose-500/5 text-rose-400 cursor-not-allowed line-through"
                            : rescheduleTime === slot.time
                            ? slot.extra
                              ? "border-amber-500 bg-amber-500 text-white shadow-sm"
                              : "border-primary bg-primary text-primary-foreground shadow-sm"
                            : slot.extra
                            ? "border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 hover:border-amber-500/60 hover:bg-amber-500/10 cursor-pointer"
                            : "border-border bg-card hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                        }`}
                      >
                        {slot.label}
                        {slot.extra && slot.available && (
                          <span className="block text-[9px] font-normal text-amber-500/70 truncate mt-0.5">extra</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
                Selecciona inspector y fecha para ver la disponibilidad.
              </div>
            )}

            <div className="modal-field">
              <Label className="app-field-label">Motivo de reagendamiento *</Label>
              <Select value={cancelReasonId} onValueChange={(v) => setCancelReasonId(v ?? "")}>
                <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
                <SelectContent>
                  {cancellationReasons?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Notas</Label>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                rows={2}
                className="app-input resize-none"
                placeholder="Notas del reagendamiento..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <Button variant="outline" size="sm" onClick={() => setRescheduleModalOpen(false)} className="btn-cancel btn-footer">
              Cerrar
            </Button>
            <Button
              size="sm"
              disabled={!cancelReasonId || !rescheduleDate || !rescheduleTime || !rescheduleInspectorId || rescheduleMutation.isPending}
              onClick={() => {
                const scheduledAt = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
                rescheduleMutation.mutate({
                  currentId: session.id,
                  claimId: session.claim_id,
                  reasonId: cancelReasonId,
                  notes: cancelNotes || undefined,
                  newOptions: { inspectionType: rescheduleType, scheduledAt, inspectorId: rescheduleInspectorId || undefined },
                });
              }}
              className="btn-create btn-footer"
            >
              {rescheduleMutation.isPending ? <Clock className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-2 h-3.5 w-3.5" />}
              Reagendar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info de cancelación si aplica */}
      {session.status === "cancelled" && session.cancelled_at && (
        <div className="app-panel border-rose-500/20 bg-rose-500/5">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">
                Inspección Cancelada
              </h3>
              <p className="text-[12px] text-muted-foreground mt-1">
                {cancellationReasons?.find(r => r.id === session.cancellation_reason_id)?.name || "Motivo no registrado"}
              </p>
              {session.cancellation_notes && (
                <p className="text-[12px] text-muted-foreground mt-1 italic">
                  "{session.cancellation_notes}"
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-2">
                Cancelada el {new Date(session.cancelled_at).toLocaleString("es-CL")}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
