"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck, Video, User, Calendar, WifiOff, Loader2,
  Camera, FileText, AlertTriangle, MessageSquare, Send,
  ShieldCheck, MapPin, PenTool, XCircle,
} from "lucide-react";
import VideoCall from "@/components/video-call";
import { DrawingCanvas } from "@/components/ui/drawing-canvas";

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════
interface LiveEvidence {
  id: string; url: string; type: string; description: string | null;
  category: string | null; created_at: string;
}
interface LiveNote { id: string; content: string; created_at: string; }
interface LiveDamage {
  id: string; category: string | null; subcategory: string | null;
  description: string; observations: string | null; severity: string;
  dependency: string | null; sector: string | null; materiality_type: string | null;
  damage_type: string | null; created_at: string;
}
interface LiveChatMessage {
  id: string; content: string; sender_name: string | null;
  sender_role: string | null; created_at: string;
}
interface LiveSignature {
  id: string; role: string; signature_url: string; signed_at: string;
}
interface LiveSketch {
  id: string; sketch_url: string; label: string | null; created_at: string;
}
interface LiveParticipant {
  type: string; full_name: string | null; email: string | null;
  phone: string | null; cell_phone: string | null;
}
interface LiveClaim {
  claim_number: string | null; client_reference: string | null;
  claim_address: string | null; policy_number: string | null;
  claim_date: string | null; liquidation_number: string | null;
  claims_participants: LiveParticipant[];
  insurance_company: { name: string } | null;
}
interface LiveSession {
  id: string; claim_id: string; status: string; inspection_type: string;
  scheduled_at: string | null; started_at: string | null; ended_at: string | null;
  magic_link_token: string | null; magic_link_expires_at: string | null;
  created_at: string;
  inspection_date: string | null; inspection_time: string | null;
  interviewed_name: string | null; interviewed_email: string | null;
  interviewed_relationship: string | null;
  police_report_number: string | null; police_report_name: string | null;
  police_report_rut: string | null;
  firefighters_company: string | null;
  other_insurances: boolean | null; other_insurance_company: string | null;
  inspector_observations: string | null;
  active_tab: string | null;
  acta_step: string | null;
  property_risk: Record<string, unknown> | null;
  property_materiality: Record<string, unknown> | null;
  security_measures: Record<string, unknown> | null;
  insured_statement: Record<string, unknown> | null;
  third_parties: unknown[] | null;
  inspection_number?: string;
  inspection_evidences: LiveEvidence[];
  inspection_notes: LiveNote[];
  inspection_damages: LiveDamage[];
  inspection_chat_messages: LiveChatMessage[];
  inspection_signatures: LiveSignature[];
  damage_sketches: LiveSketch[];
  claim: LiveClaim | null;
}

// ═══════════════════════════════════════════════════════════════
// Fetch
// ═══════════════════════════════════════════════════════════════
async function fetchLiveSession(token: string): Promise<LiveSession | null> {
  const res = await fetch(`/api/inspection/live/${token}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { session: LiveSession | null };
  return data.session;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════
const severityLabels: Record<string, string> = {
  low: "Leve", medium: "Moderado", high: "Grave", total: "Total",
};
const severityColors: Record<string, string> = {
  low: "text-slate-400", medium: "text-amber-400", high: "text-rose-400", total: "text-rose-500",
};
const damageCategoryLabels: Record<string, string> = {
  structural: "Estructural",
  roof: "Cubierta / Techumbre",
  electrical: "Inst. Eléctricas",
  plumbing: "Inst. Sanitarias / Gas",
  finishes: "Terminaciones",
  openings: "Aberturas",
  content: "Contenido",
  building: "Edificio",
};
const statusLabels: Record<string, string> = {
  pending: "Pendiente", scheduled: "Agendada", active: "En progreso",
  completed: "Completada", cancelled: "Cancelada",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("es-CL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
}
function val(obj: Record<string, unknown> | null, key: string): string {
  const v = obj?.[key];
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return String(v);
}
function boolVal(obj: Record<string, unknown> | null, key: string): string {
  const v = obj?.[key];
  if (v && typeof v === "object") {
    const has = (v as Record<string, unknown>).has_it;
    const detail = (v as Record<string, unknown>).detail;
    if (has) return detail ? `Sí — ${String(detail)}` : "Sí";
    return "No";
  }
  if (typeof v === "boolean") return v ? "Sí" : "No";
  return "—";
}

// ═══════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════
export default function MagicLinkPage() {
  const params = useParams();
  const token = params.token as string;
  const [now, setNow] = useState(new Date());
  const [chatPanelOpen, setChatPanelOpen] = useState(true);
  const [videoCallOpen, setVideoCallOpen] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["magic-link-live", token],
    queryFn: () => fetchLiveSession(token),
    refetchInterval: 2000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
          <p className="text-slate-400 text-sm">Conectando a la inspección...</p>
        </div>
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center max-w-md">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-rose-500/10 mb-4">
            <WifiOff className="h-8 w-8 text-rose-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Link inválido o expirado</h1>
          <p className="text-slate-400 text-sm">
            El link de inspección no es válido o ha expirado. Contacte a su liquidador.
          </p>
        </div>
      </div>
    );
  }

  const isExpired = session.magic_link_expires_at && new Date(session.magic_link_expires_at) < now;
  const isScheduled = session.status === "scheduled";
  const isCompleted = session.status === "completed";
  const isCancelled = session.status === "cancelled";
  const hasInsuredSignature = session.inspection_signatures?.some((s) => s.role === "insured");
  const hasAdjusterSignature = session.inspection_signatures?.some((s) => s.role === "adjuster");
  // El link se cierra solo cuando está completado Y ambas firmas existen
  const isFullyClosed = isCompleted && hasInsuredSignature && hasAdjusterSignature;

  if (isExpired || isCancelled || isFullyClosed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center max-w-md">
          <WifiOff className="h-12 w-12 mx-auto text-slate-500 mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">
            {isExpired ? "Link expirado" : isCancelled ? "Inspección cancelada" : "Inspección completada"}
          </h1>
          <p className="text-slate-400 text-sm">
            {isExpired
              ? "Este link ha expirado. Contacte a su liquidador para obtener uno nuevo."
              : isCancelled
              ? "Esta inspección ha sido cancelada. Contacte a su liquidador."
              : "La inspección ha finalizado. Gracias por su colaboración."}
          </p>
        </div>
      </div>
    );
  }

  if (isScheduled) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="max-w-md w-full mx-4 rounded-xl border border-sky-500/20 bg-sky-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10">
              <Calendar className="h-5 w-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Inspección programada</h2>
              <p className="text-[12px] text-slate-400">Su inspector lo contactará a la hora indicada</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 p-3">
              <Calendar className="h-4 w-4 text-sky-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">Fecha y hora</p>
                <p className="text-[13px] font-medium">{fmtDate(session.scheduled_at)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-slate-900/50 p-3">
              <Video className="h-4 w-4 text-violet-400 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500">Modalidad</p>
                <p className="text-[13px] font-medium">Remota (video llamada)</p>
              </div>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[12px] text-amber-300">
            <strong>Importante:</strong> Mantenga esta pestaña abierta. Cuando el inspector inicie la sesión,
            verá la inspección en tiempo real aquí mismo.
          </div>
        </div>
      </div>
    );
  }

  // isActive — piloto automático: el tab lo controla el inspector
  const activeTab = session.active_tab || "resumen";
  const tabs = [
    { id: "resumen", label: "Resumen", icon: FileText },
    { id: "acta", label: "Acta", icon: ClipboardCheck },
    { id: "danos", label: "Daños", icon: ShieldCheck },
    { id: "evidencias", label: "Evidencias", icon: Camera },
    { id: "croquis", label: "Croquis", icon: MapPin },
    { id: "firmas", label: "Firmas", icon: PenTool },
  ];

  // Si está completado pero falta firmar, forzar tab de firmas
  const effectiveTab = isCompleted && !hasInsuredSignature ? "firmas" : activeTab;

  // Label del step interno del acta (para el footer)
  const actaStepLabels: Record<string, string> = {
    datos: "Datos Generales", riesgo: "Riesgo Siniestrado", materialidad: "Materialidad",
    seguridad: "Seguridad", declaracion: "Declaracion", terceros: "Terceros",
  };
  const innerTabForActa = effectiveTab === "acta" && session.acta_step
    ? actaStepLabels[session.acta_step] || null
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-sky-500 to-blue-600">
              <ClipboardCheck className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold">Inspección Remota</p>
              <p className="text-[11px] text-slate-400 font-mono">{session.inspection_number}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" /> En vivo
            </span>
            {/* Botón Videollamada */}
            {!isCompleted && (
              <button
                onClick={() => setVideoCallOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-500 transition-colors"
              >
                <Video className="h-3.5 w-3.5" />
                Videollamada
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modal Videollamada */}
      {videoCallOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
          <div className="relative w-full max-w-2xl mx-4 rounded-xl bg-slate-900 p-4 border border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Video className="h-4 w-4 text-sky-400" />
                Videollamada con Inspector
              </h3>
              <button
                onClick={() => setVideoCallOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <VideoCall
              sessionId={session.id}
              displayName={session.interviewed_name || "Cliente"}
              onHangup={() => setVideoCallOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Indicador de progreso (read-only, no clickeable) */}
      <div className="max-w-5xl mx-auto px-4 pt-4">
        <div className="flex gap-1 overflow-x-auto pb-2 border-b border-slate-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === effectiveTab;
            return (
              <div
                key={tab.id}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-medium ${
                  active
                    ? "bg-sky-500/15 text-sky-400"
                    : "text-slate-600"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content + Chat lateral */}
      <div className="max-w-5xl mx-auto px-4 flex gap-4">
        {/* Contenido principal */}
        <main className="flex-1 min-w-0 py-6">
        {/* Banner: inspección completada, falta firmar */}
        {isCompleted && !hasInsuredSignature && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
            <p className="text-[14px] text-amber-300 font-medium">
              La inspección ha finalizado. Por favor firme en la pestaña &ldquo;Firmas&rdquo; para confirmar.
            </p>
          </div>
        )}
        {effectiveTab === "resumen" && <ResumenTab session={session} />}
        {effectiveTab === "acta" && <ActaTab session={session} actaStep={session.acta_step || "datos"} />}
        {effectiveTab === "danos" && <DamagesTab damages={session.inspection_damages} />}
        {effectiveTab === "evidencias" && <EvidencesTab evidences={session.inspection_evidences} />}
        {effectiveTab === "croquis" && <SketchesTab sketches={session.damage_sketches} session={session} />}
        {effectiveTab === "firmas" && <SignaturesTab session={session} />}
        </main>

        {/* Panel lateral de Chat */}
        {chatPanelOpen && (
          <div className="w-[300px] shrink-0 hidden lg:flex flex-col py-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 flex flex-col flex-1 sticky top-20" style={{ maxHeight: "calc(100vh - 100px)" }}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <span className="text-[12px] font-semibold text-slate-400 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat con Inspector
                </span>
                <button
                  onClick={() => setChatPanelOpen(false)}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatPanel session={session} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón flotante para reabrir chat */}
      {!chatPanelOpen && (
        <button
          onClick={() => setChatPanelOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-sky-600 text-white shadow-lg hover:scale-105 transition-transform"
          title="Abrir chat"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      <div className="text-center pb-6 pt-4">
        <p className="text-[10px] text-slate-600">
          Siguiendo al inspector en tiempo real · {tabs.find((t) => t.id === effectiveTab)?.label || "Resumen"}
          {effectiveTab === "acta" && innerTabForActa && ` · ${innerTabForActa}`}
        </p>
        <p className="text-[10px] text-slate-700 mt-0.5">
          Esta página se actualiza automáticamente cada 2 segundos.
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Resumen
// ═══════════════════════════════════════════════════════════════
function ResumenTab({ session }: { session: LiveSession }) {
  const claim = session.claim;
  const insured = claim?.claims_participants?.find((p) => p.type === "insured");
  return (
    <div className="space-y-2">
      <Panel title="Datos del Siniestro">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
          <Field label="N° Interno" value={claim?.liquidation_number || "—"} mono />
          <Field label="Ref. Cliente" value={claim?.client_reference || "—"} />
          <Field label="N° Siniestro Cía" value={claim?.claim_number || "—"} />
          <Field label="N° Póliza" value={claim?.policy_number || "—"} />
          <Field label="Compañía" value={claim?.insurance_company?.name || "—"} />
          <Field label="Fecha Siniestro" value={fmtDate(claim?.claim_date || null)} />
        </div>
      </Panel>
      <Panel title="Asegurado">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
          <Field label="Nombre" value={insured?.full_name || "—"} />
          <Field label="Email" value={insured?.email || "—"} />
          <Field label="Teléfono" value={insured?.phone || insured?.cell_phone || "—"} />
          <Field label="Dirección" value={claim?.claim_address || "—"} />
        </div>
      </Panel>
      <Panel title="Contacto de Inspección">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
          <Field label="Nombre contacto" value={session.interviewed_name || "—"} />
          <Field label="Email" value={session.interviewed_email || "—"} />
          <Field label="Lugar inspección" value={claim?.claim_address || "—"} />
          {session.inspector_observations && (
            <div className="col-span-2 md:col-span-3">
              <p className="text-[10px] text-slate-500 mb-0.5">Comentarios</p>
              <p className="font-medium whitespace-pre-wrap text-[12px]">{session.inspector_observations}</p>
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Estado de la Sesión">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 text-[12px]">
          <Field label="Estado" value={statusLabels[session.status] || session.status} />
          <Field label="Programada" value={fmtDate(session.scheduled_at)} />
          <Field label="Iniciada" value={fmtDate(session.started_at)} />
          <Field label="Finalizada" value={fmtDate(session.ended_at)} />
        </div>
      </Panel>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Acta (read-only)
// ═══════════════════════════════════════════════════════════════
function ActaTab({ session, actaStep }: { session: LiveSession; actaStep: string }) {
  const innerTab = actaStep;
  const pr = session.property_risk;
  const pm = session.property_materiality;
  const sm = session.security_measures;
  const isv = session.insured_statement;
  const tp = (session.third_parties || []) as Array<Record<string, unknown>>;

  const hasData =
    (pr && Object.keys(pr).length > 0) ||
    (pm && Object.keys(pm).length > 0) ||
    (sm && Object.keys(sm).length > 0) ||
    (isv && Object.keys(isv).length > 0) ||
    tp.length > 0 ||
    session.interviewed_name ||
    session.inspector_observations;

  if (!hasData) {
    return (
      <Panel>
        <div className="text-center py-8">
          <ClipboardCheck className="h-8 w-8 mx-auto text-slate-600 mb-2" />
          <p className="text-[13px] text-slate-400">El inspector aún no ha completado el acta.</p>
          <p className="text-[11px] text-slate-600 mt-1">Los datos aparecerán aquí automáticamente.</p>
        </div>
      </Panel>
    );
  }

  const innerTabs = [
    { id: "datos", label: "Datos Generales" },
    { id: "riesgo", label: "Riesgo Siniestrado" },
    { id: "materialidad", label: "Materialidad" },
    { id: "seguridad", label: "Seguridad" },
    { id: "declaracion", label: "Declaracion" },
    { id: "terceros", label: "Terceros" },
  ];

  return (
    <div className="space-y-2">
      {/* Tabs internos del acta (read-only, controlados por el inspector) */}
      <div className="flex gap-1 overflow-x-auto pb-2 border-b border-slate-800">
        {innerTabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex shrink-0 items-center rounded-lg px-3 py-1.5 text-[12px] font-medium ${
              innerTab === tab.id
                ? "bg-sky-500/15 text-sky-400"
                : "text-slate-600"
            }`}
          >
            {tab.label}
          </div>
        ))}
      </div>

      {/* Datos Generales */}
      {innerTab === "datos" && (
        <div className="space-y-2">
          <Panel title="Datos Generales de la Inspeccion">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
              <Field label="Fecha Inspeccion" value={session.inspection_date || "—"} />
              <Field label="Hora Inspeccion" value={session.inspection_time || "—"} />
              <Field label="Nombre Entrevistado" value={session.interviewed_name || "—"} />
              <Field label="Email Entrevistado" value={session.interviewed_email || "—"} />
              <Field label="Relacion con Asegurado" value={session.interviewed_relationship || "—"} />
            </div>
          </Panel>
          <Panel title="Parte Policial y Bomberos">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
              <Field label="N° Parte Policial" value={session.police_report_number || "—"} />
              <Field label="Nombre Denunciante" value={session.police_report_name || "—"} />
              <Field label="RUT Denunciante" value={session.police_report_rut || "—"} />
              <Field label="Compañia Bomberos" value={session.firefighters_company || "—"} />
            </div>
          </Panel>
          <Panel title="Otros Seguros y Observaciones">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
              <Field label="¿Presenta otros seguros?" value={session.other_insurances ? "Sí" : "No"} />
              {session.other_insurances && (
                <Field label="Compañia" value={session.other_insurance_company || "—"} />
              )}
            </div>
            {session.inspector_observations && (
              <div className="mt-3">
                <p className="text-[10px] tracking-wide text-slate-500 mb-1">Observaciones del Inspector</p>
                <p className="text-[13px] whitespace-pre-wrap">{session.inspector_observations}</p>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Riesgo Siniestrado */}
      {innerTab === "riesgo" && (
        <Panel title="Descripcion del Riesgo Siniestrado">
          {(() => {
            const riskClass = val(pr, "risk_class");
            const isResidential = riskClass === "Residencial";
            return (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
                <Field label="Clasificacion del Bien" value={riskClass} />
                <Field label="Destino del Bien" value={val(pr, "property_type")} />
                <Field label="N° Dpto / Oficina" value={val(pr, "apartment_number")} />
                <Field label="N° Pisos" value={val(pr, "floor_count")} />
                <Field label="Antiguedad del Inmueble" value={val(pr, "age_years")} />
                <Field label="Superficie Construida (m²)" value={val(pr, "built_surface")} />
                <Field label="Cantidad Espacios" value={val(pr, "room_count")} />
                <Field label="Cantidad Baños" value={val(pr, "bathroom_count")} />
                <Field label="N° Oficinas" value={val(pr, "office_count")} />
                <Field label="N° Bodegas" value={val(pr, "warehouse_count")} />
                <Field label="¿Se encuentra habitable?" value={val(pr, "is_habitable")} />
                <Field label="Nombre Propietario(s)" value={val(pr, "owner_name")} />
                {!isResidential && <Field label="Sucursales" value={val(pr, "branch_count")} />}
                <Field label={isResidential ? "N° Habitantes" : "N° Trabajadores"} value={val(pr, "worker_resident_count")} />
                {!isResidential && <Field label="Rubro de la Empresa" value={val(pr, "business_line")} />}
              </div>
            );
          })()}
        </Panel>
      )}

      {/* Materialidad */}
      {innerTab === "materialidad" && (
        <Panel title="Materialidad">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
            <Field label="Muros" value={val(pm, "walls")} />
            <Field label="Cubierta / Techumbre" value={val(pm, "roof")} />
            <Field label="Pavimentos Interiores" value={val(pm, "interior_flooring")} />
            <Field label="Cielos Interiores" value={val(pm, "interior_ceilings")} />
            <Field label="Terminaciones Interiores" value={val(pm, "interior_finishes")} />
            <Field label="Terminaciones Exteriores" value={val(pm, "exterior_finishes")} />
            <Field label="Cierre Perimetral" value={val(pm, "perimeter_closure")} />
            <Field label="Otros" value={val(pm, "others")} />
          </div>
        </Panel>
      )}

      {/* Seguridad */}
      {innerTab === "seguridad" && (
        <Panel title="Medidas de Asegurabilidad">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-[12px]">
            <Field label="Protecciones Generales" value={boolVal(sm, "protections")} />
            <Field label="Chapas / Cerraduras de Seguridad" value={boolVal(sm, "security_locks")} />
            <Field label="Guardias de Seguridad" value={boolVal(sm, "security_guards")} />
            <Field label="Alarmas" value={boolVal(sm, "alarms")} />
            <Field label="Camaras de Seguridad" value={boolVal(sm, "cameras")} />
            <Field label="Otras Medidas" value={boolVal(sm, "other_measures")} />
          </div>
        </Panel>
      )}

      {/* Declaración del Asegurado */}
      {innerTab === "declaracion" && (
        <Panel title="Declaracion del Asegurado">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            <Field label="Relato de los Hechos" value={val(isv, "statement")} />
            <Field label="Punto de Ingreso / Salida" value={val(isv, "entry_exit_point")} />
            <Field label="Activacion de Alarmas" value={val(isv, "alarm_activation")} />
            <Field label="Objetos Sustraidos (estimacion)" value={val(isv, "stolen_items_estimate")} />
            <Field label="Uso de Vehiculos" value={val(isv, "vehicle_use")} />
            <Field label="Duracion del Incidente" value={val(isv, "incident_duration")} />
          </div>
        </Panel>
      )}

      {/* Terceros */}
      {innerTab === "terceros" && (
        <Panel title={`Terceros (${tp.length})`}>
          {tp.length === 0 ? (
            <p className="text-[13px] text-slate-500 text-center py-4">No hay terceros registrados.</p>
          ) : (
            <div className="space-y-2">
              {tp.map((t, i) => (
                <div key={i} className="rounded-lg bg-slate-900/50 p-3 text-[12px]">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <Field label="Nombre" value={val(t, "name")} />
                    <Field label="RUT" value={val(t, "rut")} />
                    <Field label="Relación" value={val(t, "relationship")} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* Observaciones (siempre visible al final) */}
      {session.inspector_observations && (
        <Panel title="Observaciones del Inspector">
          <p className="text-[13px] text-slate-300 whitespace-pre-wrap">{session.inspector_observations}</p>
        </Panel>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Daños (read-only)
// ═══════════════════════════════════════════════════════════════
function DamagesTab({ damages }: { damages: LiveDamage[] }) {
  if (!damages.length) {
    return <EmptyState icon={ShieldCheck} text="No hay daños registrados aún." />;
  }
  return (
    <Panel>
      <div className="space-y-2">
        {damages.map((dmg) => (
          <div key={dmg.id} className="rounded-lg bg-slate-900/50 p-3 text-[13px]">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-slate-200">{dmg.description}</p>
                <div className="flex flex-wrap gap-2 mt-1 text-[10px]">
                  {dmg.category && (
                    <span className="text-sky-400/80">
                      {damageCategoryLabels[dmg.category] || dmg.category}
                    </span>
                  )}
                  {dmg.dependency && <span className="text-slate-500">· {dmg.dependency}</span>}
                  {dmg.severity && (
                    <span className={severityColors[dmg.severity] || "text-slate-400"}>
                      · {severityLabels[dmg.severity] || dmg.severity}
                    </span>
                  )}
                </div>
                {dmg.observations && (
                  <p className="text-[11px] text-slate-500 mt-1">{dmg.observations}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Evidencias (read-only)
// ═══════════════════════════════════════════════════════════════
function EvidencesTab({ evidences }: { evidences: LiveEvidence[] }) {
  if (!evidences.length) {
    return <EmptyState icon={Camera} text="No hay evidencias aún. El inspector las subirá durante la inspección." />;
  }
  return (
    <Panel>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {evidences.map((ev) => (
          <div key={ev.id} className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
            {ev.url && ev.type === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ev.url} alt={ev.description || ""} className="w-full h-32 object-cover" />
            ) : ev.url && ev.type === "video" ? (
              <video src={ev.url} className="w-full h-32 object-cover" controls />
            ) : (
              <div className="w-full h-32 flex items-center justify-center bg-slate-900">
                <FileText className="h-8 w-8 text-slate-600" />
              </div>
            )}
            {ev.description && (
              <p className="text-[10px] text-slate-400 p-2 truncate">{ev.description}</p>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Croquis (interactivo — cliente puede dibujar y editar)
// ═══════════════════════════════════════════════════════════════
function SketchesTab({ sketches, session }: { sketches: LiveSketch[]; session: LiveSession }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "draw">("view");
  const [editingSketch, setEditingSketch] = useState<{ id: string; url: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const sketchMutation = useMutation({
    mutationFn: async (data: { sessionId: string; sketchDataUrl: string; label: string; sketchId?: string }) => {
      const res = await fetch("/api/inspection/sketch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar croquis");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["magic-link-live", session.magic_link_token] });
      setMode("view");
      setEditingSketch(null);
    },
  });

  function handleSave(dataUrl: string) {
    setSaving(true);
    sketchMutation.mutate(
      {
        sessionId: session.id,
        sketchDataUrl: dataUrl,
        label: editingSketch?.label || "Croquis del asegurado",
        sketchId: editingSketch?.id,
      },
      { onSettled: () => setSaving(false) }
    );
  }

  if (mode === "draw") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-slate-200 flex items-center gap-2">
            <PenTool className="h-4 w-4 text-sky-400" />
            {editingSketch ? "Editar Croquis" : "Dibujar Croquis del Bien Siniestrado"}
          </h3>
          <button
            onClick={() => { setMode("view"); setEditingSketch(null); }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12px] text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </button>
        </div>
        <Panel>
          <DrawingCanvas
            onSave={handleSave}
            saving={saving}
            initialImage={editingSketch?.url}
            height={450}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Botón dibujar */}
      <button
        onClick={() => { setEditingSketch(null); setMode("draw"); }}
        className="w-full rounded-lg border-2 border-dashed border-slate-700 py-4 text-[13px] text-slate-300 hover:border-sky-500/50 hover:bg-sky-950/20 transition-colors flex items-center justify-center gap-2"
      >
        <PenTool className="h-4 w-4" />
        Dibujar Croquis
      </button>

      {/* Croquis existentes */}
      {sketches.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sketches.map((sk) => (
            <div key={sk.id} className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sk.sketch_url} alt={sk.label || "Croquis"} className="w-full h-48 object-contain bg-white" />
              <div className="flex items-center justify-between p-2">
                <p className="text-[11px] text-slate-400 truncate">{sk.label}</p>
                <button
                  onClick={() => { setEditingSketch({ id: sk.id, url: sk.sketch_url, label: sk.label || "" }); setMode("draw"); }}
                  className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
                >
                  <PenTool className="h-3 w-3" /> Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={MapPin} text="No hay croquis aún. Dibuja el plano del bien siniestrado." />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Firmas (interactivo — cliente firma)
// ═══════════════════════════════════════════════════════════════
function SignaturesTab({ session }: { session: LiveSession }) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const insuredSig = session.inspection_signatures?.find((s) => s.role === "insured");
  const adjusterSig = session.inspection_signatures?.find((s) => s.role === "adjuster");

  const signMutation = useMutation({
    mutationFn: async (data: { sessionId: string; role: string; signatureDataUrl: string }) => {
      const res = await fetch("/api/inspection/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar firma");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["magic-link-live", session.magic_link_token] });
    },
  });

  // Canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(200, rect.width);
      const h = 180;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#0a0a0a";
      }
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    return () => observer.disconnect();
  }, [insuredSig]);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    lastPosRef.current = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    if (lastPosRef.current) {
      const midX = (lastPosRef.current.x + pos.x) / 2;
      const midY = (lastPosRef.current.y + pos.y) / 2;
      ctx.quadraticCurveTo(lastPosRef.current.x, lastPosRef.current.y, midX, midY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(midX, midY);
    }
    lastPosRef.current = pos;
  };
  const stop = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  const save = async () => {
    const canvas = canvasRef.current!;
    const dataUrl = canvas.toDataURL("image/png");
    if (dataUrl.length < 1000) return;
    setSaving(true);
    try {
      await signMutation.mutateAsync({
        sessionId: session.id,
        role: "insured",
        signatureDataUrl: dataUrl,
      });
      clear();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Firmas existentes */}
      {(insuredSig || adjusterSig) && (
        <Panel title="Firmas Guardadas">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insuredSig && (
              <div className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-sky-400" />
                  <span className="text-[13px] font-medium">Asegurado</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={insuredSig.signature_url} alt="Firma asegurado" className="w-full h-[100px] object-contain bg-white rounded border border-slate-800" />
                <p className="text-[11px] text-slate-500 mt-1">{fmtDate(insuredSig.signed_at)}</p>
              </div>
            )}
            {adjusterSig && (
              <div className="rounded-lg border border-slate-800 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4 text-violet-400" />
                  <span className="text-[13px] font-medium">Ajustador</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={adjusterSig.signature_url} alt="Firma ajustador" className="w-full h-[100px] object-contain bg-white rounded border border-slate-800" />
                <p className="text-[11px] text-slate-500 mt-1">{fmtDate(adjusterSig.signed_at)}</p>
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Canvas para firma del asegurado */}
      {!insuredSig && (
        <Panel title="Firme aquí como Asegurado">
          <div ref={containerRef} className="rounded-lg border border-slate-700 bg-white w-full mb-3">
            <canvas
              ref={canvasRef}
              className="w-full cursor-crosshair touch-none block"
              onMouseDown={start}
              onMouseMove={draw}
              onMouseUp={stop}
              onMouseLeave={stop}
              onTouchStart={start}
              onTouchMove={draw}
              onTouchEnd={stop}
            />
          </div>
          <div className="flex gap-2">
            <button onClick={clear} className="rounded-lg border border-slate-700 px-3 py-1.5 text-[12px] text-slate-300 hover:bg-slate-800">
              Limpiar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-[12px] text-white hover:bg-sky-500 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PenTool className="h-3.5 w-3.5" />}
              Firmar
            </button>
          </div>
        </Panel>
      )}

      {insuredSig && !adjusterSig && (
        <Panel>
          <p className="text-[13px] text-slate-400 text-center py-4">
            Su firma ha sido registrada. Esperando la firma del ajustador...
          </p>
        </Panel>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Tab: Chat (interactivo)
// ═══════════════════════════════════════════════════════════════
function ChatPanel({ session }: { session: LiveSession }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const messages = session.inspection_chat_messages || [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendMutation = useMutation({
    mutationFn: async (msg: string) => {
      const res = await fetch("/api/inspection/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          message: msg,
          senderName: session.interviewed_name || "Cliente",
        }),
      });
      if (!res.ok) throw new Error("Error al enviar");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["magic-link-live", session.magic_link_token] });
      setMessage("");
    },
  });

  return (
    <div className="flex flex-col gap-2 h-full">
        <div className="flex-1 space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 220px)" }}>
          {messages.length === 0 ? (
            <p className="text-[12px] text-slate-500 text-center py-8">
              No hay mensajes aún. Puede escribir un mensaje al inspector.
            </p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender_role === "client" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-[13px] ${
                  msg.sender_role === "client" ? "bg-sky-600 text-white" : "bg-slate-800 text-slate-200"
                }`}>
                  <p className="text-[10px] opacity-70 mb-0.5">{msg.sender_name || "Inspector"}</p>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-[9px] opacity-50 mt-0.5">{fmtTime(msg.created_at)}</p>
                </div>
              </div>
            ))
          )}
          <div ref={chatEndRef} />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Escribir mensaje al inspector..."
            className="flex-1 rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-[13px] text-white placeholder:text-slate-600 outline-none focus:border-sky-500"
            onKeyDown={(e) => {
              if (e.key === "Enter" && message.trim()) {
                sendMutation.mutate(message.trim());
              }
            }}
            disabled={sendMutation.isPending}
          />
          <button
            type="button"
            className="rounded-lg bg-sky-600 px-3 py-2 text-white hover:bg-sky-500 transition-colors disabled:opacity-50"
            onClick={() => message.trim() && sendMutation.mutate(message.trim())}
            disabled={sendMutation.isPending || !message.trim()}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Componentes UI reutilizables
// ═══════════════════════════════════════════════════════════════
function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 sm:p-4">
      {title && (
        <h3 className="text-[11px] font-semibold text-slate-400 mb-2">{title}</h3>
      )}
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-300 mb-0.5">{label}</p>
      <p className={`text-[12px] font-medium ${mono ? "font-mono text-sky-400" : ""}`}>{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <Panel>
      <div className="text-center py-8">
        <Icon className="h-8 w-8 mx-auto text-slate-600 mb-2" />
        <p className="text-[13px] text-slate-400">{text}</p>
      </div>
    </Panel>
  );
}
