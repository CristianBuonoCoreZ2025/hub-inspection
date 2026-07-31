"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActiveRemoteSessions } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import { SupervisorLiveView } from "@/components/inspection/supervisor-live-view";
import {
  Eye,
  Video,
  Loader2,
  ArrowLeft,
  Radio,
  MapPin,
  User,
  Clock,
  Camera,
  ShieldCheck,
  PenTool,
  FileText,
} from "lucide-react";

const TAB_LABELS: Record<string, string> = {
  resumen: "Resumen",
  acta: "Acta",
  danos: "Daños",
  evidencias: "Evidencias",
  croquis: "Croquis",
  firmas: "Firmas",
};

function ElapsedTime({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return <span>—</span>;
  const sec = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return <span>{h}h {m}m</span>;
  if (m > 0) return <span>{m}m {s}s</span>;
  return <span>{s}s</span>;
}

export default function SupervisionPage() {
  const { profile } = useAuth();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["active-remote-sessions"],
    queryFn: () => getActiveRemoteSessions(),
    refetchInterval: selectedSessionId ? false : 5000,
  });

  // Solo usuarios con rol internal pueden acceder
  if (profile && profile.role !== "internal") {
    return (
      <div className="app-panel max-w-2xl mx-auto mt-20">
        <div className="p-8 text-center">
          <h2 className="app-section-title mb-2">Acceso restringido</h2>
          <p className="app-body text-muted-foreground">
            Esta pantalla es exclusiva para usuarios con perfil interno.
          </p>
        </div>
      </div>
    );
  }

  // Vista de supervisión en vivo
  if (selectedSessionId && profile?.id) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button
            type="button"
            onClick={() => setSelectedSessionId(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted hover:bg-muted/80 text-sm transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la lista
          </button>
          <h1 className="app-page-title">Supervisión en vivo</h1>
        </div>
        <div className="flex-1 p-4 min-h-0">
          <SupervisorLiveView
            sessionId={selectedSessionId}
            userId={profile.id}
            onLeave={() => setSelectedSessionId(null)}
          />
        </div>
      </div>
    );
  }

  // Lista de inspecciones remotas activas
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Radio className="h-6 w-6 text-emerald-500" />
        <div>
          <h1 className="app-page-title">Supervisión de inspecciones</h1>
          <p className="app-body text-muted-foreground mt-1">
            Inspecciones remotas en curso. Entre a supervisar sin activar cámara ni micrófono.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!sessions || sessions.length === 0) && (
        <div className="app-panel">
          <div className="p-12 text-center">
            <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="app-section-title mb-2">No hay inspecciones activas</h2>
            <p className="app-body text-muted-foreground">
              No hay inspecciones remotas en curso en este momento.
            </p>
          </div>
        </div>
      )}

      {!isLoading && sessions && sessions.length > 0 && (
        <div className="grid gap-3">
          {sessions.map((session) => {
            const claim = session.claim;
            const insured = claim?.claims_participants?.find((p) => p.type === "insured");
            const photoCount = (session.inspection_evidences || []).filter((e: { type: string }) => ["photo", "image", "jpg", "jpeg", "png"].includes((e.type || "").toLowerCase())).length;
            const totalCount = (session.inspection_evidences || []).length;
            const damageCount = (session.inspection_damages || []).length;
            const sigCount = (session.inspection_signatures || []).length;
            const hasWaiver = !!session.signature_waiver_reason;
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className="app-panel text-left hover:ring-2 hover:ring-emerald-500/40 transition-all cursor-pointer"
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Indicador en vivo */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                      <span className="app-body font-medium text-emerald-600">EN VIVO</span>
                    </div>

                    {/* Datos del siniestro */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="app-body font-medium truncate">
                          {claim?.liquidation_number || "—"}
                        </span>
                        {claim?.insurance_company?.name && (
                          <span className="app-body text-muted-foreground truncate">
                            · {claim.insurance_company.name}
                          </span>
                        )}
                        {claim?.claim_cause?.name && (
                          <span className="app-body text-muted-foreground truncate">
                            · {claim.claim_cause.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 app-body text-muted-foreground text-sm flex-wrap">
                        {insured && (
                          <span className="flex items-center gap-1 truncate">
                            <User className="h-3 w-3 shrink-0" />
                            {insured.full_name}
                          </span>
                        )}
                        {claim?.claim_address && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {claim.claim_address}
                          </span>
                        )}
                        {session.started_at && (
                          <span className="flex items-center gap-1 shrink-0">
                            <Clock className="h-3 w-3" />
                            <ElapsedTime startedAt={session.started_at} />
                          </span>
                        )}
                        {session.active_tab && (
                          <span className="flex items-center gap-1 shrink-0">
                            <FileText className="h-3 w-3" />
                            {TAB_LABELS[session.active_tab] || session.active_tab}
                          </span>
                        )}
                      </div>
                      {/* Contadores rápidos */}
                      <div className="flex items-center gap-3 mt-1.5 app-body text-muted-foreground text-xs">
                        <span className="flex items-center gap-1">
                          <Camera className="h-3 w-3" />
                          {photoCount} fotos
                        </span>
                        {totalCount > photoCount && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {totalCount - photoCount} docs
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          {damageCount} daños
                        </span>
                        <span className="flex items-center gap-1">
                          <PenTool className="h-3 w-3" />
                          {sigCount}/2 firmas
                          {hasWaiver && " (eximido)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Botón supervisar */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-600 app-body font-medium">
                      <Eye className="h-4 w-4" />
                      Supervisar
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
