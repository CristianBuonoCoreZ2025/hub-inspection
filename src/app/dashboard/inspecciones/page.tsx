"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInspectionSessions,
  createInspectionSession,
  updateInspectionSession,
  getInspectorSchedule,
} from "@/services/inspections";
import { getClaims, getClaimsParticipants } from "@/services/claims";
import { getUsers } from "@/services/users";
import { toast } from "sonner";
import {
  ClipboardCheck,
  Search,
  Plus,
  Calendar,
  Play,
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  CalendarClock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import type { InspectionSession } from "@/types";

const sessionStatusLabels: Record<string, string> = {
  scheduled: "Agendada",
  active: "En progreso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const sessionStatusColors: Record<string, string> = {
  scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300",
  active: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200",
  completed: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
  cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function InspectionsPage() {
  return (
    <Suspense fallback={<div className="app-page"><p className="text-muted-foreground py-20 text-center">Cargando...</p></div>}>
      <InspectionsPageContent />
    </Suspense>
  );
}

function InspectionsPageContent() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string>("");
  const [inspectionType, setInspectionType] = useState<"onsite" | "remote">("onsite");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [selectedInspectorId, setSelectedInspectorId] = useState<string>("");

  // Pre-seleccionar siniestro si viene por query param ?claim=...
  useEffect(() => {
    const claimFromUrl = searchParams.get("claim");
    if (claimFromUrl) {
      setSelectedClaimId(claimFromUrl);
      setOpenCreate(true);
    }
  }, [searchParams]);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions"],
    queryFn: () => getInspectionSessions(),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });
  const inspectors = users?.filter((u) => u.role === "inspector") || [];

  // Query: agenda del inspector para la fecha seleccionada
  const selectedDateForQuery = scheduledDate ? new Date(`${scheduledDate}T00:00:00`) : null;
  const { data: inspectorSchedule, isLoading: scheduleLoading } = useQuery({
    queryKey: ["inspector-schedule", selectedInspectorId, scheduledDate],
    queryFn: () => {
      if (!selectedDateForQuery) return [];
      const start = new Date(selectedDateForQuery);
      const end = new Date(selectedDateForQuery);
      end.setDate(end.getDate() + 1);
      return getInspectorSchedule(
        selectedInspectorId,
        start.toISOString(),
        end.toISOString(),
      );
    },
    enabled: !!selectedInspectorId && !!scheduledDate && openCreate,
  });

  const { data: rawClaims } = useQuery({
    queryKey: ["claims"],
    queryFn: () => getClaims(),
    enabled: openCreate,
  });

  const claimIds = rawClaims?.map((c) => c.id) ?? [];
  const { data: participants } = useQuery({
    queryKey: ["claims-participants", claimIds],
    queryFn: () => getClaimsParticipants(claimIds),
    enabled: openCreate && claimIds.length > 0,
  });

  const claims = rawClaims?.map((claim) => ({
    ...claim,
    claims_participants: participants?.filter((p) => p.claim_id === claim.id) ?? [],
  }));

  // Pre-seleccionar el inspector que ya viene asignado en el siniestro
  useEffect(() => {
    if (selectedClaimId && claims) {
      const claim = claims.find((c) => c.id === selectedClaimId);
      if (claim?.inspector_id) {
        setSelectedInspectorId(claim.inspector_id);
      } else {
        setSelectedInspectorId("");
      }
    }
  }, [selectedClaimId, claims]);

  // Siniestro seleccionado (para mostrar contacto)
  const selectedClaim = claims?.find((c) => c.id === selectedClaimId);
  const insuredParticipant = selectedClaim?.claims_participants?.find((p: any) => p.type === "insured");
  const contactParticipant = selectedClaim?.claims_participants?.find((p: any) => p.type === "contact");

  // Generar slots disponibles según tipo de inspección
  // Presencial: 2 horas por slot. Remota: 30 minutos por slot.
  // Horario laboral: 9:00 a 18:00. Almuerzo: 13:00-14:00 (no se agenda).
  const SLOT_DURATION_MIN = inspectionType === "onsite" ? 120 : 30;
  const WORK_START = 9;  // 9:00
  const WORK_END = 18;   // 18:00
  const LUNCH_START = 13; // 13:00
  const LUNCH_END = 14;   // 14:00

  const generateTimeSlots = () => {
    const slots: { time: string; label: string; available: boolean; bookedInfo?: string }[] = [];
    const totalMin = (WORK_END - WORK_START) * 60;
    for (let offset = 0; offset + SLOT_DURATION_MIN <= totalMin; offset += SLOT_DURATION_MIN) {
      const startHour = WORK_START + Math.floor(offset / 60);
      const startMin = offset % 60;
      const endHour = WORK_START + Math.floor((offset + SLOT_DURATION_MIN) / 60);
      const endMin = (offset + SLOT_DURATION_MIN) % 60;
      const timeStr = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
      const endStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

      // Saltar slots que cruzan el almuerzo
      if (startHour < LUNCH_START && endHour > LUNCH_START) continue;
      if (startHour >= LUNCH_START && startHour < LUNCH_END) continue;

      // Verificar si está ocupado
      const slotStart = new Date(`${scheduledDate}T${timeStr}:00`);
      const slotEnd = new Date(`${scheduledDate}T${endStr}:00`);
      const booked = inspectorSchedule?.find((s) => {
        const sStart = new Date(s.scheduled_at);
        const sDuration = s.inspection_type === "onsite" ? 120 : 30;
        const sEnd = new Date(sStart.getTime() + sDuration * 60000);
        // Solapamiento
        return sStart < slotEnd && sEnd > slotStart;
      });

      slots.push({
        time: timeStr,
        label: `${timeStr} - ${endStr}`,
        available: !booked,
        bookedInfo: booked ? `${booked.claim.claim_number} · ${booked.claim.claims_participants?.[0]?.full_name || ""}` : undefined,
      });
    }
    return slots;
  };

  const timeSlots = scheduledDate && selectedInspectorId ? generateTimeSlots() : [];

  const createMutation = useMutation({
    mutationFn: (claimId: string) => {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`).toISOString();
      return createInspectionSession(claimId, {
        inspectionType,
        scheduledAt,
        inspectorId: selectedInspectorId || undefined,
      });
    },
    onSuccess: (data) => {
      toast.success("Inspección agendada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      setOpenCreate(false);
      setSelectedClaimId("");
      setSelectedInspectorId("");
      setScheduledDate("");
      setScheduledTime("");
      setInspectionType("onsite");
      // Navegar al detalle de la inspección creada
      if (data?.id) {
        router.push(`/dashboard/inspecciones/${data.id}`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<InspectionSession> }) =>
      updateInspectionSession(id, input),
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = sessions?.filter((s) => {
    const insuredName = s.claim?.claims_participants?.[0]?.full_name;
    const matchesSearch =
      [s.claim?.claim_number, insuredName, s.claim?.claim_address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      sessionStatusLabels[s.status]?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Siniestros disponibles: los que NO tienen inspección agendada o activa
  // (completadas y canceladas no bloquean crear una nueva)
  const availableClaims = claims?.filter(
    (c) => !sessions?.some((s) =>
      s.claim_id === c.id &&
      (s.status === "scheduled" || s.status === "active")
    )
  );

  return (
    <div className="app-page">
      <header className="app-page-header">
        <h1 className="app-page-title">Inspecciones</h1>
        <p className="app-page-lead">
          Gestiona las sesiones de inspeccion en terreno asociadas a los siniestros.
        </p>
      </header>

      <div className="app-toolbar">
        <div className="flex items-center gap-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar inspeccion..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="h-9 w-full sm:w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Sin selección</SelectItem>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="scheduled">Agendada</SelectItem>
              <SelectItem value="active">En progreso</SelectItem>
              <SelectItem value="completed">Completada</SelectItem>
              <SelectItem value="cancelled">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() => {
            setOpenCreate(true);
            setSelectedClaimId("");
          }}
          className="btn-create btn-sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          Nueva
        </Button>
      </div>

      {/* Tabla de Inspecciones */}
      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="min-w-[140px] sm:w-[170px]">Inspección</th>
              <th className="min-w-[100px] sm:w-[140px]">Siniestro</th>
              <th className="min-w-[120px] sm:w-[200px]">Asegurado</th>
              <th>Direccion</th>
              <th className="min-w-[90px] sm:w-[110px]">Estado</th>
              <th className="min-w-[100px] sm:w-[160px]">Programada</th>
              <th className="min-w-[100px] sm:w-[200px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  Cargando inspecciones...
                </td>
              </tr>
            ) : filtered?.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-muted-foreground">
                  No hay inspecciones registradas.
                </td>
              </tr>
            ) : (
              filtered?.map((session) => (
                <tr key={session.id} className="hover:bg-muted/40 transition-colors">
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[12px] font-semibold text-primary">
                        {session.inspection_number || session.id.slice(0, 8)}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {session.inspection_type === "remote" ? "Remota" : "Presencial"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{session.claim?.claim_number}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {"Sin compañia"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{session.claim?.claims_participants?.[0]?.full_name || "—"}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {session.claim?.claim_address || "—"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <Badge className={sessionStatusColors[session.status]}>
                      {sessionStatusLabels[session.status] || session.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-[13px]">
                      {session.scheduled_at ? (
                        <>
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatDateTime(session.scheduled_at)}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Sin programar</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {/* Ver detalle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => router.push(`/dashboard/inspecciones/${session.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Ver
                      </Button>

                      {/* Acciones segun estado */}
                      {session.status === "scheduled" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              updateMutation.mutate({
                                id: session.id,
                                input: { status: "active" },
                              })
                            }
                          >
                            <Play className="h-3.5 w-3.5 mr-1" />
                            Iniciar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs btn-danger"
                            onClick={() =>
                              updateMutation.mutate({
                                id: session.id,
                                input: { status: "cancelled" },
                              })
                            }
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancelar
                          </Button>
                        </>
                      )}

                      {session.status === "active" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs btn-save"
                            onClick={() =>
                              updateMutation.mutate({
                                id: session.id,
                                input: { status: "completed" },
                              })
                            }
                          >
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Completar
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Crear Inspeccion - Agenda tipo médico */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate} dismissible={false}>
        <DialogContent className="modal-lg" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              Agendar Inspección
            </DialogTitle>
            <DialogDescription className="modal-subtitle">
              Selecciona siniestro, inspector y revisa su disponibilidad.
            </DialogDescription>
          </div>

          <div className="modal-body">
            {/* Paso 1: Siniestro */}
            <div className="mb-4">
              <label className="app-field-label flex items-center gap-1.5 mb-2">
                <FileText className="h-3.5 w-3.5" />
                Siniestro *
              </label>
              {!claims ? (
                <p className="text-muted-foreground text-sm">Cargando siniestros...</p>
              ) : availableClaims?.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">
                    No hay siniestros disponibles para inspección.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
                  {availableClaims?.map((claim) => (
                    <div
                      key={claim.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 transition-colors ${
                        selectedClaimId === claim.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedClaimId(claim.id)}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">
                          #{claim.claim_number} — {claim.claims_participants?.find((p: {type: string; full_name: string | null}) => p.type === 'insured')?.full_name || "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {claim.claim_address || "—"}
                        </p>
                      </div>
                      {selectedClaimId === claim.id && (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Info de contacto del siniestro seleccionado */}
            {selectedClaim && (insuredParticipant || contactParticipant) && (
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300 mb-2">
                  Contacto del Siniestro
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {insuredParticipant && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{insuredParticipant.full_name || "—"}</span>
                    </div>
                  )}
                  {insuredParticipant?.phone && (
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {insuredParticipant.phone}
                    </div>
                  )}
                  {insuredParticipant?.cell_phone && (
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      {insuredParticipant.cell_phone}
                    </div>
                  )}
                  {insuredParticipant?.email && (
                    <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      {insuredParticipant.email}
                    </div>
                  )}
                  {contactParticipant && contactParticipant !== insuredParticipant && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">{contactParticipant.full_name || "—"}</span>
                      {contactParticipant.phone && <span className="text-muted-foreground">· {contactParticipant.phone}</span>}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Paso 2: Inspector + Tipo + Fecha */}
            <div className="modal-grid-3 mb-4">
              <div className="modal-field">
                <label className="app-field-label">Inspector *</label>
                <Select value={selectedInspectorId} onValueChange={(v) => setSelectedInspectorId(v ?? "")}>
                  <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {inspectors.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{i.full_name || i.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field">
                <label className="app-field-label">Tipo *</label>
                <Select value={inspectionType} onValueChange={(v) => setInspectionType(v as "onsite" | "remote")}>
                  <SelectTrigger className="app-input"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onsite">Presencial (2h)</SelectItem>
                    <SelectItem value="remote">Remota (30min)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="modal-field">
                <label className="app-field-label">Fecha *</label>
                <Input type="date" value={scheduledDate} onChange={(e) => { setScheduledDate(e.target.value); setScheduledTime(""); }} className="app-input" />
              </div>
            </div>

            {/* Aviso de inspección remota */}
            {inspectionType === "remote" && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 mb-4 text-[12px] text-violet-700 dark:text-violet-300">
                <strong>Inspección Remota:</strong> Se generará un magic link único para que el asegurado acceda sin login. Duración estimada: 30 minutos.
              </div>
            )}

            {/* Paso 3: Disponibilidad del inspector (agenda) */}
            {selectedInspectorId && scheduledDate ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="app-field-label flex items-center gap-1.5">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Disponibilidad de {inspectors.find((i) => i.id === selectedInspectorId)?.full_name || "inspector"}
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    {inspectionType === "onsite" ? "Bloques de 2 horas" : "Bloques de 30 min"} · 9:00-13:00 / 14:00-18:00
                  </span>
                </div>

                {scheduleLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Clock className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando agenda...</span>
                  </div>
                ) : timeSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay horarios disponibles para esta fecha.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[200px] overflow-y-auto p-1">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        title={slot.bookedInfo ? `Ocupado: ${slot.bookedInfo}` : "Disponible"}
                        onClick={() => setScheduledTime(slot.time)}
                        className={`rounded-lg border px-3 py-2 text-[12px] font-medium transition-all text-center ${
                          !slot.available
                            ? "border-rose-500/20 bg-rose-500/5 text-rose-400 cursor-not-allowed line-through"
                            : scheduledTime === slot.time
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-card hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                        }`}
                      >
                        {slot.label}
                        {!slot.available && slot.bookedInfo && (
                          <span className="block text-[10px] font-normal text-rose-400/70 truncate mt-0.5">
                            {slot.bookedInfo}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
                {selectedClaimId
                  ? "Selecciona inspector y fecha para ver la disponibilidad."
                  : "Primero selecciona un siniestro."}
              </div>
            )}
          </div>

          <div className="modal-footer">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenCreate(false)}
              className="btn-cancel btn-footer"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!selectedClaimId || !selectedInspectorId || !scheduledDate || !scheduledTime || createMutation.isPending}
              onClick={() => createMutation.mutate(selectedClaimId)}
              className="btn-create btn-footer"
            >
              {createMutation.isPending ? (
                <Clock className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Calendar className="mr-2 h-3.5 w-3.5" />
              )}
              Agendar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
