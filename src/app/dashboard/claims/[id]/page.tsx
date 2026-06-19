"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getClaimById, deleteClaim, updateClaimStatus } from "@/services/claims";
import { getUsers } from "@/services/users";
import { createInspectionSession } from "@/services/inspections";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  ClipboardCheck,
  MapPin,
  User,
  Phone,
  Mail,
  Shield,
  FileText,
  Clock,
  Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AuditLogSection from "./audit-log-section";


const statusConfig: Record<string, { label: string; className: string }> = {
  created: { label: "Creado", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  scheduled: { label: "Programado", className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  in_progress: { label: "En Progreso", className: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  pending_info: { label: "Pendiente Info", className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
  in_review: { label: "En Revisión", className: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300" },
  signed: { label: "Firmado", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" },
  closed: { label: "Cerrado", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

function formatDate(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ClaimDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();

  const { data: claim, isLoading } = useQuery({
    queryKey: ["claim", id],
    queryFn: () => getClaimById(id),
  });

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => getUsers(),
  });

  const createInspectionMutation = useMutation({
    mutationFn: createInspectionSession,
    onSuccess: (session) => {
      toast.success("Inspección creada");
      router.push(`/dashboard/inspecciones/${session.id}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClaim,
    onSuccess: () => {
      toast.success("Siniestro eliminado");
      router.push("/dashboard/claims");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: () => updateClaimStatus(id, "closed"),
    onSuccess: () => {
      toast.success("Caso cerrado");
      queryClient.invalidateQueries({ queryKey: ["claim", id] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const status = statusConfig[claim?.status || "created"] || statusConfig.created;

  const inspector = users?.find((u) => u.id === claim?.inspector_id);
  const adjuster = users?.find((u) => u.id === claim?.adjuster_id);

  if (isLoading) {
    return (
      <div className="app-page">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Cargando siniestro...</p>
        </div>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="app-page">
        <div className="flex items-center justify-center py-20">
          <p className="text-muted-foreground">Siniestro no encontrado</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard/claims")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Siniestro {claim.claim_number}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={status.className}>{status.label}</Badge>
              <span className="text-xs text-muted-foreground">{formatDate(claim.claim_date)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="btn-create btn-sm"
            onClick={() => createInspectionMutation.mutate(claim.id)}
            disabled={createInspectionMutation.isPending}
          >
            <ClipboardCheck className="mr-2 h-4 w-4" />
            Inspeccionar
          </Button>
          <Button variant="outline" size="sm" className="btn-neutral btn-sm">
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </Button>
          {claim.status === "signed" && (
            <Button
              variant="outline"
              size="sm"
              className="btn-save btn-sm"
              onClick={() => {
                if (confirm("¿Cerrar este caso? No se podrá revertir.")) closeMutation.mutate();
              }}
              disabled={closeMutation.isPending}
            >
              <Lock className="mr-2 h-4 w-4" />
              Cerrar caso
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="btn-danger btn-sm"
            onClick={() => { if (confirm("¿Eliminar este siniestro?")) deleteMutation.mutate(claim.id); }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Eliminar
          </Button>
        </div>
      </div>

      {/* Grid de paneles */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Siniestro */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Datos del Siniestro
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">N° Siniestro</span>
                <p className="font-medium">{claim.claim_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">N° Póliza</span>
                <p className="font-medium">{claim.policy_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Compañía</span>
                <p className="font-medium">{claim.insurance_company || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Tipo</span>
                <p className="font-medium">{claim.claim_type}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Causal</span>
                <p className="font-medium">{claim.claim_cause || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Fecha</span>
                <p className="font-medium">{formatDate(claim.claim_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Hora</span>
                <p className="font-medium">{claim.claim_time || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Liquidación</span>
                <p className="font-medium">{claim.liquidation_number || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Ref. Cliente</span>
                <p className="font-medium">{claim.client_reference || "—"}</p>
              </div>
            </div>
            {claim.summary && (
              <div className="mt-4 pt-4 border-t border-border/40">
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Resumen</span>
                <p className="mt-1 text-[13px] text-muted-foreground">{claim.summary}</p>
              </div>
            )}
          </div>

          {/* Asegurado */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Asegurado
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Nombre</span>
                <p className="font-medium">{claim.insured_name} {claim.last_name || ""}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">RUT</span>
                <p className="font-medium">{claim.rut || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Email</span>
                <p className="font-medium">{claim.insured_email || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Teléfono</span>
                <p className="font-medium">{claim.insured_phone || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Celular</span>
                <p className="font-medium">{claim.cell_phone || "—"}</p>
              </div>
            </div>
          </div>

          {/* Ubicación */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Ubicación del Siniestro
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
              <div className="col-span-2 md:col-span-3">
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Dirección</span>
                <p className="font-medium">{claim.address}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Ciudad</span>
                <p className="font-medium">{claim.city}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Comuna</span>
                <p className="font-medium">{claim.commune || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Región</span>
                <p className="font-medium">{claim.region || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-[11px] uppercase tracking-wide">País</span>
                <p className="font-medium">{claim.country || "Chile"}</p>
              </div>
            </div>
          </div>

          {/* Contacto */}
          {(claim.contact_name || claim.contact_email) && (
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Persona de Contacto
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-[13px]">
                <div>
                  <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Nombre</span>
                  <p className="font-medium">{claim.contact_name || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Cargo</span>
                  <p className="font-medium">{claim.contact_role || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[11px] uppercase tracking-wide">Email</span>
                  <p className="font-medium">{claim.contact_email || "—"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Notas */}
          {claim.notes && (
            <div className="app-panel">
              <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notas
              </h3>
              <p className="text-[13px] text-muted-foreground whitespace-pre-wrap">{claim.notes}</p>
            </div>
          )}

          <AuditLogSection claimId={claim.id} users={users} />
        </div>

        {/* Sidebar derecha */}
        <div className="space-y-6">
          {/* Equipo */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Equipo Asignado
            </h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Inspector</span>
                <span className="font-medium">{inspector?.full_name || inspector?.email || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Ajustador</span>
                <span className="font-medium">{adjuster?.full_name || adjuster?.email || "—"}</span>
              </div>
            </div>
          </div>

          {/* Corredor */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Corredor
            </h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Corredor</span>
                <span className="font-medium">{claim.broker_name || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">N° Corredor</span>
                <span className="font-medium">{claim.broker_number || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Asesor</span>
                <span className="font-medium">{claim.advisor || "—"}</span>
              </div>
            </div>
          </div>

          {/* Timeline / fechas */}
          <div className="app-panel">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Fechas
            </h3>
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Denuncio</span>
                <span className="font-medium">{formatDate(claim.report_date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Asignación</span>
                <span className="font-medium">{formatDate(claim.assignment_date)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Creado</span>
                <span className="font-medium">{formatDate(claim.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
