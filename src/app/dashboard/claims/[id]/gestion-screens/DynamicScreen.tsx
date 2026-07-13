"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getClaimCoveragesByAction, getClaimCoveragesFromIngreso, createClaimCoverage, updateClaimCoverage, deactivateClaimCoverage } from "@/services/claim-coverages";
import { getClaimReserves, getClaimReserveByAction, createClaimReserve, updateClaimReserve, upsertReserveCoverage } from "@/services/claim-reserves";
import {
  getDocumentRequirements,
  getClaimDocumentRequests,
  getClaimDocumentRequestByAction,
  createClaimDocumentRequest,
  updateClaimDocumentRequestItem,
  closeClaimDocumentRequest,
  cancelClaimDocumentRequest,
} from "@/services/claim-documents";
import { getPolicyCoveragesByPolicyId } from "@/services/policies";
import { getClaimById, getClaimParticipants } from "@/services/claims";
import { getUsersByRoles, updateActionResponsible } from "@/services/claim-actions";
import { getInspectionSessions, createInspectionSession } from "@/services/inspections";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, Check, CheckCircle, X } from "lucide-react";
import type { ClaimAction, Claim } from "@/types";
import type { GestionScreenProps } from "./types";

// ClaimAction extendido con relaciones que vienen de GraphQL pero no están en el tipo base
type ActionWithRelations = ClaimAction & {
  created_at?: string;
  updated_at?: string;
};

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

export type FieldWidth = "full" | "half" | "third" | "quarter";

export type FieldCategory = "own" | "simple_entity" | "complex_entity";

export interface DateValidation {
  type: "greater_than" | "less_than" | "equal_to" | "greater_or_equal" | "less_or_equal" |
        "greater_than_today" | "less_than_today" | "equal_today";
  compareField?: string;
  label?: string;
}

export interface ScreenField {
  id: string;
  category: FieldCategory;
  type: string;
  label: string;
  required?: boolean;
  width?: FieldWidth;
  inputType?: "alphanumeric" | "numeric";
  maxLength?: number;
  placeholder?: string;
  rows?: number;
  dateType?: "date" | "datetime";
  dateValidation?: DateValidation;
  options?: { value: string; label: string }[];
  columns?: string[];
}

export function widthClass(width: FieldWidth = "full"): string {
  switch (width) {
    case "full": return "col-span-12";
    case "half": return "col-span-6";
    case "third": return "col-span-4";
    case "quarter": return "col-span-3";
    default: return "col-span-12";
  }
}

export interface DynamicScreenProps extends GestionScreenProps {
  fields: ScreenField[];
}

// ═══════════════════════════════════════════════════════════════
// Catálogos de campos disponibles para el constructor
// ═══════════════════════════════════════════════════════════════

export const OWN_FIELD_TYPES: { code: string; label: string; icon: string; desc: string }[] = [
  { code: "text", label: "Texto corto", icon: "Aa", desc: "Input para nombre, título, referencia" },
  { code: "textarea", label: "Descripción", icon: "¶", desc: "Texto largo para descripciones o comentarios" },
  { code: "number", label: "Número", icon: "#", desc: "Campo numérico con decimales" },
  { code: "date", label: "Fecha", icon: "📅", desc: "Calendario con validaciones opcionales" },
  { code: "select", label: "Selección", icon: "▼", desc: "Lista desplegable de opciones" },
  { code: "checkbox", label: "Checkbox", icon: "✓", desc: "Casilla de verificación" },
  { code: "table", label: "Tabla", icon: "⊞", desc: "Tabla editable con columnas" },
  { code: "section", label: "Sección", icon: "§", desc: "Título separador de grupos" },
];

export const CLAIM_ENTITIES: { code: string; label: string; icon: string; desc: string }[] = [
  { code: "claim_number", label: "N° Siniestro", icon: "#", desc: "Número del siniestro" },
  { code: "liquidation_number", label: "N° Liquidación", icon: "#", desc: "Número de liquidación" },
  { code: "claim_status", label: "Estado del Siniestro", icon: "▼", desc: "Estado actual" },
  { code: "claim_date", label: "Fecha Siniestro", icon: "📅", desc: "Fecha de ocurrencia" },
  { code: "policy_number", label: "N° Póliza", icon: "#", desc: "Número de póliza" },
  { code: "insured_name", label: "Asegurado", icon: "👤", desc: "Nombre del asegurado" },
  { code: "claimant_name", label: "Reclamante", icon: "👤", desc: "Nombre del reclamante" },
  { code: "broker_name", label: "Corredor", icon: "👤", desc: "Nombre del corredor" },
  { code: "adjuster_name", label: "Liquidador", icon: "👤", desc: "Nombre del liquidador asignado" },
  { code: "claim_address", label: "Dirección", icon: "📍", desc: "Dirección del siniestro" },
  // Datos de la reserva (para pantalla de ajuste — solo lectura)
  { code: "reserve_number", label: "N° Reserva", icon: "#", desc: "Número de la reserva origen" },
  { code: "reserve_currency", label: "Moneda Reserva", icon: "$", desc: "Moneda de la reserva origen" },
  { code: "reserve_payment_date", label: "Fecha Pago Reserva", icon: "📅", desc: "Fecha de pago de la reserva" },
];

export const ACTION_ENTITIES: { code: string; label: string; icon: string; desc: string }[] = [
  { code: "action_name", label: "Acción / Gestión", icon: "⚡", desc: "Nombre de la gestión actual" },
  { code: "action_issuer", label: "Emisor", icon: "👤", desc: "Persona que emitió la gestión" },
  { code: "action_reviewer", label: "Revisor", icon: "👤", desc: "Persona que revisa la gestión" },
  { code: "action_approver", label: "Aprobador", icon: "👤", desc: "Persona que aprueba la gestión" },
  { code: "action_created_at", label: "Fecha de Creación", icon: "📅", desc: "Fecha de creación de la gestión" },
  { code: "action_updated_at", label: "Actualización", icon: "📅", desc: "Fecha de última actualización" },
  { code: "action_expected_date", label: "Fecha Esperada", icon: "📅", desc: "Fecha esperada de la gestión" },
];

export const COMPLEX_ENTITIES: { code: string; label: string; icon: string; desc: string }[] = [
  { code: "review_levels", label: "Niveles de Revisión", icon: "✓", desc: "Emisor/Revisor/Aprobador según configuración de la gestión" },
  { code: "claim_coverages", label: "Coberturas", icon: "⊞", desc: "Todas las coberturas del siniestro" },
  { code: "claim_reserve", label: "Reserva", icon: "$", desc: "Reserva completa del siniestro" },
  { code: "claim_reserve_form", label: "Reserva (editor)", icon: "✎", desc: "Editor de reserva por cobertura" },
  { code: "claim_adjustment_form", label: "Ajuste (editor)", icon: "⚖", desc: "Editor de ajuste por cobertura" },
  { code: "claim_documents", label: "Solicitud de Documentos", icon: "📄", desc: "Seleccionar documentos a solicitar" },
  { code: "claim_document_receipt", label: "Recepción de Documentos", icon: "✓", desc: "Controlar recepción de documentos" },
  { code: "inspection_coordination", label: "Coordinación de Inspección", icon: "📅", desc: "Agendar inspección (crea sesión de inspección)" },
  { code: "inspection_session_view", label: "Inspección", icon: "🔍", desc: "Ver estado y resultados de la inspección" },
  { code: "claim_participants", label: "Participantes", icon: "👥", desc: "Personas relacionadas al siniestro" },
  { code: "claim_history", label: "Historial", icon: "📋", desc: "Gestiones anteriores del siniestro" },
];

export const ALL_SYSTEM_CODES = new Set([
  ...CLAIM_ENTITIES.map((e) => e.code),
  ...ACTION_ENTITIES.map((e) => e.code),
  ...COMPLEX_ENTITIES.map((e) => e.code),
]);

// ═══════════════════════════════════════════════════════════════
// Componente principal — agrupa campos por categoría
// ═══════════════════════════════════════════════════════════════

export default function DynamicScreen({ action, fields, onChange, readOnly, onAdvance, onReject }: DynamicScreenProps) {
  const values = (action.action_data || {}) as Record<string, unknown>;

  // Cargar siniestro para entidades de tipo claim_*
  const hasClaimEntities = fields.some((f) => CLAIM_ENTITIES.some((e) => e.code === f.type));
  const { data: claim } = useQuery({
    queryKey: ["claim", action.claim_id],
    queryFn: () => getClaimById(action.claim_id),
    enabled: hasClaimEntities && !!action.claim_id,
  });

  // Cargar participantes del siniestro (insured, broker, etc.)
  const { data: claimParticipants } = useQuery({
    queryKey: ["claim-participants", action.claim_id],
    queryFn: () => getClaimParticipants(action.claim_id),
    enabled: hasClaimEntities && !!action.claim_id,
  });

  // Cargar reserva del siniestro (para entidades reserve_currency, reserve_payment_date, reserve_number)
  const hasReserveEntities = fields.some((f) => f.type === "reserve_currency" || f.type === "reserve_payment_date" || f.type === "reserve_number");
  const { data: reserves } = useQuery({
    queryKey: ["claim-reserves", action.claim_id],
    queryFn: () => getClaimReserves(action.claim_id),
    enabled: hasReserveEntities && !!action.claim_id,
  });
  const reserveData = reserves && reserves.length > 0 ? reserves[0] : null;

  const updateValue = (id: string, value: unknown) => {
    onChange?.({ ...values, [id]: value });
  };

  // Separar campos por categoría
  const claimEntities = fields.filter((f) => f.category === "simple_entity" && CLAIM_ENTITIES.some((e) => e.code === f.type));
  const actionEntities = fields.filter((f) => f.category === "simple_entity" && ACTION_ENTITIES.some((e) => e.code === f.type));
  const otherEntities = fields.filter((f) => f.category === "simple_entity" && !CLAIM_ENTITIES.some((e) => e.code === f.type) && !ACTION_ENTITIES.some((e) => e.code === f.type));
  // review_levels se renderiza siempre al final, sin importar si está en los campos configurados
  const complexEntities = fields.filter((f) => f.category === "complex_entity" && f.type !== "review_levels");
  const ownFields = fields.filter((f) => f.category === "own");

  // Ordenar entidades complejas:
  // 1. claim_coverages primero
  // 2. resto de entidades complejas
  const sortedComplexEntities = [...complexEntities].sort((a, b) => {
    if (a.type === "claim_coverages" && b.type !== "claim_coverages") return -1;
    if (b.type === "claim_coverages" && a.type !== "claim_coverages") return 1;
    return 0;
  });

  return (
    <div className="space-y-4">
      {/* ─── Datos del siniestro (PRIMERO) ─── */}
      {claimEntities.length > 0 && (
        <section className="app-panel p-3">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Datos del Siniestro</h4>
          <div className="grid grid-cols-12 gap-3">
            {claimEntities.map((field) => (
              <div key={field.id} className={widthClass(field.width)}>
                <EntityField field={field} value={values[field.id]} action={action} reserveData={reserveData} claim={claim ?? undefined} claimParticipants={claimParticipants} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Entidades complejas (coberturas primero, review_levels al final) ─── */}
      {sortedComplexEntities.length > 0 && (
        <div className="space-y-4">
          {sortedComplexEntities.map((field) => (
            <section key={field.id} className="app-panel p-3">
              <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">{field.label}</h4>
              <ComplexEntityView type={field.type} action={action} readOnly={readOnly} values={values} onAdvance={onAdvance} onReject={onReject} />
            </section>
          ))}
        </div>
      )}

      {/* ─── Datos de la gestión ─── */}
      {actionEntities.length > 0 && (
        <section className="app-panel p-3">
          <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">Datos de la Gestión</h4>
          <div className="grid grid-cols-12 gap-3">
            {actionEntities.map((field) => (
              <div key={field.id} className={widthClass(field.width)}>
                <EntityField field={field} value={values[field.id]} action={action} reserveData={reserveData} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Otras entidades simples ─── */}
      {otherEntities.length > 0 && (
        <section className="app-panel p-3">
          <div className="grid grid-cols-12 gap-3">
            {otherEntities.map((field) => (
              <div key={field.id} className={widthClass(field.width)}>
                <EntityField field={field} value={values[field.id]} action={action} reserveData={reserveData} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Formulario (campos propios) ─── */}
      {ownFields.length > 0 && (
        <section className="app-panel p-3">
          <div className="grid grid-cols-12 gap-3">
            {ownFields.map((field) => (
              <div key={field.id} className={widthClass(field.width)}>
                <OwnField
                  field={field}
                  value={values[field.id]}
                  allFields={fields}
                  onChange={updateValue}
                  readOnly={readOnly}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Niveles de Revisión (SIEMPRE al final, en toda gestión) ─── */}
      {action.action_feature && (action.action_feature.has_issue || action.action_feature.has_review || action.action_feature.has_approve) && (
        <ReviewLevelsView action={action} onAdvance={onAdvance} onReject={onReject} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Entidades simples (solo lectura)
// ═══════════════════════════════════════════════════════════════

function EntityField({ field, value, action, reserveData, claim, claimParticipants }: {
  field: ScreenField;
  value: unknown;
  action: ActionWithRelations;
  reserveData?: { reserve_number: string | null; currency: string | null; payment_date: string | null } | null;
  claim?: Claim;
  claimParticipants?: { type: string; full_name: string }[];
}) {
  const isActionEntity = ACTION_ENTITIES.some((e) => e.code === field.type);
  const isReserveEntity = field.type === "reserve_currency" || field.type === "reserve_payment_date" || field.type === "reserve_number";
  const isClaimEntity = CLAIM_ENTITIES.some((e) => e.code === field.type);

  let displayValue: string;
  if (isActionEntity) {
    displayValue = getActionEntityValue(field.type, action, value);
  } else if (isReserveEntity) {
    displayValue = getReserveEntityValue(field.type, reserveData);
  } else if (isClaimEntity) {
    displayValue = getClaimEntityValue(field.type, claim, claimParticipants);
  } else {
    displayValue = String(value || "");
  }

  return (
    <div className="flex flex-col gap-1">
      <Label className="app-field-label text-[10px] text-muted-foreground">{field.label}</Label>
      <Input
        type="text"
        className="app-input h-8 text-[12px] bg-muted/30 border-dashed"
        value={displayValue}
        readOnly
        placeholder={`Se completa automáticamente`}
      />
    </div>
  );
}

function getReserveEntityValue(type: string, reserve: { reserve_number: string | null; currency: string | null; payment_date: string | null } | null | undefined): string {
  if (!reserve) return "Sin reserva";
  switch (type) {
    case "reserve_number":
      return reserve.reserve_number || "—";
    case "reserve_currency":
      return reserve.currency || "—";
    case "reserve_payment_date":
      return reserve.payment_date || "—";
    default:
      return "";
  }
}

function getClaimEntityValue(type: string, claim?: Claim | null, participants?: { type: string; full_name: string }[] | null): string {
  if (!claim) return "";
  switch (type) {
    case "claim_number":
      return claim.claim_number || "—";
    case "liquidation_number":
      return claim.liquidation_number || "—";
    case "claim_status":
      return claim.status?.name || claim.status?.code || "—";
    case "claim_date":
      return claim.claim_date ? new Date(claim.claim_date).toLocaleDateString("es-CL") : "—";
    case "policy_number":
      return claim.policy_number || "—";
    case "insured_name": {
      const insured = participants?.find((p) => p.type === "insured");
      return insured?.full_name || "—";
    }
    case "claimant_name": {
      const insured = participants?.find((p) => p.type === "insured");
      return insured?.full_name || "—";
    }
    case "broker_name":
      return claim.broker?.name || "—";
    case "adjuster_name":
      return claim.assigned_adjuster?.full_name || claim.adjuster?.full_name || "—";
    case "claim_address":
      return claim.claim_address || "—";
    default:
      return "";
  }
}

function getActionEntityValue(type: string, action: ActionWithRelations | null, fallback: unknown): string {
  if (!action) return String(fallback || "");
  switch (type) {
    case "action_name":
      return action.name || action.action_feature?.name || action.action_template?.name || String(fallback || "");
    case "action_issuer":
      return action.issuer?.name || action.issuer?.email || "Emisor asignado";
    case "action_reviewer":
      return action.reviewer?.name || action.reviewer?.email || "Revisor asignado";
    case "action_approver":
      return action.approver?.name || action.approver?.email || "Aprobador asignado";
    case "action_created_at":
      return action.created_at ? new Date(action.created_at).toLocaleString("es-CL") : String(fallback || "");
    case "action_updated_at":
      return action.updated_at ? new Date(action.updated_at).toLocaleString("es-CL") : String(fallback || "");
    case "action_expected_date":
      return action.expected_date || String(fallback || "");
    default:
      return String(fallback || "");
  }
}

// ═══════════════════════════════════════════════════════════════
// Niveles de Revisión (entidad compleja)
// Muestra 1, 2 o 3 niveles según la configuración de action_feature
// ═══════════════════════════════════════════════════════════════

function ReviewLevelsView({ action, onAdvance, onReject }: { action: ActionWithRelations; onAdvance?: (level: "issuer" | "reviewer" | "approver") => void; onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void }) {
  const feature = action.action_feature;
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  if (!feature) return null;

  const statusCode = action.action_status?.code || "todo";
  const tpl = action.action_template;

  // Construir niveles dinámicamente según config
  const levels: {
    key: "issuer" | "reviewer" | "approver";
    label: string;
    roles: string[];
    currentId: string | null;
    personName: string;
    done: boolean;
    active: boolean;
  }[] = [];

  if (feature.has_issue) {
    levels.push({
      key: "issuer",
      label: "Emisión",
      roles: tpl?.issuer_roles || [],
      currentId: action.issuer_id || null,
      personName: action.issuer?.full_name || action.issuer?.name || action.issuer?.email || "Por asignar",
      done: !!action.issued_on,
      active: statusCode === "todo",
    });
  }

  if (feature.has_review) {
    levels.push({
      key: "reviewer",
      label: "Revisión",
      roles: tpl?.reviewer_roles || [],
      currentId: action.reviewer_id || null,
      personName: action.reviewer?.full_name || action.reviewer?.name || action.reviewer?.email || "Por asignar",
      done: !!action.reviewed_on,
      active: statusCode === "issued",
    });
  }

  if (feature.has_approve) {
    levels.push({
      key: "approver",
      label: "Aprobación",
      roles: tpl?.approver_roles || [],
      currentId: action.approver_id || null,
      personName: action.approver?.full_name || action.approver?.name || action.approver?.email || "Por asignar",
      done: !!action.approved_on,
      active: statusCode === "reviewed",
    });
  }

  if (levels.length === 0) return null;

  const allDone = levels.every((l) => l.done);
  const isClosed = statusCode === "issued" && !feature.has_review && !feature.has_approve;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          {levels.length} nivel{levels.length !== 1 ? "es" : ""} de revisión
        </span>
        {isClosed && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
            <CheckCircle className="h-3 w-3" /> Emitida — cerrada
          </span>
        )}
        {allDone && !isClosed && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
            <CheckCircle className="h-3 w-3" /> Completada
          </span>
        )}
      </div>
      <div className="flex items-start gap-2 flex-wrap">
        {levels.map((level, idx) => (
          <div key={idx} className="flex items-start gap-2">
            {idx > 0 && <div className="h-8 w-px bg-border mt-1" />}
            <LevelCard
              level={level}
              actionId={action.id}
              currentUserId={profile?.id || null}
              onAdvance={onAdvance}
              onReject={onReject}
              onUpdated={() => {
                queryClient.invalidateQueries({ queryKey: ["claim-actions", action.claim_id] });
                queryClient.invalidateQueries({ queryKey: ["claim-action", action.id] });
                toast.success("Responsable actualizado");
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LevelCard({
  level,
  actionId,
  currentUserId,
  onAdvance,
  onReject,
  onUpdated,
}: {
  level: {
    key: "issuer" | "reviewer" | "approver";
    label: string;
    roles: string[];
    currentId: string | null;
    personName: string;
    done: boolean;
    active: boolean;
  };
  actionId: string;
  currentUserId: string | null;
  onAdvance?: (level: "issuer" | "reviewer" | "approver") => void;
  onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void;
  onUpdated: () => void;
}) {
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const { data: candidates, isLoading } = useQuery({
    queryKey: ["users-by-roles", level.roles],
    queryFn: () => getUsersByRoles(level.roles),
    enabled: level.roles.length > 0,
  });

  const updateMut = useMutation({
    mutationFn: (userId: string | null) => updateActionResponsible(actionId, level.key, userId),
    onSuccess: () => {
      onUpdated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sty = level.done
    ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
    : level.active
    ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800"
    : "bg-muted/40 text-muted-foreground";

  const isCurrentUser = level.currentId && currentUserId === level.currentId;
  const isCandidate = !!currentUserId && (candidates || []).some(c => c.id === currentUserId);
  const canReassign = level.active && !level.done && (isCandidate || isCurrentUser);
  // Puede avanzar/rechazar solo si la etapa está activa, no está done, es el responsable actual, y hay callbacks
  const canAct = level.active && !level.done && isCurrentUser && (onAdvance || onReject);

  const advanceLabel = level.key === "issuer" ? "Emitir" : level.key === "reviewer" ? "Revisar" : "Aprobar";

  const handleAdvance = () => {
    if (onAdvance) onAdvance(level.key);
  };

  const handleConfirmReject = () => {
    if (onReject && rejectComment.trim()) {
      onReject(level.key, rejectComment.trim());
      setShowRejectBox(false);
      setRejectComment("");
    }
  };

  return (
    <div className={`flex flex-col gap-1 rounded-md px-2.5 py-1.5 text-[11px] ${sty}`}>
      <div className="flex items-center gap-1.5">
        {level.done ? (
          <CheckCircle className="h-3 w-3" />
        ) : level.active ? (
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
        ) : (
          <div className="h-2 w-2 rounded-full border border-muted-foreground/40" />
        )}
        <span className="font-semibold">{level.label}</span>
        {isCurrentUser && (
          <Badge variant="outline" className="h-3.5 text-[8px] px-1 py-0">Tú</Badge>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {canReassign ? (
          <Select
            value={level.currentId || "__none"}
            onValueChange={(v) => {
              const newId = v === "__none" ? null : v;
              if (newId !== level.currentId) {
                updateMut.mutate(newId);
              }
            }}
            disabled={updateMut.isPending || isLoading}
            items={[
              { value: "__none", label: isLoading ? "Cargando..." : "Por asignar" },
              ...(candidates || []).map((c) => ({ value: c.id, label: c.full_name })),
              ...(level.currentId && !(candidates || []).some((c) => c.id === level.currentId)
                ? [{ value: level.currentId, label: level.personName }]
                : []),
            ]}
          >
            <SelectTrigger className="app-input h-7 text-[10px] max-w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" disabled>
                {isLoading ? "Cargando..." : "Por asignar"}
              </SelectItem>
              {(candidates || []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.full_name}
                </SelectItem>
              ))}
              {level.currentId && !(candidates || []).some(c => c.id === level.currentId) && (
                <SelectItem value={level.currentId}>{level.personName}</SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-[10px] opacity-80">{level.personName}</span>
        )}
      </div>
      {/* Botones de acción: ✓ avanzar / ✗ rechazar — solo para el responsable activo */}
      {canAct && !showRejectBox && (
        <div className="flex gap-1 pt-0.5">
          <button
            type="button"
            onClick={handleAdvance}
            title={advanceLabel}
            className="flex-1 flex items-center justify-center h-5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setShowRejectBox(true)}
            title="Rechazar"
            className="flex-1 flex items-center justify-center h-5 rounded text-[9px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {/* Caja de rechazo con motivo */}
      {canAct && showRejectBox && (
        <div className="flex flex-col gap-1 pt-0.5">
          <textarea
            className="text-[9px] rounded border border-rose-300 dark:border-rose-700 bg-background px-1.5 py-1 text-foreground min-h-[40px] resize-none focus:outline-none focus:ring-1 focus:ring-rose-400"
            placeholder="Motivo de rechazo..."
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            autoFocus
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => { setShowRejectBox(false); setRejectComment(""); }}
              className="flex-1 flex items-center justify-center h-5 rounded text-[9px] font-medium bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={!rejectComment.trim()}
              className="flex-1 flex items-center justify-center h-5 rounded text-[9px] font-medium bg-rose-500 text-white border border-rose-600 hover:bg-rose-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Entidades complejas (solo vista, datos reales)
// ═══════════════════════════════════════════════════════════════

function ComplexEntityView({ type, action, readOnly, values, onAdvance, onReject }: { type: string; action: ActionWithRelations; readOnly?: boolean; values: Record<string, unknown>; onAdvance?: (level: "issuer" | "reviewer" | "approver") => void; onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void }) {
  switch (type) {
    case "review_levels":
      return <ReviewLevelsView action={action} onAdvance={onAdvance} onReject={onReject} />;
    case "claim_coverages":
      return <ClaimCoveragesView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} action={action} />;
    case "claim_reserve":
      return <ClaimReservesView claimId={action?.claim_id} />;
    case "claim_reserve_form":
      return <ReserveEditorView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} generalValues={values} />;
    case "claim_adjustment_form":
      return <AdjustmentEditorView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} generalValues={values} />;
    case "claim_documents":
      return <DocumentRequestView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} />;
    case "claim_document_receipt":
      return <DocumentReceiptView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} />;
    case "inspection_coordination":
      return <InspectionCoordinationView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} action={action} />;
    case "inspection_session_view":
      return <InspectionSessionView claimId={action?.claim_id} readOnly={readOnly} />;
    case "claim_participants":
      return <div className="text-[11px] text-muted-foreground py-3 text-center">👥 Participantes del siniestro (próximamente)</div>;
    case "claim_history":
      return <div className="text-[11px] text-muted-foreground py-3 text-center">📋 Historial de gestiones (próximamente)</div>;
    default:
      return <div className="text-[11px] text-muted-foreground py-3 text-center">Datos del siniestro</div>;
  }
}

function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ClaimCoveragesView({ claimId, actionId, readOnly, action }: { claimId: string; actionId?: string; readOnly?: boolean; action?: ActionWithRelations }) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [comboOpen, setComboOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Determinar quién puede editar según la etapa del workflow:
  // - "todo" → emisor (issuer_id)
  // - "issued" → revisor (reviewer_id)
  // - "reviewed" → aprobador (approver_id)
  // - "approved"/"dispatched"/"closed" → nadie (solo lectura)
  const statusCode = action?.action_status?.code || "todo";
  const feature = action?.action_feature;
  const currentResponsibleId =
    statusCode === "todo" ? action?.issuer_id :
    statusCode === "issued" && feature?.has_review ? action?.reviewer_id :
    statusCode === "reviewed" && feature?.has_approve ? action?.approver_id :
    null;
  const currentResponsibleName =
    statusCode === "todo" ? (action?.issuer?.full_name || action?.issuer?.name || action?.issuer?.email || null) :
    statusCode === "issued" && feature?.has_review ? (action?.reviewer?.full_name || action?.reviewer?.name || action?.reviewer?.email || null) :
    statusCode === "reviewed" && feature?.has_approve ? (action?.approver?.full_name || action?.approver?.name || action?.approver?.email || null) :
    null;
  const currentStageLabel =
    statusCode === "todo" ? "emisión" :
    statusCode === "issued" ? "revisión" :
    statusCode === "reviewed" ? "aprobación" :
    null;
  const isCurrentResponsible = !!profile?.id && currentResponsibleId === profile.id;
  const canEditCoverages = !readOnly && isCurrentResponsible;

  // Cargar el siniestro para obtener policy_id
  const { data: claim } = useQuery({
    queryKey: ["claim", claimId],
    queryFn: () => getClaimById(claimId),
    enabled: !!claimId,
  });

  const policyId = claim?.policy_id || "";

  // Cargar coberturas de la póliza
  const { data: policyCoverages, isLoading: loadingPolicy } = useQuery({
    queryKey: ["policy-coverages-by-id", policyId],
    queryFn: () => getPolicyCoveragesByPolicyId(policyId),
    enabled: !!policyId,
  });

  // Cargar coberturas del siniestro vinculadas a ESTA gestión
  const { data: claimCoverages, isLoading: loadingClaim } = useQuery({
    queryKey: ["claim-coverages-action", claimId, actionId],
    queryFn: () => getClaimCoveragesByAction(claimId, actionId!),
    enabled: !!claimId && !!actionId,
  });

  // Mutations
  const addCoverageMut = useMutation({
    mutationFn: (policyCoverageId: string) => {
      const pc = policyCoverages?.find((p) => p.id === policyCoverageId);
      if (!pc) throw new Error("Cobertura no encontrada");
      return createClaimCoverage({
        claim_id: claimId,
        claim_action_id: actionId,
        policy_coverage_id: pc.id,
        coverage_name: pc.coverage_name,
        subcoverage_name: pc.subcoverage_name || undefined,
        insured_amount: pc.insured_amount || 0,
        deductible_amount: pc.deductible_amount || 0,
        currency: pc.currency || "CLP",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claim-coverages-action", claimId, actionId] });
      setComboOpen(false);
      setSearchTerm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCoverageMut = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      updateClaimCoverage(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claim-coverages-action", claimId, actionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCoverageMut = useMutation({
    mutationFn: (id: string) => deactivateClaimCoverage(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claim-coverages-action", claimId, actionId] });
      toast.success("Cobertura eliminada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // IDs de coberturas ya vinculadas a esta gestión
  const addedPolicyIds = new Set(
    (claimCoverages || [])
      .filter((c) => c.policy_coverage_id)
      .map((c) => c.policy_coverage_id)
  );

  // Coberturas de la póliza disponibles para vincular a esta gestión
  const availableCoverages = (policyCoverages || []).filter(
    (pc) => !addedPolicyIds.has(pc.id) &&
    (!searchTerm ||
      pc.coverage_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (pc.subcoverage_name || "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loadingPolicy || loadingClaim) {
    return <div className="text-[11px] text-muted-foreground py-2">Cargando coberturas...</div>;
  }

  if (!policyId) {
    return <div className="text-[11px] text-muted-foreground py-3 text-center">El siniestro no tiene póliza asignada.</div>;
  }

  return (
    <div className="space-y-3">
      {/* Combobox para agregar coberturas */}
      {canEditCoverages ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setComboOpen(!comboOpen)}
            className="flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-[12px] text-muted-foreground hover:border-primary/40 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Plus className="h-3.5 w-3.5" />
              Agregar cobertura de la póliza...
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${comboOpen ? "rotate-180" : ""}`} />
          </button>

          {comboOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setComboOpen(false)} />
              <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-[280px] overflow-hidden flex flex-col">
                <div className="p-2 border-b">
                  <Input
                    className="app-input h-8 text-[12px]"
                    placeholder="Buscar cobertura..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="overflow-y-auto flex-1">
                  {availableCoverages.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground text-center py-4">
                      {policyCoverages && policyCoverages.length === 0
                        ? "La póliza no tiene coberturas configuradas."
                        : "No hay coberturas disponibles para agregar."}
                    </p>
                  ) : (
                    availableCoverages.map((pc) => (
                      <button
                        key={pc.id}
                        type="button"
                        onClick={() => addCoverageMut.mutate(pc.id)}
                        disabled={addCoverageMut.isPending}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">
                            {pc.coverage_catalog?.code && <span className="text-muted-foreground font-mono text-[10px] mr-1.5">{pc.coverage_catalog.code}</span>}
                            {pc.coverage_name}
                          </div>
                          {pc.subcoverage_name && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {pc.subcoverage_catalog?.code && <span className="font-mono mr-1">{pc.subcoverage_catalog.code}</span>}
                              {pc.subcoverage_name}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {formatMoney(pc.insured_amount)}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {/* Grid de coberturas del siniestro */}
      {(!claimCoverages || claimCoverages.length === 0) ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center">
          <p className="text-[11px] text-muted-foreground">
            {canEditCoverages ? "Selecciona coberturas de la póliza para agregarlas al siniestro." :
             !readOnly && currentResponsibleId && currentResponsibleName ? `Solo ${currentResponsibleName} (responsable de ${currentStageLabel}) puede agregar coberturas.` :
             !readOnly && currentResponsibleId && !currentResponsibleName ? `Solo el responsable asignado de ${currentStageLabel} puede agregar coberturas.` :
             !readOnly && !currentResponsibleId ? `No hay responsable asignado para la etapa de ${currentStageLabel}. Asigne uno en los Niveles de Revisión.` :
             "No hay coberturas cargadas."}
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="app-data-table">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Cobertura</th>
                <th className="px-2 py-1.5 text-right font-medium w-[100px]">Asegurado</th>
                <th className="px-2 py-1.5 text-right font-medium w-[100px]">Reclamado</th>
                <th className="px-2 py-1.5 text-right font-medium w-[90px]">Deducible</th>
                {canEditCoverages && <th className="w-[32px]" />}
              </tr>
            </thead>
            <tbody>
              {claimCoverages.map((c) => {
                return (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{c.coverage_name}</div>
                    {c.subcoverage_name && (
                      <div className="text-[10px] text-muted-foreground">{c.subcoverage_name}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {canEditCoverages ? (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto"
                        value={c.insured_amount ?? 0}
                        onChange={(e) => updateCoverageMut.mutate({
                          id: c.id,
                          input: { insured_amount: Number(e.target.value) || 0 },
                        })}
                      />
                    ) : (
                      <span className="font-mono">{formatMoney(c.insured_amount)}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {canEditCoverages ? (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[90px] ml-auto"
                        value={c.claimed_amount ?? 0}
                        onChange={(e) => updateCoverageMut.mutate({
                          id: c.id,
                          input: { claimed_amount: Number(e.target.value) || 0 },
                        })}
                      />
                    ) : (
                      <span className="font-mono">{formatMoney(c.claimed_amount)}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {canEditCoverages ? (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[80px] ml-auto"
                        value={c.deductible_amount ?? 0}
                        onChange={(e) => updateCoverageMut.mutate({
                          id: c.id,
                          input: { deductible_amount: Number(e.target.value) || 0 },
                        })}
                      />
                    ) : (
                      <span className="font-mono">{formatMoney(c.deductible_amount)}</span>
                    )}
                  </td>
                  {canEditCoverages && (
                    <td className="px-1">
                      <button
                        type="button"
                        onClick={() => removeCoverageMut.mutate(c.id)}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Quitar cobertura"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen */}
      {claimCoverages && claimCoverages.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{claimCoverages.length} cobertura{claimCoverages.length !== 1 ? "s" : ""} cargada{claimCoverages.length !== 1 ? "s" : ""}</span>
          {!canEditCoverages && !readOnly && (
            <span className="flex items-center gap-1 text-amber-600">
              <Check className="h-3 w-3" /> {currentResponsibleId && currentResponsibleName ? `Solo ${currentResponsibleName} puede editar` : currentResponsibleId ? "Solo el responsable actual puede editar" : "Acción cerrada — solo lectura"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ClaimReservesView({ claimId }: { claimId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["claim-reserves", claimId],
    queryFn: () => getClaimReserves(claimId),
    enabled: !!claimId,
  });

  if (isLoading) return <div className="text-[11px] text-muted-foreground py-2">Cargando reservas...</div>;
  if (!data || data.length === 0) {
    return <div className="text-[11px] text-muted-foreground py-3 text-center">No hay reservas creadas en este siniestro.</div>;
  }

  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.id} className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[12px] font-semibold">Reserva {r.reserve_number || r.id.slice(0, 8)}</span>
            <span className="text-[11px] text-muted-foreground">{r.currency}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] mb-2">
            <div><span className="text-muted-foreground">Capital:</span> <span className="font-mono">{formatMoney(r.capital_amount)}</span></div>
            <div><span className="text-muted-foreground">Reclamado:</span> <span className="font-mono">{formatMoney(r.claimed_amount)}</span></div>
            <div><span className="text-muted-foreground">Reserva:</span> <span className="font-mono">{formatMoney(r.reserve_amount)}</span></div>
            <div><span className="text-muted-foreground">Final:</span> <span className="font-mono">{formatMoney(r.final_amount)}</span></div>
          </div>
          {r.reserve_coverages.length > 0 && (
            <div className="rounded-md border border-border overflow-hidden">
              <table className="app-data-table">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium">Cobertura</th>
                    <th className="px-2 py-1 text-right font-medium">Reserva</th>
                    <th className="px-2 py-1 text-right font-medium">Deducible</th>
                    <th className="px-2 py-1 text-right font-medium">Neta</th>
                  </tr>
                </thead>
                <tbody>
                  {r.reserve_coverages.map((rc) => (
                    <tr key={rc.id} className="border-t border-border">
                      <td className="px-2 py-1">{rc.claim_coverage?.coverage_name || rc.claim_coverage_id.slice(0, 8)}</td>
                      <td className="px-2 py-1 text-right font-mono">{formatMoney(rc.reserved_amount)}</td>
                      <td className="px-2 py-1 text-right font-mono">{formatMoney(rc.deductible_amount)}</td>
                      <td className="px-2 py-1 text-right font-mono">{formatMoney(rc.net_reserve)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Campos propios (editables)
// ═══════════════════════════════════════════════════════════════

function OwnField({
  field,
  value,
  allFields,
  onChange,
  readOnly,
}: {
  field: ScreenField;
  value: unknown;
  allFields: ScreenField[];
  onChange: (id: string, value: unknown) => void;
  readOnly?: boolean;
}) {
  const inputClass = "app-input h-8 text-[12px]";

  switch (field.type) {
    case "section":
      return (
        <div className="pt-2 pb-1 border-b border-border">
          <p className="text-[13px] font-semibold">{field.label}</p>
        </div>
      );

    case "text":
      return (
        <div className="flex flex-col gap-1">
          <Label className="app-field-label text-[11px]">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            type="text"
            inputMode={field.inputType === "numeric" ? "decimal" : "text"}
            className={inputClass}
            value={String(value || "")}
            onChange={(e) => {
              let v = e.target.value;
              if (field.inputType === "numeric") v = v.replace(/[^0-9.,-]/g, "");
              if (field.maxLength) v = v.slice(0, field.maxLength);
              onChange(field.id, v);
            }}
            disabled={readOnly}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
          />
          {field.maxLength && (
            <p className="text-[9px] text-muted-foreground">
              Máx {field.maxLength} · {field.inputType === "numeric" ? "Numérico" : "Alfanumérico"}
            </p>
          )}
        </div>
      );

    case "number":
      return (
        <div className="flex flex-col gap-1">
          <Label className="app-field-label text-[11px]">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          <Input
            type="number"
            className={inputClass}
            value={value === undefined || value === null ? "" : String(value)}
            onChange={(e) => onChange(field.id, e.target.value === "" ? null : Number(e.target.value))}
            disabled={readOnly}
            placeholder={field.placeholder}
          />
        </div>
      );

    case "date":
      return <DateField field={field} value={value} allFields={allFields} onChange={onChange} readOnly={readOnly} />;

    case "textarea":
      return (
        <div className="flex flex-col gap-1">
          <Label className="app-field-label text-[11px]">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          <Textarea
            className="app-input text-[12px]"
            value={String(value || "")}
            onChange={(e) => {
              let v = e.target.value;
              if (field.maxLength) v = v.slice(0, field.maxLength);
              onChange(field.id, v);
            }}
            disabled={readOnly}
            placeholder={field.placeholder}
            rows={field.rows || 3}
          />
          {field.maxLength && (
            <p className="text-[9px] text-muted-foreground">
              {String(value || "").length}/{field.maxLength} caracteres
            </p>
          )}
        </div>
      );

    case "select":
      return (
        <div className="flex flex-col gap-1">
          <Label className="app-field-label text-[11px]">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </Label>
          <Select
            value={String(value || "__none")}
            onValueChange={(v) => onChange(field.id, v === "__none" ? "" : v)}
            disabled={readOnly}
            items={[
              { value: "__none", label: field.placeholder || "Seleccionar..." },
              ...(field.options || []).map((opt) => ({ value: opt.value, label: opt.label })),
            ]}
          >
            <SelectTrigger className="app-input h-7 text-[12px] w-full">
              <SelectValue placeholder={field.placeholder || "Seleccionar..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{field.placeholder || "Seleccionar..."}</SelectItem>
              {field.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );

    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-[12px] py-1">
          <Checkbox
            checked={!!value}
            onChange={(e) => onChange(field.id, (e.target as HTMLInputElement).checked)}
            disabled={readOnly}
          />
          {field.label}
        </label>
      );

    case "table":
      return <TableField field={field} value={value} onChange={onChange} readOnly={readOnly} />;

    default:
      return <div className="text-[11px] text-amber-600">Tipo no soportado: <strong>{field.type}</strong></div>;
  }
}

// ═══════════════════════════════════════════════════════════════
// Campo de fecha con validaciones
// ═══════════════════════════════════════════════════════════════

function DateField({
  field,
  value,
  allFields,
  onChange,
  readOnly,
}: {
  field: ScreenField;
  value: unknown;
  allFields: ScreenField[];
  onChange: (id: string, value: unknown) => void;
  readOnly?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  const validate = (dateStr: string) => {
    if (!dateStr || !field.dateValidation) { setError(null); return; }
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const v = field.dateValidation!;
    if (v.type === "greater_than_today") {
      if (date <= today) { setError("Debe ser mayor a la fecha actual"); return; }
    } else if (v.type === "less_than_today") {
      if (date >= today) { setError("Debe ser menor a la fecha actual"); return; }
    } else if (v.type === "equal_today") {
      if (date.toDateString() !== today.toDateString()) { setError("Debe ser igual a la fecha actual"); return; }
    }
    setError(null);
  };

  return (
    <div className="flex flex-col gap-1">
      <Label className="app-field-label text-[11px]">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        type={field.dateType === "datetime" ? "datetime-local" : "date"}
        className="app-input h-8 text-[12px]"
        value={String(value || "")}
        onChange={(e) => {
          onChange(field.id, e.target.value);
          validate(e.target.value);
        }}
        disabled={readOnly}
      />
      {field.dateValidation && (
        <p className="text-[10px] text-amber-600">⚠ {getDateValidationLabel(field.dateValidation, allFields)}</p>
      )}
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  );
}

function getDateValidationLabel(v: DateValidation, allFields: ScreenField[]): string {
  const compareField = v.compareField ? allFields.find((f) => f.id === v.compareField) : null;
  switch (v.type) {
    case "greater_than_today": return "Debe ser mayor a la fecha actual";
    case "less_than_today": return "Debe ser menor a la fecha actual";
    case "equal_today": return "Debe ser igual a la fecha actual";
    case "greater_than": return `Debe ser mayor que ${compareField?.label || "otro campo"}`;
    case "less_than": return `Debe ser menor que ${compareField?.label || "otro campo"}`;
    case "equal_to": return `Debe ser igual a ${compareField?.label || "otro campo"}`;
    case "greater_or_equal": return `Debe ser mayor o igual que ${compareField?.label || "otro campo"}`;
    case "less_or_equal": return `Debe ser menor o igual que ${compareField?.label || "otro campo"}`;
    default: return "";
  }
}

// ═══════════════════════════════════════════════════════════════
// Tabla editable
// ═══════════════════════════════════════════════════════════════

function TableField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: ScreenField;
  value: unknown;
  onChange: (id: string, value: unknown) => void;
  readOnly?: boolean;
}) {
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
  const columns = field.columns || ["Columna 1"];

  const updateCell = (rowIdx: number, col: string, cellValue: unknown) => {
    const next = rows.map((r, idx) => (idx === rowIdx ? { ...r, [col]: cellValue } : r));
    onChange(field.id, next);
  };

  const addRow = () => {
    const newRow: Record<string, unknown> = {};
    columns.forEach((c) => (newRow[c] = ""));
    onChange(field.id, [...rows, newRow]);
  };

  const removeRow = (idx: number) => {
    onChange(field.id, rows.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label className="app-field-label text-[11px]">
        {field.label} {field.required && <span className="text-red-500">*</span>}
      </Label>
      {rows.length > 0 && (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="app-data-table">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 text-left font-medium">{c}</th>
                ))}
                {!readOnly && <th className="px-2 py-1.5 w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-border">
                  {columns.map((c) => (
                    <td key={c} className="px-1 py-0.5">
                      <Input
                        className="h-7 text-[11px] border-0 bg-transparent px-1"
                        value={String(row[c] || "")}
                        onChange={(e) => updateCell(idx, c, e.target.value)}
                        disabled={readOnly}
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-1 py-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(idx)}
                        className="text-[10px] text-red-500 hover:text-red-700"
                        title="Eliminar fila"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!readOnly && (
        <button type="button" className="text-[11px] text-primary hover:underline w-fit" onClick={addRow}>
          + Agregar fila
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Editor de Reserva por Cobertura
// ═══════════════════════════════════════════════════════════════

function ReserveEditorView({ claimId, actionId, readOnly, generalValues }: { claimId: string; actionId?: string; readOnly?: boolean; generalValues: Record<string, unknown> }) {
  // Cargar SOLO las coberturas ingresadas via Ingreso de Coberturas (cadena)
  const { data: claimCoverages, isLoading: loadingCov } = useQuery({
    queryKey: ["claim-coverages-from-ingreso", claimId],
    queryFn: () => getClaimCoveragesFromIngreso(claimId),
    enabled: !!claimId,
  });

  // Cargar reserva existente para esta acción
  const { data: existingReserve, isLoading: loadingRes } = useQuery({
    queryKey: ["claim-reserve-by-action", actionId],
    queryFn: () => getClaimReserveByAction(actionId!),
    enabled: !!actionId,
  });

  if (loadingCov || loadingRes) {
    return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
  }

  if (!claimCoverages || claimCoverages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          No hay coberturas ingresadas. Completa primero el Ingreso de Coberturas.
        </p>
      </div>
    );
  }

  return (
    <ReserveEditorForm
      key={existingReserve?.id || "new"}
      claimId={claimId}
      actionId={actionId}
      claimCoverages={claimCoverages}
      existingReserve={existingReserve || null}
      readOnly={readOnly}
      generalValues={generalValues}
    />
  );
}

function ReserveEditorForm({
  claimId,
  actionId,
  claimCoverages,
  existingReserve,
  readOnly,
  generalValues,
}: {
  claimId: string;
  actionId?: string;
  claimCoverages: { id: string; coverage_name: string | null; subcoverage_name: string | null; claimed_amount: number | null; deductible_amount: number | null }[];
  existingReserve: { id: string; currency: string | null; payment_date: string | null; notes: string | null; reserve_coverages?: { claim_coverage_id: string; claimed_amount: number | null; reserved_amount: number | null; deductible_amount: number | null }[] } | null;
  readOnly?: boolean;
  generalValues: Record<string, unknown>;
}) {
  const queryClient = useQueryClient();

  // Campos generales vienen de los own fields de primer nivel (action_data)
  // Fallback a la reserva existente si no están en action_data todavía
  const currency = (generalValues.reserve_currency as string) || existingReserve?.currency || "CLP";
  const paymentDate = (generalValues.reserve_payment_date as string) || existingReserve?.payment_date || new Date().toISOString().slice(0, 10);
  const notes = (generalValues.reserve_notes as string) || existingReserve?.notes || "";

  const [rows, setRows] = useState(() =>
    claimCoverages.map((c) => {
      const existing = existingReserve?.reserve_coverages?.find(
        (rc) => rc.claim_coverage_id === c.id
      );
      return {
        claim_coverage_id: c.id,
        claimed: existing?.claimed_amount ?? c.claimed_amount ?? 0,
        reserved: existing?.reserved_amount ?? 0,
        deductible: existing?.deductible_amount ?? c.deductible_amount ?? 0,
      };
    })
  );

  const updateRow = (idx: number, field: "claimed" | "reserved" | "deductible", value: number) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  // Totales
  const totalClaimed = rows.reduce((s, r) => s + (r.claimed || 0), 0);
  const totalReserved = rows.reduce((s, r) => s + (r.reserved || 0), 0);
  const totalDeductible = rows.reduce((s, r) => s + (r.deductible || 0), 0);
  const totalNet = rows.reduce((s, r) => s + ((r.reserved || 0) - (r.deductible || 0)), 0);

  // Mutación para guardar
  const saveMut = useMutation({
    mutationFn: async () => {
      if (!claimCoverages || claimCoverages.length === 0) {
        throw new Error("No hay coberturas en el siniestro");
      }
      const reserveCoverages = rows.map((r) => ({
        claim_coverage_id: r.claim_coverage_id,
        claimed_amount: r.claimed,
        reserved_amount: r.reserved,
        deductible_amount: r.deductible,
        net_reserve: r.reserved - r.deductible,
      }));

      if (existingReserve) {
        // Actualizar reserva existente
        await updateClaimReserve(existingReserve.id, {
          currency,
          payment_date: paymentDate,
          notes,
          claimed_amount: totalClaimed,
          reserve_amount: totalReserved,
          deductible_amount: totalDeductible,
          final_amount: totalNet,
        });
        // Actualizar cada reserve_coverage
        for (const rc of reserveCoverages) {
          await upsertReserveCoverage(existingReserve.id, rc.claim_coverage_id, rc);
        }
      } else {
        // Crear nueva reserva
        await createClaimReserve({
          claim_id: claimId,
          claim_action_id: actionId,
          currency,
          payment_date: paymentDate,
          notes,
          claimed_amount: totalClaimed,
          reserve_amount: totalReserved,
          deductible_amount: totalDeductible,
          final_amount: totalNet,
          reserve_coverages: reserveCoverages,
        });
      }
    },
    onSuccess: () => {
      toast.success("Reserva guardada");
      queryClient.invalidateQueries({ queryKey: ["claim-reserves", claimId] });
      queryClient.invalidateQueries({ queryKey: ["claim-reserve-by-action", actionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {/* Tabla de coberturas con reserva por fila */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="app-data-table">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Cobertura</th>
              <th className="px-2 py-1.5 text-right font-medium w-[110px]">Reclamado</th>
              <th className="px-2 py-1.5 text-right font-medium w-[110px]">Reserva</th>
              <th className="px-2 py-1.5 text-right font-medium w-[100px]">Deducible</th>
              <th className="px-2 py-1.5 text-right font-medium w-[100px]">Neta</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const cov = claimCoverages.find((c) => c.id === row.claim_coverage_id);
              const net = (row.reserved || 0) - (row.deductible || 0);
              return (
                <tr key={row.claim_coverage_id} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{cov?.coverage_name || "—"}</div>
                    {cov?.subcoverage_name && (
                      <div className="text-[10px] text-muted-foreground">{cov.subcoverage_name}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {readOnly ? (
                      <span className="font-mono">{formatMoney(row.claimed)}</span>
                    ) : (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto"
                        value={row.claimed}
                        onChange={(e) => updateRow(idx, "claimed", Number(e.target.value) || 0)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {readOnly ? (
                      <span className="font-mono">{formatMoney(row.reserved)}</span>
                    ) : (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto"
                        value={row.reserved}
                        onChange={(e) => updateRow(idx, "reserved", Number(e.target.value) || 0)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {readOnly ? (
                      <span className="font-mono">{formatMoney(row.deductible)}</span>
                    ) : (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[90px] ml-auto"
                        value={row.deductible}
                        onChange={(e) => updateRow(idx, "deductible", Number(e.target.value) || 0)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(net)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 border-t-2 border-border">
            <tr>
              <td className="px-2 py-1.5 font-semibold">Totales</td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(totalClaimed)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(totalReserved)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(totalDeductible)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(totalNet)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Reserva Final (sumatoria de todas las reservas menos deducibles) */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center gap-6">
          <div>
            <Label className="app-field-label text-[10px]">Total Reclamado</Label>
            <p className="text-[13px] font-mono font-semibold">{formatMoney(totalClaimed)} {currency}</p>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Total Reservado</Label>
            <p className="text-[13px] font-mono font-semibold">{formatMoney(totalReserved)} {currency}</p>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Total Deducible</Label>
            <p className="text-[13px] font-mono font-semibold">{formatMoney(totalDeductible)} {currency}</p>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Reserva Final</Label>
            <p className="text-[13px] font-mono font-semibold text-primary">{formatMoney(totalNet)} {currency}</p>
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-save btn-sm"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {readOnly && (
        <p className="text-[10px] text-muted-foreground text-center">
          Reserva emitida — solo lectura
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Editor de Ajuste por Cobertura
// Toma los datos reservados por cobertura y permite ajustar montos
// ═══════════════════════════════════════════════════════════════

function AdjustmentEditorView({ claimId, readOnly, generalValues }: { claimId: string; actionId?: string; readOnly?: boolean; generalValues: Record<string, unknown> }) {
  // Cargar reservas del siniestro (para obtener la reserva a ajustar)
  const { data: reserves, isLoading: loadingRes } = useQuery({
    queryKey: ["claim-reserves", claimId],
    queryFn: () => getClaimReserves(claimId),
    enabled: !!claimId,
  });

  // Tomar la primera reserva activa (la que se va a ajustar)
  const reserve = reserves && reserves.length > 0 ? reserves[0] : null;

  if (loadingRes) {
    return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
  }

  if (!reserve) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          No hay reserva creada en el siniestro. Crea una reserva primero.
        </p>
      </div>
    );
  }

  if (!reserve.reserve_coverages || reserve.reserve_coverages.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          La reserva no tiene coberturas detalladas.
        </p>
      </div>
    );
  }

  return (
    <AdjustmentEditorForm
      key={reserve.id}
      claimId={claimId}
      reserve={reserve}
      readOnly={readOnly}
      generalValues={generalValues}
    />
  );
}

function AdjustmentEditorForm({
  claimId,
  reserve,
  readOnly,
  generalValues,
}: {
  claimId: string;
  reserve: {
    id: string;
    reserve_number: string | null;
    currency: string | null;
    payment_date: string | null;
    notes: string | null;
    reserve_coverages: {
      claim_coverage_id: string;
      reserved_amount: number | null;
      deductible_amount: number | null;
      adjusted_amount: number | null;
      adjusted_deductible: number | null;
      adjustment_notes: string | null;
      claim_coverage?: { coverage_name: string | null; subcoverage_name: string | null } | null;
    }[];
  };
  readOnly?: boolean;
  generalValues: Record<string, unknown>;
}) {
  const queryClient = useQueryClient();

  // Notas del ajuste vienen de los own fields de primer nivel
  const notes = (generalValues.adjustment_notes as string) || reserve.notes || "";

  // Inicializar estado desde la reserva (lazy init)
  const [rows, setRows] = useState(() =>
    reserve.reserve_coverages.map((rc) => ({
      claim_coverage_id: rc.claim_coverage_id,
      coverage_name: rc.claim_coverage?.coverage_name || "—",
      subcoverage_name: rc.claim_coverage?.subcoverage_name || null,
      reserved: rc.reserved_amount ?? 0,
      deductible: rc.deductible_amount ?? 0,
      adjusted_amount: rc.adjusted_amount ?? rc.reserved_amount ?? 0,
      adjusted_deductible: rc.adjusted_deductible ?? rc.deductible_amount ?? 0,
      adjustment_notes: rc.adjustment_notes || "",
    }))
  );

  const updateRow = (idx: number, field: "adjusted_amount" | "adjusted_deductible" | "adjustment_notes", value: number | string) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  // Totales
  const totalReserved = rows.reduce((s, r) => s + (r.reserved || 0), 0);
  const totalDeductible = rows.reduce((s, r) => s + (r.deductible || 0), 0);
  const totalAdjusted = rows.reduce((s, r) => s + (r.adjusted_amount || 0), 0);
  const totalAdjustedDeductible = rows.reduce((s, r) => s + (r.adjusted_deductible || 0), 0);
  const totalFinal = rows.reduce((s, r) => s + ((r.adjusted_amount || 0) - (r.adjusted_deductible || 0)), 0);
  const totalNetReserve = totalReserved - totalDeductible;
  const difference = totalFinal - totalNetReserve;

  // Mutación para guardar el ajuste
  const saveMut = useMutation({
    mutationFn: async () => {
      // Actualizar la reserva con los totales ajustados (sin sobrescribir los originales)
      await updateClaimReserve(reserve.id, {
        adjusted_amount: totalAdjusted,
        adjusted_deductible: totalAdjustedDeductible,
        adjusted_final_amount: totalFinal,
        adjusted_at: new Date().toISOString(),
        adjustment_notes: notes || reserve.notes || undefined,
        status: "adjusted",
      });
      // Actualizar cada reserve_coverage con los campos de ajuste (reserved_amount se mantiene intacto)
      for (const row of rows) {
        await upsertReserveCoverage(reserve.id, row.claim_coverage_id, {
          adjusted_amount: row.adjusted_amount,
          adjusted_deductible: row.adjusted_deductible,
          adjusted_net: row.adjusted_amount - row.adjusted_deductible,
          adjustment_notes: row.adjustment_notes || null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Ajuste guardado");
      queryClient.invalidateQueries({ queryKey: ["claim-reserves", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      {/* Info de la reserva origen */}
      <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 text-[11px]">
        <div>
          <span className="text-muted-foreground">Reserva:</span>{" "}
          <span className="font-medium">{reserve.reserve_number || reserve.id.slice(0, 8)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Moneda:</span>{" "}
          <span className="font-medium">{reserve.currency}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Fecha Pago:</span>{" "}
          <span className="font-medium">{reserve.payment_date || "—"}</span>
        </div>
      </div>

      {/* Tabla de ajuste por cobertura */}
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="app-data-table">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Cobertura</th>
              <th className="px-2 py-1.5 text-right font-medium w-[100px]">Reservado</th>
              <th className="px-2 py-1.5 text-right font-medium w-[90px]">Deducible</th>
              <th className="px-2 py-1.5 text-right font-medium w-[110px]">Ajustado</th>
              <th className="px-2 py-1.5 text-right font-medium w-[100px]">Ded. Ajuste</th>
              <th className="px-2 py-1.5 text-right font-medium w-[100px]">Final</th>
              <th className="px-2 py-1.5 text-left font-medium w-[180px]">Notas Ajuste</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const final = (row.adjusted_amount || 0) - (row.adjusted_deductible || 0);
              return (
                <tr key={row.claim_coverage_id} className="border-t border-border">
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{row.coverage_name}</div>
                    {row.subcoverage_name && (
                      <div className="text-[10px] text-muted-foreground">{row.subcoverage_name}</div>
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{formatMoney(row.reserved)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{formatMoney(row.deductible)}</td>
                  <td className="px-2 py-1.5 text-right">
                    {readOnly ? (
                      <span className="font-mono">{formatMoney(row.adjusted_amount)}</span>
                    ) : (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto"
                        value={row.adjusted_amount}
                        onChange={(e) => updateRow(idx, "adjusted_amount", Number(e.target.value) || 0)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    {readOnly ? (
                      <span className="font-mono">{formatMoney(row.adjusted_deductible)}</span>
                    ) : (
                      <Input
                        type="number"
                        className="app-input h-7 text-[11px] text-right font-mono w-[90px] ml-auto"
                        value={row.adjusted_deductible}
                        onChange={(e) => updateRow(idx, "adjusted_deductible", Number(e.target.value) || 0)}
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(final)}</td>
                  <td className="px-2 py-1.5">
                    {readOnly ? (
                      <span className="text-[10px] text-muted-foreground">{row.adjustment_notes || "—"}</span>
                    ) : (
                      <Input
                        className="app-input h-7 text-[10px] w-full"
                        value={row.adjustment_notes}
                        onChange={(e) => updateRow(idx, "adjustment_notes", e.target.value)}
                        placeholder="Notas del ajuste..."
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-muted/30 border-t-2 border-border">
            <tr>
              <td className="px-2 py-1.5 font-semibold">Totales</td>
              <td className="px-2 py-1.5 text-right font-mono">{formatMoney(totalReserved)}</td>
              <td className="px-2 py-1.5 text-right font-mono">{formatMoney(totalDeductible)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(totalAdjusted)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(totalAdjustedDeductible)}</td>
              <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(totalFinal)}</td>
              <td className="px-2 py-1.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Ajuste Final (sumatoria de todos los ajustados menos deducibles) */}
      <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
        <div className="flex items-center gap-6">
          <div>
            <Label className="app-field-label text-[10px]">Reserva Neta</Label>
            <p className="text-[13px] font-mono font-semibold">{formatMoney(totalNetReserve)} {reserve.currency}</p>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Ajuste Final</Label>
            <p className="text-[13px] font-mono font-semibold text-primary">{formatMoney(totalFinal)} {reserve.currency}</p>
          </div>
          <div>
            <Label className="app-field-label text-[10px]">Diferencia</Label>
            <p className={`text-[13px] font-mono font-semibold ${difference < 0 ? "text-rose-600" : difference > 0 ? "text-emerald-600" : ""}`}>
              {difference >= 0 ? "+" : ""}{formatMoney(difference)} {reserve.currency}
            </p>
          </div>
        </div>
      </div>

      {/* Botón guardar */}
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-save btn-sm"
            disabled={saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {readOnly && (
        <p className="text-[10px] text-muted-foreground text-center">
          Ajuste emitido — solo lectura
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Solicitud de Documentos
// Muestra los documentos disponibles según línea de negocio.
// El usuario selecciona cuáles solicitar (solo los no recibidos).
// ═══════════════════════════════════════════════════════════════

function DocumentRequestView({ claimId, actionId, readOnly }: { claimId?: string; actionId?: string; readOnly?: boolean }) {
  // Cargar el siniestro para obtener business_line_id
  const { data: claim } = useQuery({
    queryKey: ["claim-for-docs", claimId],
    queryFn: async () => {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("claims")
        .select("business_line_id")
        .eq("id", claimId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!claimId,
  });

  // Cargar documentos disponibles para la línea de negocio
  const { data: requirements, isLoading: loadingReq } = useQuery({
    queryKey: ["document-requirements", claim?.business_line_id],
    queryFn: () => getDocumentRequirements(claim?.business_line_id || undefined),
    enabled: !!claim?.business_line_id,
  });

  // Cargar solicitudes existentes para saber qué ya se solicitó
  const { data: existingRequests, isLoading: loadingEx } = useQuery({
    queryKey: ["claim-doc-requests", claimId],
    queryFn: () => getClaimDocumentRequests(claimId!),
    enabled: !!claimId,
  });

  // Cargar solicitud existente para esta acción
  const { data: existingRequest } = useQuery({
    queryKey: ["claim-doc-request-by-action", actionId],
    queryFn: () => getClaimDocumentRequestByAction(actionId!),
    enabled: !!actionId,
  });

  const queryClient = useQueryClient();

  // Items ya solicitados (de todas las solicitudes) — para no mostrarlos again
  const alreadyRequestedCodes = new Set<string>();
  existingRequests?.forEach((r) => {
    r.claim_document_request_items?.forEach((item) => {
      if (item.status === "requested" || item.status === "received") {
        alreadyRequestedCodes.add(item.document_type_code);
      }
    });
  });

  // Documentos disponibles = requirements - ya solicitados/recibidos
  const availableDocs = (requirements || []).filter(
    (r) => !alreadyRequestedCodes.has(r.document_type_code)
  );

  // Items ya solicitados en esta acción
  const existingItems = existingRequest?.claim_document_request_items || [];

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<string>(existingRequest?.notes || "");

  const saveMut = useMutation({
    mutationFn: async () => {
      const items = availableDocs
        .filter((d) => selected.has(d.document_type_code))
        .map((d, i) => ({
          document_type_code: d.document_type_code,
          document_name: d.document_name,
          sort_order: i + 1,
        }));
      if (items.length === 0) {
        throw new Error("Selecciona al menos un documento para solicitar");
      }
      await createClaimDocumentRequest({
        claim_id: claimId!,
        claim_action_id: actionId,
        notes,
        items,
      });
    },
    onSuccess: () => {
      toast.success("Solicitud de documentos creada");
      queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
      queryClient.invalidateQueries({ queryKey: ["claim-doc-request-by-action", actionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Si hay solicitud existente, mostrar sus items
  if (loadingReq || loadingEx) {
    return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
  }

  // Si ya existe solicitud para esta acción, mostrar resumen
  if (existingRequest) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-[11px]">
          <span className="font-medium">Solicitud: {existingRequest.request_number}</span>
          <Badge className={
            existingRequest.status === "closed" ? "bg-emerald-100 text-emerald-700" :
            existingRequest.status === "cancelled" ? "bg-rose-100 text-rose-700" :
            existingRequest.status === "received" ? "bg-blue-100 text-blue-700" :
            "bg-amber-100 text-amber-700"
          }>
            {existingRequest.status === "requested" ? "Solicitada" :
             existingRequest.status === "received" ? "Recibida" :
             existingRequest.status === "closed" ? "Cerrada" : "Cancelada"}
          </Badge>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="app-data-table">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Documento</th>
                <th className="px-2 py-1.5 text-left font-medium w-[100px]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {existingItems.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-2 py-1.5">{item.document_name}</td>
                  <td className="px-2 py-1.5">
                    <Badge className={
                      item.status === "received" ? "bg-emerald-100 text-emerald-700" :
                      item.status === "not_needed" ? "bg-muted text-muted-foreground" :
                      "bg-amber-100 text-amber-700"
                    }>
                      {item.status === "received" ? "Recibido" :
                       item.status === "not_needed" ? "No necesario" : "Solicitado"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {existingRequest.notes && (
          <p className="text-[10px] text-muted-foreground italic">{existingRequest.notes}</p>
        )}
      </div>
    );
  }

  if (availableDocs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          No hay documentos pendientes para solicitar. Todos los documentos ya fueron solicitados o recibidos.
        </p>
      </div>
    );
  }

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-muted-foreground">
        Selecciona los documentos a solicitar. Solo se muestran los que no han sido solicitados o recibidos.
      </p>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="app-data-table">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1.5 w-8"></th>
              <th className="px-2 py-1.5 text-left font-medium">Documento</th>
              <th className="px-2 py-1.5 text-left font-medium w-[80px]">Obligatorio</th>
            </tr>
          </thead>
          <tbody>
            {availableDocs.map((doc) => (
              <tr
                key={doc.id}
                className={`border-t border-border cursor-pointer transition-colors ${
                  selected.has(doc.document_type_code) ? "bg-primary/5" : "hover:bg-muted/30"
                }`}
                onClick={() => !readOnly && toggle(doc.document_type_code)}
              >
                <td className="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(doc.document_type_code)}
                    readOnly={readOnly}
                    onChange={() => {}}
                    className="h-3.5 w-3.5 rounded border-border"
                  />
                </td>
                <td className="px-2 py-1.5">{doc.document_name}</td>
                <td className="px-2 py-1.5">
                  {doc.is_required && (
                    <span className="text-[9px] text-rose-600 font-medium">Obligatorio</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <Label className="app-field-label text-[10px]">Notas de la solicitud</Label>
        <Textarea
          className="app-input text-[11px] min-h-[50px]"
          placeholder="Indicaciones para el asegurado o corredor..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={readOnly}
        />
      </div>
      {!readOnly && (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn-save btn-sm"
            disabled={saveMut.isPending || selected.size === 0}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Guardando" : "Solicitar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Recepción de Documentos
// Controla la recepción de los documentos solicitados.
// Se cierra cuando todos están recibidos o no necesarios.
// ═══════════════════════════════════════════════════════════════

function DocumentReceiptView({ claimId, readOnly }: { claimId?: string; actionId?: string; readOnly?: boolean }) {
  // Cargar la solicitud de documentos más reciente del siniestro
  const { data: requests, isLoading } = useQuery({
    queryKey: ["claim-doc-requests", claimId],
    queryFn: () => getClaimDocumentRequests(claimId!),
    enabled: !!claimId,
  });

  // Tomar la solicitud más reciente que no esté cerrada/cancelada
  const activeRequest = requests?.find(
    (r) => r.status === "requested" || r.status === "received"
  ) || requests?.[0] || null;

  const queryClient = useQueryClient();

  const [itemStatuses, setItemStatuses] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});
  const lastRequestIdRef = useRef<string | undefined>(undefined);

  // Reset state when activeRequest changes (React-recommended pattern: adjust state during render, not in effect)
  if (activeRequest?.id !== lastRequestIdRef.current) {
    lastRequestIdRef.current = activeRequest?.id;
    if (activeRequest?.claim_document_request_items) {
      const statuses: Record<string, string> = {};
      const notes: Record<string, string> = {};
      activeRequest.claim_document_request_items.forEach((item) => {
        statuses[item.id] = item.status;
        notes[item.id] = item.notes || "";
      });
      setItemStatuses(statuses);
      setItemNotes(notes);
    }
  }

  const items = activeRequest?.claim_document_request_items || [];

  const updateItemMut = useMutation({
    mutationFn: async ({ itemId, status, notes }: { itemId: string; status: string; notes?: string }) => {
      await updateClaimDocumentRequestItem(itemId, { status, notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: async () => {
      // Actualizar todos los items con los estados actuales
      for (const item of items) {
        const newStatus = itemStatuses[item.id];
        if (newStatus && newStatus !== item.status) {
          await updateClaimDocumentRequestItem(item.id, {
            status: newStatus,
            notes: itemNotes[item.id] || null,
          });
        }
      }
      if (activeRequest) {
        await closeClaimDocumentRequest(activeRequest.id);
      }
    },
    onSuccess: () => {
      toast.success("Solicitud cerrada");
      queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
  }

  if (!activeRequest) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          No hay solicitudes de documentos para este siniestro. Crea una solicitud primero.
        </p>
      </div>
    );
  }

  const allResolved = items.every(
    (item) => itemStatuses[item.id] === "received" || itemStatuses[item.id] === "not_needed"
  );

  const updateStatus = (itemId: string, status: string) => {
    setItemStatuses((prev) => ({ ...prev, [itemId]: status }));
    updateItemMut.mutate({ itemId, status });
  };

  const updateNotes = (itemId: string, notes: string) => {
    setItemNotes((prev) => ({ ...prev, [itemId]: notes }));
  };

  return (
    <div className="space-y-2">
      {/* Info de la solicitud */}
      <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-[11px]">
        <span className="font-medium">Solicitud: {activeRequest.request_number}</span>
        <Badge className={
          activeRequest.status === "closed" ? "bg-emerald-100 text-emerald-700" :
          activeRequest.status === "cancelled" ? "bg-rose-100 text-rose-700" :
          activeRequest.status === "received" ? "bg-blue-100 text-blue-700" :
          "bg-amber-100 text-amber-700"
        }>
          {activeRequest.status === "requested" ? "Solicitada" :
           activeRequest.status === "received" ? "Recibida" :
           activeRequest.status === "closed" ? "Cerrada" : "Cancelada"}
        </Badge>
      </div>

      {activeRequest.notes && (
        <p className="text-[10px] text-muted-foreground italic">{activeRequest.notes}</p>
      )}

      {/* Tabla de items */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="app-data-table">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium">Documento</th>
              <th className="px-2 py-1.5 text-left font-medium w-[120px]">Estado</th>
              <th className="px-2 py-1.5 text-left font-medium w-[180px]">Notas</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const currentStatus = itemStatuses[item.id] || item.status;
              return (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-2 py-1.5 font-medium">{item.document_name}</td>
                  <td className="px-2 py-1.5">
                    {readOnly || activeRequest.status === "closed" ? (
                      <Badge className={
                        currentStatus === "received" ? "bg-emerald-100 text-emerald-700" :
                        currentStatus === "not_needed" ? "bg-muted text-muted-foreground" :
                        "bg-amber-100 text-amber-700"
                      }>
                        {currentStatus === "received" ? "Recibido" :
                         currentStatus === "not_needed" ? "No necesario" : "Pendiente"}
                      </Badge>
                    ) : (
                      <select
                        className="app-input h-7 text-[10px] w-full"
                        value={currentStatus}
                        onChange={(e) => updateStatus(item.id, e.target.value)}
                      >
                        <option value="requested">Pendiente</option>
                        <option value="received">Recibido</option>
                        <option value="not_needed">No necesario</option>
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    {readOnly || activeRequest.status === "closed" ? (
                      <span className="text-[10px] text-muted-foreground">{itemNotes[item.id] || item.notes || "—"}</span>
                    ) : (
                      <Input
                        className="app-input h-7 text-[10px] w-full"
                        value={itemNotes[item.id] || ""}
                        onChange={(e) => updateNotes(item.id, e.target.value)}
                        placeholder="Notas..."
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botón cerrar */}
      {!readOnly && activeRequest.status !== "closed" && activeRequest.status !== "cancelled" && (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="btn-cancel btn-sm"
            disabled={closeMut.isPending}
            onClick={() => {
              if (confirm("¿Cancelar esta solicitud de documentos?")) {
                cancelClaimDocumentRequest(activeRequest.id).then(() => {
                  toast.success("Solicitud cancelada");
                  queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
                });
              }
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-save btn-sm"
            disabled={closeMut.isPending || !allResolved}
            onClick={() => closeMut.mutate()}
            title={allResolved ? "Cerrar solicitud" : "Todos los items deben estar recibidos o no necesarios"}
          >
            {closeMut.isPending ? "Cerrando" : "Cerrar"}
          </button>
        </div>
      )}

      {activeRequest.status === "closed" && (
        <p className="text-[10px] text-emerald-600 text-center font-medium">
          ✓ Solicitud cerrada — {activeRequest.closed_at && new Date(activeRequest.closed_at).toLocaleDateString("es-CL")}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Cadena: Coordinación de Inspección → Inspección
// ═══════════════════════════════════════════════════════════════

function InspectionCoordinationView({ claimId, readOnly, action }: { claimId?: string; actionId?: string; readOnly?: boolean; action?: ActionWithRelations }) {
  const queryClient = useQueryClient();

  // Cargar inspecciones existentes del siniestro
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions", claimId],
    queryFn: () => getInspectionSessions(claimId!),
    enabled: !!claimId,
  });

  // Cargar inspectores disponibles
  const { data: inspectors } = useQuery({
    queryKey: ["users-by-roles", ["inspector", "adjuster"]],
    queryFn: () => getUsersByRoles(["inspector", "adjuster"]),
  });

  const activeSession = sessions?.find((s) => s.status === "scheduled" || s.status === "active") || null;

  const [inspectionType, setInspectionType] = useState<"onsite" | "remote">("onsite");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const createMut = useMutation({
    mutationFn: async () => {
      if (!claimId) throw new Error("Sin siniestro");
      if (!scheduledDate || !scheduledTime) throw new Error("Fecha y hora son obligatorias");
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      await createInspectionSession(claimId, {
        inspectionType,
        scheduledAt,
        inspectorId: inspectorId || undefined,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
        contactEmail: contactEmail || undefined,
        inspectionLocation: location || undefined,
        schedulingNotes: notes || undefined,
        actionTemplateId: action?.action_template_id || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Inspección agendada");
      queryClient.invalidateQueries({ queryKey: ["inspection-sessions", claimId] });
      setScheduledDate("");
      setScheduledTime("");
      setInspectorId("");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setLocation("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
  }

  // Si ya hay una inspección activa, mostrarla
  if (activeSession) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-[12px] font-semibold text-emerald-700 dark:text-emerald-400">
              Inspección {activeSession.status === "scheduled" ? "agendada" : "en curso"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted-foreground">Tipo:</span> {activeSession.inspection_type === "onsite" ? "Presencial" : "Remota"}
            </div>
            <div>
              <span className="text-muted-foreground">Fecha:</span> {activeSession.scheduled_at ? new Date(activeSession.scheduled_at).toLocaleString("es-CL") : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Contacto:</span> {activeSession.interviewed_name || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Estado:</span> <Badge variant="outline" className="text-[10px] h-4">{activeSession.status}</Badge>
            </div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Esta inspección está disponible en la gestión de Inspección.
        </p>
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          No se ha agendado inspección.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px]">Tipo de Inspección</Label>
          <select
            className="app-input h-7 text-[12px] mt-1"
            value={inspectionType}
            onChange={(e) => setInspectionType(e.target.value as "onsite" | "remote")}
          >
            <option value="onsite">Presencial</option>
            <option value="remote">Remota</option>
          </select>
        </div>
        <div>
          <Label className="text-[11px]">Inspector</Label>
          <Select
            value={inspectorId || "__none"}
            onValueChange={(v) => setInspectorId(v && v !== "__none" ? v : "")}
            items={[
              { value: "__none", label: "Sin asignar" },
              ...(inspectors?.map((insp) => ({ value: insp.id, label: insp.full_name })) || []),
            ]}
          >
            <SelectTrigger className="app-input h-7 text-[12px] mt-1">
              <SelectValue placeholder="Sin asignar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sin asignar</SelectItem>
              {inspectors?.map((insp) => (
                <SelectItem key={insp.id} value={insp.id}>{insp.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px]">Fecha <span className="text-red-500">*</span></Label>
          <Input
            type="date"
            className="app-input h-7 text-[12px] mt-1"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
        </div>
        <div>
          <Label className="text-[11px]">Hora <span className="text-red-500">*</span></Label>
          <Input
            type="time"
            className="app-input h-7 text-[12px] mt-1"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            min="06:00"
            max="22:00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px]">Nombre Contacto</Label>
          <Input
            className="app-input h-7 text-[12px] mt-1"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Persona en el lugar"
          />
        </div>
        <div>
          <Label className="text-[11px]">Teléfono Contacto</Label>
          <Input
            className="app-input h-7 text-[12px] mt-1"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="+56 9 ..."
          />
        </div>
      </div>

      <div>
        <Label className="text-[11px]">Email Contacto</Label>
        <Input
          className="app-input h-7 text-[12px] mt-1"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="email@ejemplo.cl"
        />
      </div>

      <div>
        <Label className="text-[11px]">Lugar de Inspección</Label>
        <Input
          className="app-input h-7 text-[12px] mt-1"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Dirección donde se realizará la inspección"
        />
      </div>

      <div>
        <Label className="text-[11px]">Notas</Label>
        <Textarea
          className="app-input text-[12px] mt-1 min-h-[60px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Instrucciones especiales..."
        />
      </div>

      <button
        className="btn-save btn-sm"
        disabled={createMut.isPending || !scheduledDate || !scheduledTime}
        onClick={() => createMut.mutate()}
      >
        {createMut.isPending ? "Agendando..." : "Agendar"}
      </button>
    </div>
  );
}

function InspectionSessionView({ claimId }: { claimId?: string; readOnly?: boolean }) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["inspection-sessions", claimId],
    queryFn: () => getInspectionSessions(claimId!),
    enabled: !!claimId,
  });

  if (isLoading) {
    return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-6 text-center">
        <p className="text-[11px] text-muted-foreground">
          No hay inspecciones registradas. Completa primero la Coordinación de Inspección.
        </p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    scheduled: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400",
    active: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
    completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
    cancelled: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400",
  };

  const statusLabels: Record<string, string> = {
    scheduled: "Agendada",
    active: "En Curso",
    completed: "Completada",
    cancelled: "Cancelada",
  };

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div key={session.id} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold">
                {session.inspection_number || `Inspección`}
              </span>
              <Badge variant="outline" className={`text-[10px] h-4 ${statusColors[session.status] || ""}`}>
                {statusLabels[session.status] || session.status}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {session.inspection_type === "onsite" ? "Presencial" : "Remota"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <span className="text-muted-foreground">Agendada:</span>{" "}
              {session.scheduled_at ? new Date(session.scheduled_at).toLocaleString("es-CL") : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Iniciada:</span>{" "}
              {session.started_at ? new Date(session.started_at).toLocaleString("es-CL") : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Finalizada:</span>{" "}
              {session.ended_at ? new Date(session.ended_at).toLocaleString("es-CL") : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Contacto:</span> {session.interviewed_name || "—"}
            </div>
          </div>

          {session.inspector_observations && (
            <div className="text-[11px] text-muted-foreground border-t border-border pt-2">
              <span className="font-medium">Observaciones:</span> {session.inspector_observations}
            </div>
          )}

          {session.status === "cancelled" && session.cancellation_notes && (
            <div className="text-[11px] text-rose-600 border-t border-border pt-2">
              <span className="font-medium">Cancelación:</span> {session.cancellation_notes}
            </div>
          )}

          {session.status === "completed" && (
            <div className="border-t border-border pt-2 flex gap-2">
              <a
                href={`/dashboard/claims/${claimId}/inspeccion/${session.id}`}
                className="text-[11px] text-sky-600 hover:underline"
              >
                Ver detalles →
              </a>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
