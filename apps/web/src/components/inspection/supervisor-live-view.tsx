"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  joinSignalingChannel,
  type SignalingMessage,
  type SignalingRole,
} from "@/lib/webrtc/signaling";
import { getInspectionSessionById, type SessionDetail } from "@/services/inspections";
import type { InspectionDamage } from "@/types";
import { formatUserDateTime as formatDateTime } from "@/lib/timezone";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Loader2,
  AlertTriangle,
  UserCheck,
  UserX,
  Eye,
  Clock,
  FileText,
  Camera,
  ShieldCheck,
  PenTool,
  MessageSquare,
  User,
  ArrowLeft,
} from "lucide-react";

interface SupervisorLiveViewProps {
  sessionId: string;
  userId: string;
  onLeave: () => void;
}

interface PeerInfo {
  userId: string;
  role: SignalingRole;
}

interface PreviewData {
  remoteThumb: string;
  localThumb: string;
  timestamp: number;
  inspectorVideoOn: boolean;
  inspectorAudioOn: boolean;
  peerConnected: boolean;
}

const SEVERITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  total: "Total",
};

const ACTA_STEP_LABELS: Record<string, string> = {
  datos: "Datos Generales",
  riesgo: "Riesgo Siniestrado",
  materialidad: "Materialidad",
  seguridad: "Seguridad",
  declaracion: "Declaración",
  terceros: "Terceros",
};

const TAB_LABELS: Record<string, string> = {
  resumen: "Resumen",
  acta: "Acta",
  danos: "Daños",
  evidencias: "Evidencias",
  croquis: "Croquis",
  firmas: "Firmas",
};

/**
 * Vista supervisora de una inspección remota en curso.
 *
 * Monitoreo completo: video + datos de la sesión + chat + progreso.
 * Sin cámara/micrófono. Read-only.
 */
export function SupervisorLiveView({ sessionId, userId, onLeave }: SupervisorLiveViewProps) {
  const channelRef = React.useRef<ReturnType<typeof joinSignalingChannel> | null>(null);
  const [peers, setPeers] = React.useState<PeerInfo[]>([]);
  const [preview, setPreview] = React.useState<PreviewData | null>(null);
  const [connected, setConnected] = React.useState(false);
  const [lastUpdate, setLastUpdate] = React.useState<number>(0);
  const [activeView, setActiveView] = React.useState<"overview" | "chat" | "evidences" | "damages" | "signatures">("overview");

  // Fetch de la sesión completa con poll cada 5s
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ["supervisor-session", sessionId],
    queryFn: () => getInspectionSessionById(sessionId),
    refetchInterval: 5000,
  });

  // Unirse al canal de signaling como supervisor
  React.useEffect(() => {
    const channel = joinSignalingChannel(sessionId, userId, "supervisor");
    channelRef.current = channel;

    const unsubMsg = channel.onMessage((msg: SignalingMessage) => {
      if (msg.type === "preview") {
        setPreview({
          remoteThumb: msg.remoteThumb,
          localThumb: msg.localThumb,
          timestamp: Date.now(),
          inspectorVideoOn: msg.inspectorVideoOn ?? true,
          inspectorAudioOn: msg.inspectorAudioOn ?? true,
          peerConnected: msg.peerConnected ?? false,
        });
        setLastUpdate(Date.now());
      }
      if (msg.type === "hangup" && msg.role === "inspector") {
        setPreview(null);
      }
    });

    const unsubPresence = channel.onPresence((newPeers) => {
      setPeers(newPeers);
      setConnected(newPeers.some((p) => p.role === "inspector"));
    });

    return () => {
      unsubMsg();
      unsubPresence();
      void channel.leave();
      channelRef.current = null;
    };
  }, [sessionId, userId]);

  // Detectar si el preview está stale
  const [isStale, setIsStale] = React.useState(false);
  React.useEffect(() => {
    if (!lastUpdate) return;
    const id = setInterval(() => {
      setIsStale(Date.now() - lastUpdate > 10000);
    }, 2000);
    return () => clearInterval(id);
  }, [lastUpdate]);

  // Reloj para tiempo transcurrido
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const kickPeer = (targetUserId: string) => {
    if (!channelRef.current) return;
    channelRef.current.send({
      type: "kick",
      from: userId,
      role: "supervisor",
      target: targetUserId,
      reason: "El supervisor ha finalizado tu conexión a la videollamada.",
    });
  };

  const inspectorPeer = peers.find((p) => p.role === "inspector");
  const clientPeers = peers.filter((p) => p.role === "client");
  const supervisorPeers = peers.filter((p) => p.role === "supervisor" && p.userId !== userId);

  const formatTime = (ts: number) => {
    const sec = Math.floor((now - ts) / 1000);
    if (sec < 60) return `hace ${sec}s`;
    return `hace ${Math.floor(sec / 60)}min`;
  };

  const elapsed = session?.started_at ? formatTime(new Date(session.started_at).getTime()) : "—";

  const evidences = session?.inspection_evidences || [];
  const damages = session?.inspection_damages || [];
  const signatures = session?.inspection_signatures || [];
  const chatMessages = session?.inspection_chat_messages || [];
  const sketches = session?.damage_sketches || [];
  const claim = session?.claim;
  const insured = claim?.claims_participants?.find((p) => p.type === "insured");
  const hasInsuredSig = signatures.some((s) => s.role === "insured");
  const hasAdjusterSig = signatures.some((s) => s.role === "adjuster");
  const photoCount = evidences.filter((e) => ["photo", "image", "jpg", "jpeg", "png"].includes((e.type || "").toLowerCase())).length;
  const docCount = evidences.length - photoCount;

  const navItems = [
    { id: "overview" as const, label: "Resumen", icon: Eye },
    { id: "chat" as const, label: `Chat${chatMessages.length > 0 ? ` (${chatMessages.length})` : ""}`, icon: MessageSquare },
    { id: "evidences" as const, label: `Evidencias${evidences.length > 0 ? ` (${evidences.length})` : ""}`, icon: Camera },
    { id: "damages" as const, label: `Daños${damages.length > 0 ? ` (${damages.length})` : ""}`, icon: ShieldCheck },
    { id: "signatures" as const, label: "Firmas", icon: PenTool },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/40 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Tooltip>
            <TooltipTrigger render={
              <button
                type="button"
                onClick={onLeave}
                className="btn-icon-sm shrink-0"
              />
            }>
              <ArrowLeft className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Volver</p>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="h-4 w-4 text-emerald-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-rose-500" />
            )}
            <span className="app-body font-medium text-white/90">
              {connected ? "Supervisión activa" : "Esperando inspector..."}
            </span>
          </div>
          {preview && !isStale && (
            <span className="flex items-center gap-1.5 app-body text-white/50">
              <Clock className="h-3 w-3" />
              {formatTime(lastUpdate)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="app-body text-white/40 flex items-center gap-1">
            <Eye className="h-3.5 w-3.5" />
            Modo supervisor
          </span>
        </div>
      </div>

      {/* Metadata bar */}
      {session && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-4 py-2.5 bg-black/20 border-b border-white/5">
          <span className="app-body text-white/90 font-medium">
            {claim?.liquidation_number || "—"}
          </span>
          {claim?.insurance_company?.name && (
            <span className="app-body text-white/50">{claim.insurance_company.name}</span>
          )}
          {insured && (
            <span className="app-body text-white/50 flex items-center gap-1">
              <User className="h-3 w-3" />
              {insured.full_name}
            </span>
          )}
          <span className="app-body text-white/50 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {elapsed}
          </span>
          <span className="app-body text-white/50 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Tab: {TAB_LABELS[session.active_tab || ""] || session.active_tab || "—"}
          </span>
          {session.active_tab === "acta" && session.acta_step && (
            <span className="app-body text-sky-400/80">
              · {ACTA_STEP_LABELS[session.acta_step] || session.acta_step}
            </span>
          )}
          <span className="app-body text-white/50 flex items-center gap-1">
            <Camera className="h-3 w-3" />
            {photoCount} fotos
          </span>
          <span className="app-body text-white/50 flex items-center gap-1">
            <ShieldCheck className="h-3 w-3" />
            {damages.length} daños
          </span>
          <span className="app-body text-white/50 flex items-center gap-1">
            <PenTool className="h-3 w-3" />
            {hasInsuredSig ? "Asegurado firmó" : "Asegurado sin firma"}
            {session.signature_waiver_reason && " (eximido)"}
          </span>
        </div>
      )}

      {/* Navigation tabs */}
      <div className="flex gap-1 px-4 py-2 bg-black/20 border-b border-white/5 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md app-body font-medium whitespace-nowrap transition-colors ${
                active ? "bg-sky-500/15 text-sky-400" : "text-white/40 hover:text-white/70 hover:bg-white/5"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {sessionLoading && !session ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-white/30" />
          </div>
        ) : !session ? (
          <div className="flex items-center justify-center h-full text-white/40">
            <p className="app-body">No se pudo cargar la sesión</p>
          </div>
        ) : activeView === "overview" ? (
          <OverviewPanel
            session={session}
            preview={preview}
            isStale={isStale}
            connected={connected}
            lastUpdate={lastUpdate}
            formatTime={formatTime}
            inspectorPeer={inspectorPeer}
            clientPeers={clientPeers}
            supervisorPeers={supervisorPeers}
            kickPeer={kickPeer}
            photoCount={photoCount}
            docCount={docCount}
            hasInsuredSig={hasInsuredSig}
            hasAdjusterSig={hasAdjusterSig}
          />
        ) : activeView === "chat" ? (
          <ChatPanel messages={chatMessages} />
        ) : activeView === "evidences" ? (
          <EvidencesPanel evidences={evidences} />
        ) : activeView === "damages" ? (
          <DamagesPanel damages={damages} />
        ) : activeView === "signatures" ? (
          <SignaturesPanel
            signatures={signatures}
            sketches={sketches}
            waiverReason={session.signature_waiver_reason}
          />
        ) : null}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Panel: Overview (video + metadata + peers)
// ═══════════════════════════════════════════════════════════════

function OverviewPanel({
  session,
  preview,
  isStale,
  connected,
  lastUpdate,
  formatTime,
  inspectorPeer,
  clientPeers,
  supervisorPeers,
  kickPeer,
  photoCount,
  docCount,
  hasInsuredSig,
  hasAdjusterSig,
}: {
  session: SessionDetail;
  preview: PreviewData | null;
  isStale: boolean;
  connected: boolean;
  lastUpdate: number;
  formatTime: (ts: number) => string;
  inspectorPeer?: PeerInfo;
  clientPeers: PeerInfo[];
  supervisorPeers: PeerInfo[];
  kickPeer: (userId: string) => void;
  photoCount: number;
  docCount: number;
  hasInsuredSig: boolean;
  hasAdjusterSig: boolean;
}) {
  const claim = session.claim;
  const insured = claim?.claims_participants?.find((p) => p.type === "insured");

  return (
    <div className="space-y-4">
      {/* Video previews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Video remoto (asegurado) */}
        <div className="flex flex-col gap-2">
          <span className="app-body text-white/60 font-medium flex items-center gap-1.5">
            <Video className="h-4 w-4 text-sky-400" />
            Cámara del asegurado
          </span>
          {connected && preview && !isStale && preview.remoteThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.remoteThumb} alt="Asegurado" className="w-full rounded-lg border border-zinc-700" />
          ) : connected && preview && !isStale && !preview.remoteThumb && preview.peerConnected ? (
            <div className="w-full aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <VideoOff className="h-8 w-8" />
              <span className="app-body text-xs">Asegurado sin video</span>
            </div>
          ) : connected && preview && !isStale && !preview.remoteThumb && !preview.peerConnected ? (
            <div className="w-full aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="app-body text-xs">Esperando asegurado...</span>
            </div>
          ) : connected && !preview ? (
            <div className="w-full aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="app-body text-xs">Esperando inspector...</span>
            </div>
          ) : (
            <div className="w-full aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <WifiOff className="h-6 w-6" />
              <span className="app-body text-xs">Inspector no conectado</span>
            </div>
          )}
        </div>

        {/* Video local (inspector) */}
        <div className="flex flex-col gap-2">
          <span className="app-body text-white/60 font-medium flex items-center gap-1.5">
            <Video className="h-4 w-4 text-violet-400" />
            Cámara del inspector
          </span>
          {connected && preview && !isStale && preview.localThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview.localThumb} alt="Inspector" className="w-full max-w-sm rounded-lg border border-zinc-700" />
          ) : connected && preview && !isStale && !preview.localThumb && preview.inspectorVideoOn ? (
            <div className="w-full max-w-sm aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="app-body text-xs">Cargando video...</span>
            </div>
          ) : connected && preview && !isStale && !preview.localThumb && !preview.inspectorVideoOn ? (
            <div className="w-full max-w-sm aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <VideoOff className="h-8 w-8" />
              <span className="app-body text-xs">Cámara apagada</span>
            </div>
          ) : connected && !preview ? (
            <div className="w-full max-w-sm aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="app-body text-xs">Esperando inspector...</span>
            </div>
          ) : (
            <div className="w-full max-w-sm aspect-video rounded-lg border border-zinc-800 bg-zinc-900 flex flex-col items-center justify-center gap-1 text-white/30">
              <VideoOff className="h-6 w-6" />
              <span className="app-body text-xs">Inspector no conectado</span>
            </div>
          )}
        </div>
      </div>

      {/* Estado de conexión del inspector */}
      {connected && preview && !isStale && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <span className="app-body text-white/50 text-xs font-medium">Estado inspector:</span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md app-body text-xs ${preview.inspectorVideoOn ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
            {preview.inspectorVideoOn ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
            {preview.inspectorVideoOn ? "Cámara on" : "Cámara off"}
          </span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md app-body text-xs ${preview.inspectorAudioOn ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
            {preview.inspectorAudioOn ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {preview.inspectorAudioOn ? "Mic on" : "Mic off"}
          </span>
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md app-body text-xs ${preview.peerConnected ? "bg-sky-500/15 text-sky-400" : "bg-amber-500/15 text-amber-400"}`}>
            {preview.peerConnected ? <UserCheck className="h-3 w-3" /> : <UserX className="h-3 w-3" />}
            {preview.peerConnected ? "Asegurado conectado" : "Sin asegurado"}
          </span>
        </div>
      )}

      {/* Stale warning */}
      {connected && preview && isStale && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <span className="app-body text-amber-300">
            Señal de video interrumpida. Última imagen: {formatTime(lastUpdate)}
          </span>
        </div>
      )}

      {/* Datos del siniestro */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-2">
        <h3 className="app-body font-medium text-white/80 mb-2">Datos del siniestro</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 app-body text-sm">
          <span className="text-white/40">Liquidación:</span>
          <span className="text-white/80">{claim?.liquidation_number || "—"}</span>
          <span className="text-white/40">Siniestro:</span>
          <span className="text-white/80">{claim?.claim_number || "—"}</span>
          <span className="text-white/40">Compañía:</span>
          <span className="text-white/80">{claim?.insurance_company?.name || "—"}</span>
          <span className="text-white/40">Causa:</span>
          <span className="text-white/80">{claim?.claim_cause?.name || "—"}</span>
          <span className="text-white/40">Asegurado:</span>
          <span className="text-white/80">{insured?.full_name || "—"}</span>
          <span className="text-white/40">Teléfono:</span>
          <span className="text-white/80">{insured?.cell_phone || insured?.phone || "—"}</span>
          <span className="text-white/40">Dirección:</span>
          <span className="text-white/80">{claim?.claim_address || "—"}</span>
          <span className="text-white/40">Inicio:</span>
          <span className="text-white/80">{session.started_at ? formatDateTime(session.started_at) : "—"}</span>
          <span className="text-white/40">Geo:</span>
          <span className="text-white/80">
            {session.geo_captured_at ? `Capturada (${session.geo_distance_meters ?? "—"}m)` : "Sin capturar"}
          </span>
        </div>
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <p className="app-body text-2xl font-bold text-white/80">{photoCount}</p>
          <p className="app-body text-white/40 text-xs">Fotos</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <p className="app-body text-2xl font-bold text-white/80">{docCount}</p>
          <p className="app-body text-white/40 text-xs">Documentos</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <p className="app-body text-2xl font-bold text-white/80">{session.inspection_damages?.length || 0}</p>
          <p className="app-body text-white/40 text-xs">Daños</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-3 text-center">
          <p className="app-body text-2xl font-bold text-white/80">{session.damage_sketches?.length || 0}</p>
          <p className="app-body text-white/40 text-xs">Croquis</p>
        </div>
      </div>

      {/* Estado de firmas */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <h3 className="app-body font-medium text-white/80 mb-3">Estado de firmas</h3>
        <div className="flex flex-wrap gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${hasInsuredSig ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
            {hasInsuredSig ? <UserCheck className="h-4 w-4 text-emerald-400" /> : <UserX className="h-4 w-4 text-white/30" />}
            <span className="app-body text-white/70">Asegurado {hasInsuredSig ? "firmó" : "sin firma"}</span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${hasAdjusterSig ? "border-emerald-500/30 bg-emerald-500/10" : "border-white/10 bg-white/5"}`}>
            {hasAdjusterSig ? <UserCheck className="h-4 w-4 text-emerald-400" /> : <UserX className="h-4 w-4 text-white/30" />}
            <span className="app-body text-white/70">Ajustador {hasAdjusterSig ? "firmó" : "sin firma"}</span>
          </div>
          {session.signature_waiver_reason && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-amber-500/30 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              <span className="app-body text-amber-300">Eximido: {session.signature_waiver_reason}</span>
            </div>
          )}
        </div>
      </div>

      {/* Peers conectados */}
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <h3 className="app-body font-medium text-white/80 mb-3 flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-emerald-400" />
          Participantes conectados
        </h3>
        <div className="flex flex-wrap gap-2">
          {inspectorPeer && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-500/10 border border-violet-500/30">
              <span className="h-2 w-2 rounded-full bg-violet-400" />
              <span className="app-body text-white/70">Inspector</span>
            </div>
          )}
          {clientPeers.map((p) => (
            <div key={p.userId} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-sky-500/10 border border-sky-500/30">
              <span className="h-2 w-2 rounded-full bg-sky-400" />
              <span className="app-body text-white/70">Asegurado</span>
              <Tooltip>
                <TooltipTrigger render={
                  <button
                    type="button"
                    onClick={() => kickPeer(p.userId)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-600/80 hover:bg-rose-600 text-white app-body text-xs transition-colors"
                  />
                }>
                  <UserX className="h-3 w-3" />
                  Desconectar
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Desconectar a este asegurado</p>
                </TooltipContent>
              </Tooltip>
            </div>
          ))}
          {supervisorPeers.map((p) => (
            <div key={p.userId} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <span className="app-body text-white/70">Otro supervisor</span>
            </div>
          ))}
          {!inspectorPeer && clientPeers.length === 0 && supervisorPeers.length === 0 && (
            <span className="app-body text-white/30">Sin participantes conectados</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Panel: Chat (read-only)
// ═══════════════════════════════════════════════════════════════

function ChatPanel({ messages }: { messages: { id: string; content: string; sender_name: string; sender_role: string; created_at: string }[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/30">
        <p className="app-body">Sin mensajes en el chat</p>
      </div>
    );
  }
  return (
    <div className="space-y-2 max-w-2xl">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col gap-1 rounded-lg p-3 ${
            msg.sender_role === "inspector" || msg.sender_role === "adjuster"
              ? "bg-violet-500/5 border border-violet-500/15"
              : "bg-sky-500/5 border border-sky-500/15"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="app-body font-medium text-white/70 text-xs">
              {msg.sender_name || msg.sender_role}
            </span>
            <span className="app-body text-white/30 text-xs">
              {formatDateTime(msg.created_at)}
            </span>
          </div>
          <p className="app-body text-white/80 text-sm whitespace-pre-wrap">{msg.content}</p>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Panel: Evidencias (read-only)
// ═══════════════════════════════════════════════════════════════

function EvidencesPanel({ evidences }: { evidences: { id: string; url: string; type: string; description: string | null; metadata?: Record<string, unknown> | null; created_at: string }[] }) {
  if (evidences.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/30">
        <p className="app-body">Sin evidencias</p>
      </div>
    );
  }
  const isPhoto = (t: string) => ["photo", "image", "jpg", "jpeg", "png"].includes(t.toLowerCase());
  const photos = evidences.filter((e) => isPhoto(e.type));
  const others = evidences.filter((e) => !isPhoto(e.type));

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div>
          <h3 className="app-body font-medium text-white/60 mb-2">Fotos ({photos.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {photos.map((ev, idx) => (
              <div key={ev.id} className="rounded-lg border border-white/10 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ev.url} alt={`Foto ${idx + 1}`} className="w-full h-32 object-cover" />
                <div className="p-2">
                  <p className="app-body text-white/50 text-xs truncate">
                    Foto {idx + 1}{ev.description ? ` — ${ev.description}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div>
          <h3 className="app-body font-medium text-white/60 mb-2">Otros ({others.length})</h3>
          <div className="space-y-2">
            {others.map((ev, idx) => (
              <div key={ev.id} className="rounded-lg border border-white/10 bg-black/30 p-3 flex items-center gap-3">
                <FileText className="h-5 w-5 text-white/40 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="app-body text-white/70 text-sm truncate">
                    {(ev.metadata?.originalName as string) || `Evidencia ${idx + 1}`}
                  </p>
                  <p className="app-body text-white/40 text-xs">{ev.type} · {formatDateTime(ev.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Panel: Daños (read-only)
// ═══════════════════════════════════════════════════════════════

function DamagesPanel({ damages }: { damages: InspectionDamage[] }) {
  if (damages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-white/30">
        <p className="app-body">Sin daños registrados</p>
      </div>
    );
  }

  const fmtQty = (quantity: number | null, length: number | null, width: number | null, height: number | null, unit: string | null) => {
    if (quantity === null || quantity === undefined || quantity === 0) return "—";
    const dim =
      unit === "M2" && (length || width)
        ? ` (${length || 0}x${width || 0})`
        : unit === "M3" && (length || width || height)
        ? ` (${length || 0}x${width || 0}x${height || 0})`
        : "";
    return `${quantity.toLocaleString("es-CL")} ${unit || ""}${dim}`;
  };

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left py-2 px-3 app-body text-white/40 font-medium">Dependencia</th>
            <th className="text-left py-2 px-3 app-body text-white/40 font-medium">Descripción</th>
            <th className="text-left py-2 px-3 app-body text-white/40 font-medium">Superficie / Daño</th>
            <th className="text-left py-2 px-3 app-body text-white/40 font-medium">Severidad</th>
            <th className="text-left py-2 px-3 app-body text-white/40 font-medium">Tipo</th>
            <th className="text-left py-2 px-3 app-body text-white/40 font-medium">Monto</th>
          </tr>
        </thead>
        <tbody>
          {damages.map((d) => (
            <tr key={d.id} className="border-b border-white/5">
              <td className="py-2 px-3 app-body text-white/70">{d.dependency || "—"}</td>
              <td className="py-2 px-3 app-body text-white/70">{d.description || "—"}</td>
              <td className="py-2 px-3 app-body text-white/70 text-[10px] leading-tight">
                Sup: {fmtQty(d.quantity, d.length, d.width, d.height, d.unit)} / Daño: {fmtQty(d.damage_quantity, d.damage_length, d.damage_width, d.damage_height, d.unit)}
              </td>
              <td className="py-2 px-3 app-body text-white/70">{SEVERITY_LABELS[d.severity] || d.severity}</td>
              <td className="py-2 px-3 app-body text-white/70">{d.damage_type === "content" ? "Contenido" : "Inmueble"}</td>
              <td className="py-2 px-3 app-body text-white/70">
                {d.estimated_amount != null ? `${d.estimated_amount.toLocaleString("es-CL")} ${d.currency || ""}` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Panel: Firmas (read-only)
// ═══════════════════════════════════════════════════════════════

function SignaturesPanel({
  signatures,
  sketches,
  waiverReason,
}: {
  signatures: { id: string; role: string; signature_url: string; signed_at: string }[];
  sketches: { id: string; sketch_url: string; label: string | null; created_at: string }[];
  waiverReason?: string | null;
}) {
  const insuredSig = signatures.find((s) => s.role === "insured");
  const adjusterSig = signatures.find((s) => s.role === "adjuster");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="app-body font-medium text-white/60 mb-3">Firmas</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <p className="app-body text-white/50 mb-2">Asegurado</p>
            {insuredSig ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={insuredSig.signature_url} alt="Firma asegurado" className="w-full h-20 object-contain bg-white rounded" />
                <p className="app-body text-white/40 text-xs mt-1">{formatDateTime(insuredSig.signed_at)}</p>
              </>
            ) : waiverReason ? (
              <div className="flex items-center gap-2 text-amber-400/80 py-4">
                <AlertTriangle className="h-4 w-4" />
                <span className="app-body text-sm">No firmó: {waiverReason}</span>
              </div>
            ) : (
              <p className="app-body text-white/30 py-4">Sin firma</p>
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-black/30 p-4">
            <p className="app-body text-white/50 mb-2">Ajustador</p>
            {adjusterSig ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={adjusterSig.signature_url} alt="Firma ajustador" className="w-full h-20 object-contain bg-white rounded" />
                <p className="app-body text-white/40 text-xs mt-1">{formatDateTime(adjusterSig.signed_at)}</p>
              </>
            ) : (
              <p className="app-body text-white/30 py-4">Sin firma</p>
            )}
          </div>
        </div>
      </div>

      {sketches.length > 0 && (
        <div>
          <h3 className="app-body font-medium text-white/60 mb-3">Croquis ({sketches.length})</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {sketches.map((sk, idx) => (
              <div key={sk.id} className="rounded-lg border border-white/10 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sk.sketch_url} alt={`Croquis ${idx + 1}`} className="w-full h-32 object-contain bg-white/5" />
                <p className="app-body text-white/40 text-xs p-2 truncate">
                  Croquis {idx + 1}{sk.label ? ` — ${sk.label}` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
