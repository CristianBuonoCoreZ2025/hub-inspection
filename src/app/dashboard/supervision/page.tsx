"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getActiveRemoteSessions, liftInspectionLock, restoreInspectionLock } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { SupervisorLiveView } from "@/components/inspection/supervisor-live-view";
import {
  Eye,
  Video,
  Unlock,
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
  Search,
  Lock,
  HardHat,
} from "lucide-react";
import { useFlash } from "@/components/ui/alert-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const TAB_LABELS: Record<string, string> = {
  resumen: "Resumen",
  acta: "Acta",
  danos: "Daños",
  evidencias: "Evidencias",
  croquis: "Croquis",
  firmas: "Firmas",
};

/**
 * Badge de tiempo transcurrido con colores según duración:
 * - < 12h: verde
 * - 12h–24h: amarillo con texto naranja
 * - 24h–36h: naranja con texto amarillo
 * - > 36h: rojo
 * - > 48h: rojo + signo de exclamación
 */
function ElapsedBadge({ startedAt }: { startedAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!startedAt) return null;
  const sec = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  const hours = sec / 3600;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const timeText = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  let classes: string;
  let showAlert = false;
  if (hours < 12) {
    classes = "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  } else if (hours < 24) {
    classes = "bg-amber-100 text-orange-600 dark:bg-amber-900/30 dark:text-orange-400";
  } else if (hours < 36) {
    classes = "bg-orange-100 text-yellow-600 dark:bg-orange-900/30 dark:text-yellow-400";
  } else {
    classes = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    showAlert = hours >= 48;
  }

  return (
    <span className="flex items-center gap-1 shrink-0 ml-2">
      <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${classes}`}>
        <Clock className="h-3 w-3" />
        {timeText}
      </span>
      {showAlert && (
        <Tooltip>
          <TooltipTrigger className="shrink-0">
            <span className="text-sm leading-none">⚠️</span>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Inspección con más de 48 horas abierta</p>
          </TooltipContent>
        </Tooltip>
      )}
    </span>
  );
}

export default function SupervisionPage() {
  const { profile, dataAccess } = useAuth();
  const { can } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();
  const flash = useFlash();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [inspectionType, setInspectionType] = useState<"remote" | "onsite" | "all">("all");
  const [search, setSearch] = useState("");
  const [inspectorFilter, setInspectorFilter] = useState<string[]>([]);
  const canViewSupervision = can("supervision", "view");
  const canLift = dataAccess?.is_admin;

  const liftMutation = useMutation({
    mutationFn: (sessionId: string) => liftInspectionLock(sessionId, profile!.id),
    onSuccess: () => {
      flash({ title: "Desbloqueada", description: "Inspección desbloqueada", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["active-remote-sessions", inspectionType] });
    },
    onError: (err: Error) => flash({ title: "Error", description: err.message, type: "error", duration: 4000 }),
  });

  const restoreMutation = useMutation({
    mutationFn: (sessionId: string) => restoreInspectionLock(sessionId),
    onSuccess: () => {
      flash({ title: "Bloqueada", description: "Inspección bloqueada", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["active-remote-sessions", inspectionType] });
    },
    onError: (err: Error) => flash({ title: "Error", description: err.message, type: "error", duration: 4000 }),
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["active-remote-sessions", inspectionType],
    queryFn: () => getActiveRemoteSessions(inspectionType === "all" ? undefined : inspectionType),
    refetchInterval: selectedSessionId ? false : 5000,
  });

  // Opciones de inspector construidas desde las sesiones cargadas (no query extra)
  const inspectorOptions = useMemo(() => {
    const map = new Map<string, string>();
    (sessions || []).forEach((s) => {
      if (s.inspector?.id && s.inspector?.full_name) {
        map.set(s.inspector.id, s.inspector.full_name);
      }
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sessions]);

  // Filtro client-side por búsqueda + inspector
  const filteredSessions = (sessions || []).filter((s) => {
    if (inspectorFilter.length > 0 && (!s.inspector?.id || !inspectorFilter.includes(s.inspector.id))) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    const liq = s.claim?.liquidation_number?.toLowerCase() || "";
    const insured = s.claim?.claims_participants?.find((p) => p.type === "insured")?.full_name?.toLowerCase() || "";
    const inspector = s.inspector?.full_name?.toLowerCase() || "";
    return liq.includes(q) || insured.includes(q) || inspector.includes(q);
  });

  // Solo usuarios con permiso de supervisión pueden acceder
  if (profile && !canViewSupervision) {
    return (
      <div className="app-panel max-w-2xl mx-auto mt-20">
        <div className="p-8 text-center">
          <h2 className="app-section-title mb-2">Acceso restringido</h2>
          <p className="app-body text-muted-foreground">
            No tienes permiso para acceder a la pantalla de supervisión.
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
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-emerald">
            <Radio />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Supervisión de inspecciones</h1>
          </div>
        </div>
      </div>
      <p className="app-body text-muted-foreground mt-1">
            Inspecciones en curso. Entre a supervisar sin activar cámara ni micrófono.
          </p>

      {/* Toolbar: buscador + filtro de tipo (mismo patrón que siniestros) */}
      <div className="app-grid-toolbar mt-4">
        <div className="app-grid-toolbar-left">
          <div className="app-grid-search-wrap">
            <Search />
            <Input
              placeholder="Buscar liquidación, asegurado o inspector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="liquid-search"
            />
          </div>
          <Select value={inspectionType} onValueChange={(v) => setInspectionType(v as "remote" | "onsite" | "all")}>
            <SelectTrigger className="app-input app-filter-narrow">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="remote">Remotas</SelectItem>
              <SelectItem value="onsite">Presenciales</SelectItem>
            </SelectContent>
          </Select>
          <Select
            multiple
            value={inspectorFilter}
            onValueChange={(v: string[]) => setInspectorFilter(v ?? [])}
            items={inspectorOptions}
          >
            <SelectTrigger className="app-input app-filter-narrow">
              <SelectValue placeholder="Inspector" />
            </SelectTrigger>
            <SelectContent>
              {inspectorOptions.map((c: { value: string; label: string }) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && (!filteredSessions || filteredSessions.length === 0) && (
        <div className="app-panel">
          <div className="p-12 text-center">
            <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground/40" />
            <h2 className="app-section-title mb-2">No hay inspecciones activas</h2>
            <p className="app-body text-muted-foreground">
              {search ? "No se encontraron resultados para la búsqueda." : "No hay inspecciones en curso en este momento."}
            </p>
          </div>
        </div>
      )}

      {!isLoading && filteredSessions && filteredSessions.length > 0 && (
        <div className="grid gap-3 mt-4">
          {filteredSessions.map((session) => {
            const claim = session.claim;
            const insured = claim?.claims_participants?.find((p) => p.type === "insured");
            const photoCount = (session.inspection_evidences || []).filter((e: { type: string }) => ["photo", "image", "jpg", "jpeg", "png"].includes((e.type || "").toLowerCase())).length;
            const totalCount = (session.inspection_evidences || []).length;
            const damageCount = (session.inspection_damages || []).length;
            const sigCount = (session.inspection_signatures || []).length;
            const hasWaiver = !!session.signature_waiver_reason;
            return (
              <div
                key={session.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedSessionId(session.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setSelectedSessionId(session.id); }}
                className="app-panel p-0! text-left hover:ring-2 hover:ring-emerald-500/40 transition-all cursor-pointer overflow-hidden"
              >
                <div className="px-3 py-1.5 flex items-center gap-2.5">
                  {/* Indicador en vivo + tipo */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-medium text-emerald-600">EN VIVO</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${session.inspection_type === "remote" ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"}`}>
                      {session.inspection_type === "remote" ? "Remota" : "Presencial"}
                    </span>
                  </div>

                  {/* Líquidación */}
                  <span className="text-[11px] font-medium shrink-0">
                    {claim?.liquidation_number || "—"}
                  </span>

                  {/* Compañía */}
                  {claim?.insurance_company?.name && (
                    <span className="text-[11px] text-muted-foreground truncate">
                      · {claim.insurance_company.name}
                    </span>
                  )}

                  {/* Asegurado */}
                  {insured && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                      <User className="h-3 w-3 shrink-0 text-sky-500" />
                      {insured.full_name}
                    </span>
                  )}

                  {/* Dirección */}
                  {claim?.claim_address && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                      <MapPin className="h-3 w-3 shrink-0 text-rose-500" />
                      {claim.claim_address}
                    </span>
                  )}

                  {/* Pestaña activa */}
                  {session.active_tab && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <FileText className="h-3 w-3 text-indigo-500" />
                      {TAB_LABELS[session.active_tab] || session.active_tab}
                    </span>
                  )}

                  {/* Contadores */}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                    <Camera className="h-3 w-3 text-violet-500" />
                    {photoCount}
                  </span>
                  {totalCount > photoCount && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <FileText className="h-3 w-3 text-teal-500" />
                      {totalCount - photoCount}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                    <ShieldCheck className="h-3 w-3 text-emerald-500" />
                    {damageCount}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                    <PenTool className="h-3 w-3 text-fuchsia-500" />
                    {sigCount}/2{hasWaiver && " (exim.)"}
                  </span>

                  {/* Inspector */}
                  {session.inspector?.full_name && (
                    <Tooltip>
                      <TooltipTrigger className="shrink-0">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <HardHat className="h-3 w-3 text-cyan-600" />
                          {session.inspector.full_name}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <p>Inspector</p>
                      </TooltipContent>
                    </Tooltip>
                  )}

                  {/* Tiempo transcurrido — badge destacado entre inspector y controles */}
                  <ElapsedBadge startedAt={session.started_at} />

                  {/* Controles */}
                  <div className="app-row-actions flex items-center gap-1.5 shrink-0 ml-auto">
                    {session.lock_overridden_by ? (
                      <>
                        <Tooltip>
                          <TooltipTrigger render={
                            <button
                              type="button"
                              className="btn-icon-sm"
                              onClick={(e) => { e.stopPropagation(); router.push(`/dashboard/inspecciones/${session.id}`); }}
                            />
                          }>
                            <Eye className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Entrar a la inspección</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger render={
                            <button
                              type="button"
                              className="btn-icon-sm"
                              onClick={(e) => { e.stopPropagation(); restoreMutation.mutate(session.id); }}
                              disabled={!canLift || (restoreMutation.variables === session.id && restoreMutation.isPending)}
                            />
                          }>
                            <Lock className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{canLift ? "Bloquear inspección" : "Solo un administrador puede bloquear la inspección"}</p>
                          </TooltipContent>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger render={
                          <button
                            type="button"
                            className="btn-icon-sm"
                            onClick={(e) => { e.stopPropagation(); liftMutation.mutate(session.id); }}
                            disabled={!canLift || (liftMutation.variables === session.id && liftMutation.isPending)}
                          />
                        }>
                          <Unlock className="h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>{canLift ? "Desbloquear inspección" : "Solo un administrador puede desbloquear la inspección"}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
