"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getInspectionSessions,
  createInspectionSession,
  updateInspectionSession,
} from "@/services/inspections";
import { getClaims, getClaimsParticipants } from "@/services/claims";
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

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function InspectionsPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string>("");

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions"],
    queryFn: () => getInspectionSessions(),
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

  const createMutation = useMutation({
    mutationFn: createInspectionSession,
    onSuccess: () => {
      toast.success("Inspeccion creada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions"] });
      setOpenCreate(false);
      setSelectedClaimId("");
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
    const matchesSearch =
      [s.claim?.claim_number, s.claim?.insured_name, s.claim?.address, s.claim?.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      sessionStatusLabels[s.status]?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const availableClaims = claims?.filter(
    (c) => !sessions?.some((s) => s.claim_id === c.id && s.status !== "cancelled")
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
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="pending">Pendiente</SelectItem>
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
          Nueva Inspeccion
        </Button>
      </div>

      {/* Tabla de Inspecciones */}
      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-[140px]">Siniestro</th>
              <th className="w-[200px]">Asegurado</th>
              <th>Direccion</th>
              <th className="w-[110px]">Estado</th>
              <th className="w-[160px]">Programada</th>
              <th className="w-[200px] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  Cargando inspecciones...
                </td>
              </tr>
            ) : filtered?.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  No hay inspecciones registradas.
                </td>
              </tr>
            ) : (
              filtered?.map((session) => (
                <tr key={session.id} className="hover:bg-muted/40 transition-colors">
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
                      <span>{session.claim?.insured_name}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">
                        {session.claim?.address}
                        {session.claim?.city ? `, ${session.claim.city}` : ""}
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
                      {session.status === "pending" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              updateMutation.mutate({
                                id: session.id,
                                input: { status: "scheduled" },
                              })
                            }
                          >
                            <Calendar className="h-3.5 w-3.5 mr-1" />
                            Agendar
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

      {/* Modal Crear Inspeccion */}
      <Dialog open={openCreate} onOpenChange={setOpenCreate} dismissible={false}>
        <DialogContent className="modal-md" showCloseButton={false}>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <ClipboardCheck className="h-4 w-4" />
              </div>
              Nueva Inspeccion
            </DialogTitle>
            <DialogDescription className="modal-subtitle">
              Selecciona un siniestro para crear una nueva sesion de inspeccion.
            </DialogDescription>
          </div>

          <div className="modal-body">
            {!claims ? (
              <p className="text-muted-foreground">Cargando siniestros...</p>
            ) : availableClaims?.length === 0 ? (
              <div className="text-center py-4">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay siniestros disponibles sin inspeccion.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Todos los siniestros ya tienen una inspeccion activa.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto">
                {availableClaims?.map((claim) => (
                  <div
                    key={claim.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                      selectedClaimId === claim.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedClaimId(claim.id)}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        #{claim.claim_number} — {claim.claims_participants?.find((p: {type: string; full_name: string | null}) => p.type === 'insured')?.full_name || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {claim.claims_participants?.find((p: {type: string; address: string | null}) => p.type === 'insured')?.address || "—"}, {claim.claims_participants?.find((p: {type: string; city: string | null}) => p.type === 'insured')?.city || "—"} — {"—"}
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
              disabled={!selectedClaimId || createMutation.isPending}
              onClick={() => createMutation.mutate(selectedClaimId)}
              className="btn-create btn-footer"
            >
              {createMutation.isPending ? (
                <Clock className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="mr-2 h-3.5 w-3.5" />
              )}
              Crear Inspeccion
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
