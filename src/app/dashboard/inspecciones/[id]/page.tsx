"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInspectionSessionById,
  updateInspectionSession,
} from "@/services/inspections";
import { updateClaimStatus } from "@/services/claims";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const { codeToId } = useClaimStatuses();

  const { data: session, isLoading } = useQuery({
    queryKey: ["inspection-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
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
      case "pending":
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="btn-create btn-footer"
              onClick={() => updateMutation.mutate({ id: session.id, input: { status: "scheduled" } })}
            >
              <Calendar className="mr-2 h-3.5 w-3.5" />
              Agendar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="btn-cancel btn-footer"
              onClick={() => updateMutation.mutate({ id: session.id, input: { status: "cancelled" } })}
            >
              <XCircle className="mr-2 h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        );
      case "scheduled":
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="btn-create btn-footer"
              onClick={() => updateMutation.mutate({ id: session.id, input: { status: "active" } })}
            >
              <Play className="mr-2 h-3.5 w-3.5" />
              Iniciar Inspeccion
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="btn-cancel btn-footer"
              onClick={() => updateMutation.mutate({ id: session.id, input: { status: "cancelled" } })}
            >
              <XCircle className="mr-2 h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        );
      case "active":
        return (
          <div className="flex gap-2">
            <Button
              size="sm"
              className="btn-save btn-footer"
              onClick={() => updateMutation.mutate({ id: session.id, input: { status: "completed" } })}
            >
              <CheckCircle className="mr-2 h-3.5 w-3.5" />
              Completar Inspeccion
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
            <div className="flex items-center gap-2">
              <h1 className="app-page-title">Inspeccion #{session.claim?.claim_number as string}</h1>
              <Badge className={sessionStatusColors[session.status]}>
                {sessionStatusLabels[session.status]}
              </Badge>
            </div>
            <p className="app-page-lead">
              {insuredParticipant?.full_name || "—"} — {claim?.claim_address || "—"}
            </p>
          </div>
        </div>
        {statusActions()}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="w-fit">
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
          {session.status === "pending" || session.status === "scheduled" ? (
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
          <ReportTab sessionId={session.id} claimNumber={session.claim?.claim_number} />
        </TabsContent>

        {/* ── TAB: CHAT ── */}
        <TabsContent value="chat" className="mt-4">
          <ChatTab sessionId={session.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
