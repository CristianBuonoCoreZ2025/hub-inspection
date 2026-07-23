"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { DatePicker } from "@/components/ui/date-picker";
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
 addItemsToClaimDocumentRequest,
 removeItemFromClaimDocumentRequest,
 updateClaimDocumentRequestNotes,
} from "@/services/claim-documents";
import { getPolicyCoveragesByPolicyId } from "@/services/policies";
import { getClaimById, getClaimParticipants } from "@/services/claims";
import { updateClaimAction, issueClaimAction } from "@/services/claim-actions";
import { getUsersByRoleForCompany } from "@/services/users";
import { getInspectionSessions, getInspectorSchedule } from "@/services/inspections";
import { getCoverageCatalog } from "@/services/coverage-catalog";
import { getLookupCatalog } from "@/services/catalogs";
import { getDocumentTemplates, type DocumentTemplate } from "@/services/document-templates";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Plus, Ban, ChevronDown, Check, CheckCircle, X, FileText, Download, Loader2, Play, Upload, History, Lock, FileSpreadsheet, Presentation, File as FileIcon, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ClaimAction, Claim, ClaimsParticipant } from "@/types";
import type { GestionScreenProps } from "./types";

// ClaimAction extendido con relaciones que vienen de GraphQL pero no están en el tipo base
type ActionWithRelations = ClaimAction & {
 created_at?: string;
 updated_at?: string;
};

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

export type FieldWidth = "full" | "half" | "third" | "quarter" | "fifth" | "sixth";

export type FieldCategory = "own" | "simple_entity" | "complex_entity";

export interface DateValidation {
 type: "greater_than" | "less_than" | "equal_to" | "greater_or_equal" | "less_or_equal" |
 "greater_than_today" | "less_than_today" | "equal_today";
 compareField?: string;
 label?: string;
}

// Regla de visibilidad / obligatoriedad condicional (genérica para todas las pantallas)
export interface VisibilityRule {
 field: string;                    // ID del campo controlador
 operator: "equals" | "not_equals" | "in" | "not_in";
 value: string | string[];
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
 // Configuración específica por tipo de campo complejo
 config?: Record<string, boolean | string | number>;
 // Reglas condicionales (genéricas para todas las pantallas dinámicas)
 visibilityRule?: VisibilityRule;   // cuándo mostrar el campo
 requiredRule?: VisibilityRule;     // cuándo el campo es obligatorio (override de required)
}

// ═══════════════════════════════════════════════════════════════
// Helpers de reglas condicionales
// ═══════════════════════════════════════════════════════════════

export function evalRule(rule: VisibilityRule, values: Record<string, unknown>): boolean {
 const ctrlValue = String(values[rule.field] ?? "").toLowerCase();
 const ruleValue = rule.value;
 switch (rule.operator) {
 case "equals":
 return ctrlValue === String(ruleValue).toLowerCase();
 case "not_equals":
 return ctrlValue !== String(ruleValue).toLowerCase();
 case "in":
 return Array.isArray(ruleValue) && ruleValue.some(v => ctrlValue === String(v).toLowerCase());
 case "not_in":
 return Array.isArray(ruleValue) && !ruleValue.some(v => ctrlValue === String(v).toLowerCase());
 default:
 return true;
 }
}

export function isFieldVisible(field: ScreenField, values: Record<string, unknown>): boolean {
 if (!field.visibilityRule) return true;
 return evalRule(field.visibilityRule, values);
}

export function isFieldRequired(field: ScreenField, values: Record<string, unknown>): boolean {
 if (field.requiredRule) return evalRule(field.requiredRule, values);
 return !!field.required;
}

// Config del campo claim_document_receipt (Recepción de Documentos)
export interface ReceiptFieldConfig {
 // Bloquear emisión manual hasta que todos los documentos estén resueltos
 blockEmitUntilAllResolved?: boolean;
 // "No necesario" requiere motivo obligatorio
 notNeededRequiresReason?: boolean;
 // "No necesario" solo lo pueden marcar los emisores del combo
 notNeededOnlyIssuers?: boolean;
}


export function widthClass(width: FieldWidth = "full"): string {
 switch (width) {
 case "full": return "col-span-[60]";
 case "half": return "col-span-[30]";
 case "third": return "col-span-[20]";
 case "quarter": return "col-span-[15]";
 case "fifth": return "col-span-[12]";
 case "sixth": return "col-span-[10]";
 default: return "col-span-[60]";
 }
}

export interface DynamicScreenProps extends GestionScreenProps {
 fields: ScreenField[];
}

// ═══════════════════════════════════════════════════════════════
// Hook: useAutoSave — autoguardado con debounce tipo Excel
// ═══════════════════════════════════════════════════════════════
function useAutoSave(
 saveFn: () => void,
 deps: unknown[],
 enabled: boolean,
 delay = 500
) {
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const isFirstRef = useRef(true);

 useEffect(() => {
 if (!enabled) return;
 // Saltar el primer render (carga inicial)
 if (isFirstRef.current) {
 isFirstRef.current = false;
 return;
 }
 if (timerRef.current) clearTimeout(timerRef.current);
 timerRef.current = setTimeout(() => saveFn(), delay);
 return () => {
 if (timerRef.current) clearTimeout(timerRef.current);
 };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, deps);
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
 { code: "checkbox", label: "Toggle", icon: "⊙", desc: "Interruptor on/off" },
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
 // ═══ Cards agrupadas del siniestro (readonly, se muestran como card completo) ═══
 { code: "claim_insured_card", label: "Card Asegurado", icon: "👤", desc: "Datos completos del asegurado (card agrupada)" },
 { code: "claim_address_card", label: "Card Dirección Siniestro", icon: "📍", desc: "Dirección completa del siniestro (card agrupada)" },
 { code: "claim_contact_card", label: "Card Persona de Contacto", icon: "📞", desc: "Persona de contacto del siniestro (card agrupada)" },
 // ═══ Campos individuales del Asegurado (tras desagrupar card) ═══
 { code: "insured_rut", label: "RUT Asegurado", icon: "#", desc: "RUT del asegurado" },
 { code: "insured_person_type", label: "Tipo Persona", icon: "👤", desc: "Tipo de persona del asegurado" },
 { code: "insured_first_name", label: "Nombre Asegurado", icon: "👤", desc: "Nombre del asegurado" },
 { code: "insured_last_name", label: "Apellido Asegurado", icon: "👤", desc: "Apellido del asegurado" },
 { code: "insured_email", label: "Email Asegurado", icon: "✉", desc: "Email del asegurado" },
 { code: "insured_phone", label: "Teléfono Asegurado", icon: "📞", desc: "Teléfono del asegurado" },
 { code: "insured_address", label: "Dirección Asegurado", icon: "📍", desc: "Dirección del asegurado" },
 { code: "insured_country", label: "País Asegurado", icon: "🌍", desc: "País del asegurado" },
 { code: "insured_region", label: "Región Asegurado", icon: "🗺", desc: "Región del asegurado" },
 { code: "insured_city", label: "Ciudad Asegurado", icon: "🏙", desc: "Ciudad del asegurado" },
 { code: "insured_commune", label: "Comuna Asegurado", icon: "🏘", desc: "Comuna del asegurado" },
 // ═══ Campos individuales de la Dirección del Siniestro (tras desagrupar card) ═══
 { code: "claim_destination_housing", label: "Tipo Vivienda", icon: "🏠", desc: "Tipo de vivienda del siniestro" },
 { code: "claim_country", label: "País Siniestro", icon: "🌍", desc: "País del siniestro" },
 { code: "claim_region", label: "Región Siniestro", icon: "🗺", desc: "Región del siniestro" },
 { code: "claim_city", label: "Ciudad Siniestro", icon: "🏙", desc: "Ciudad del siniestro" },
 { code: "claim_commune", label: "Comuna Siniestro", icon: "🏘", desc: "Comuna del siniestro" },
 // ═══ Campos individuales de la Persona de Contacto (tras desagrupar card) ═══
 { code: "contact_first_name", label: "Nombre Contacto", icon: "👤", desc: "Nombre del contacto" },
 { code: "contact_last_name", label: "Apellido Contacto", icon: "👤", desc: "Apellido del contacto" },
 { code: "contact_email", label: "Email Contacto", icon: "✉", desc: "Email del contacto" },
 { code: "contact_phone", label: "Teléfono Contacto", icon: "📞", desc: "Teléfono del contacto" },
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

export default function DynamicScreen({ action, fields, onChange, readOnly, onAdvance, onReject, screenCode }: DynamicScreenProps) {
 // Aplanar parent_action_data: los campos del padre (ej: CIN) se exponen
 // en values para que la pantalla hija (ej: INS) pueda leerlos directamente.
 // Los campos propios del hijo (top level) tienen prioridad sobre los del padre.
 const rawValues = (action.action_data || {}) as Record<string, unknown>;
 const parentData = (rawValues.parent_action_data || {}) as Record<string, unknown>;
 const values = { ...parentData, ...rawValues };

 // ── Inyectar campos universales de fecha si no están en el form_schema ──
 // Fecha Creación y Actualización NO se inyectan como campos — se muestran
 // siempre en el header del panel "Datos de la Gestión" en formato 24h
 // (horario militar), definido más abajo en el render.
 // "Compromiso Término" SOLO se inyecta en pantallas genéricas (sin code específico).
 // En pantallas específicas (coordinacion, ajuste, indemnizacion, etc.) NO se muestra
 // porque la fecha de compromiso = fecha máxima de ejecución según config de la gestión.
 const injectedFields: ScreenField[] = [];
 const hasField = (id: string) => fields.some((f) => f.id === id);

 // Pantallas genéricas: sin code, o code = "generica" / "default" / "estandar"
 const isGenericScreen = !screenCode || ["generica", "default", "estandar", "generic"].includes(screenCode.toLowerCase());

 // Compromiso Término: solo en pantallas genéricas
 if (isGenericScreen && !hasField("inf_compromiso")) {
 injectedFields.push({ id: "inf_compromiso", category: "own", type: "date", label: "Compromiso Término", width: "half" });
 }
 const allFields = [...injectedFields, ...fields];

 // Cargar siniestro para entidades de tipo claim_* y para precargar inspector en coordinación
 const hasClaimEntities = allFields.some((f) => CLAIM_ENTITIES.some((e) => e.code === f.type));
 const hasCoordInspector = allFields.some((f) => f.id === "coord_inspector");
 const { data: claim } = useQuery({
 queryKey: ["claim", action.claim_id],
 queryFn: () => getClaimById(action.claim_id),
 enabled: (hasClaimEntities || hasCoordInspector) && !!action.claim_id,
 });

 // Cargar participantes del siniestro (para cards agrupadas: asegurado, contacto)
 const hasClaimCardEntities = allFields.some((f) => f.type === "claim_insured_card" || f.type === "claim_contact_card");
 const { data: claimParticipants } = useQuery({
 queryKey: ["claim-participants", action.claim_id],
 queryFn: () => getClaimParticipants(action.claim_id),
 enabled: hasClaimCardEntities && !!action.claim_id,
 });

 // Cargar reserva del siniestro (para entidades reserve_currency, reserve_payment_date, reserve_number)
 const hasReserveEntities = allFields.some((f) => f.type === "reserve_currency" || f.type === "reserve_payment_date" || f.type === "reserve_number");
 const { data: reserves } = useQuery({
 queryKey: ["claim-reserves", action.claim_id],
 queryFn: () => getClaimReserves(action.claim_id),
 enabled: hasReserveEntities && !!action.claim_id,
 });
 const reserveData = reserves && reserves.length > 0 ? reserves[0] : null;

 const updateValue = (id: string, value: unknown) => {
 onChange?.({ ...values, [id]: value });
 };

 // Precargar inspector del siniestro si el campo coord_inspector está vacío
 useEffect(() => {
 if (hasCoordInspector && claim?.inspector_id && !values.coord_inspector) {
 onChange?.({ ...values, coord_inspector: claim.inspector_id });
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [claim?.inspector_id, hasCoordInspector]);

 // Separar campos por categoría (usar allFields para incluir los inyectados)
 // actionEntities = entidades de la gestión (action_*)
 // otherEntities = entidades del siniestro (claim_*, insured_*, card_*) + otras no clasificadas
 //   NOTA: NO se excluyen CLAIM_ENTITIES — esos campos (claim_address_card,
 //   claim_contact_card, insured_*, etc.) DEBEN caer aquí para renderizarse.
 const actionEntities = allFields.filter((f) => f.category === "simple_entity" && ACTION_ENTITIES.some((e) => e.code === f.type));
 const otherEntities = allFields.filter((f) => f.category === "simple_entity" && !ACTION_ENTITIES.some((e) => e.code === f.type));
 // review_levels se renderiza siempre al final, sin importar si está en los campos configurados
 const complexEntities = allFields.filter((f) => f.category === "complex_entity" && f.type !== "review_levels");
 const ownFields = allFields.filter((f) => f.category === "own");

 // Si la pantalla tiene reserva o ajuste, los campos de moneda/fecha/reserva van arriba del form
 // → quitarlos de los own fields para no duplicarlos
 const hasReserveForm = complexEntities.some((f) => f.type === "claim_reserve_form");
 const hasAdjustmentForm = complexEntities.some((f) => f.type === "claim_adjustment_form");

 // Own fields: quitar los que ya están en los forms superiores de reserva/ajuste
 const hiddenOwnFields = new Set<string>();
 if (hasReserveForm) {
 hiddenOwnFields.add("reserve_currency");
 hiddenOwnFields.add("reserve_payment_date");
 hiddenOwnFields.add("reserve_notes");
 }
 if (hasAdjustmentForm) {
 hiddenOwnFields.add("adjustment_date");
 hiddenOwnFields.add("adjustment_notes");
 }
 const filteredOwnFields = ownFields.filter((f) => !hiddenOwnFields.has(f.id));

 // Ordenar entidades complejas:
 // 1. claim_coverages primero
 // 2. inspection_coordination segundo (antes que review_levels)
 // 3. resto de entidades complejas
 // 4. claim_documents / document_templates (Fuentes) y claim_history (Historia) VAN AL FINAL (abajo del form)
 const BOTTOM_ENTITIES = new Set(["claim_documents", "document_templates", "claim_history"]);
 const topComplexEntities = complexEntities.filter((f) => !BOTTOM_ENTITIES.has(f.type));
 const bottomComplexEntities = complexEntities.filter((f) => BOTTOM_ENTITIES.has(f.type));

 const PRIORITY_ORDER = ["claim_coverages", "inspection_coordination"];
 const sortedComplexEntities = [...topComplexEntities].sort((a, b) => {
 const ia = PRIORITY_ORDER.indexOf(a.type);
 const ib = PRIORITY_ORDER.indexOf(b.type);
 const pa = ia === -1 ? PRIORITY_ORDER.length : ia;
 const pb = ib === -1 ? PRIORITY_ORDER.length : ib;
 if (pa !== pb) return pa - pb;
 return 0;
 });

 // ── Validación de campos obligatorios ──
 // Verifica que todos los campos obligatorios (según `required` o `requiredRule`)
 // tengan valor, respetando la visibilidad condicional (`visibilityRule`).
 // Se usa para bloquear el botón "Emitir" hasta que la gestión esté completa.
 const missingRequired = allFields.filter((f) => f.category === "own").filter((f) => {
 // Si el campo no es visible según su visibilityRule, no se valida
 if (!isFieldVisible(f, values)) return false;
 // Si el campo no es obligatorio según requiredRule o required, no se valida
 if (!isFieldRequired(f, values)) return false;
 const v = values[f.id];
 return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
 });
 const requiredFieldsComplete = missingRequired.length === 0;

 return (
 <div className="space-y-3">
 {/* ─── Barra de fechas (siempre visible, horario militar 24h) ─── */}
 <div className="grid grid-cols-2 gap-3 text-[10px] text-muted-foreground px-1 pb-1">
 <div>
 <span>Creación: </span>
 <span className="font-mono">{action.created_on ? new Date(action.created_on).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</span>
 </div>
 <div>
 <span>Actualización: </span>
 <span className="font-mono">{action.updated_on ? new Date(action.updated_on).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</span>
 </div>
 </div>

 {/* ─── Entidades complejas (coberturas primero, review_levels al final) ─── */}
 {sortedComplexEntities.length > 0 && (
 <div className="space-y-3">
 {sortedComplexEntities.map((field) => (
 <section key={field.id} className="app-panel p-2.5">
 <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">{field.label}</h4>
 <ComplexEntityView type={field.type} field={field} action={action} readOnly={readOnly} values={values} onAdvance={onAdvance} onReject={onReject} onChange={onChange} />
 </section>
 ))}
 </div>
 )}

 {/* ─── Datos de la gestión (entidades de acción) ─── */}
 {actionEntities.length > 0 && (
 <section className="app-panel p-2.5">
 <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-2.5">
 {actionEntities.map((field) => {
 if (!isFieldVisible(field, values)) return null;
 return (
 <div key={field.id} className={widthClass(field.width)}>
 <EntityField field={field} value={values[field.id]} action={action} reserveData={reserveData} />
 </div>
 );
 })}
 </div>
 </section>
 )}

 {/* ─── Otras entidades simples (cards del siniestro, informativos) ─── */}
 {otherEntities.length > 0 && (
 <section className="app-panel p-2.5">
 <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-2.5">
 {otherEntities.map((field) => {
 if (!isFieldVisible(field, values)) return null;
 return (
 <div key={field.id} className={widthClass(field.width)}>
 <EntityField field={field} value={values[field.id]} action={action} reserveData={reserveData} claim={claim} claimParticipants={claimParticipants} />
 </div>
 );
 })}
 </div>
 </section>
 )}

 {/* ─── Formulario (campos propios) ─── */}
 {filteredOwnFields.length > 0 && (
 <section className="app-panel p-2.5">
 <div className="grid grid-cols-[repeat(60,minmax(0,1fr))] gap-2.5">
 {filteredOwnFields.map((field) => {
 // Visibilidad condicional genérica via visibilityRule
 if (!isFieldVisible(field, values)) return null;

 return (
 <div key={field.id} className={widthClass(field.width)}>
 <OwnField
 field={field}
 value={values[field.id]}
 allFields={fields}
 allValues={values}
 onChange={updateValue}
 readOnly={readOnly}
 action={action}
 />
 </div>
 );
 })}
 </div>
 </section>
 )}

 {/* ─── Entidades complejas al final (Fuentes / Historia) ─── */}
 {bottomComplexEntities.length > 0 && (
 <div className="space-y-4">
 {bottomComplexEntities.map((field) => (
 <CollapsibleBottomSection key={field.id} field={field} action={action} readOnly={readOnly} values={values} onAdvance={onAdvance} onReject={onReject} onChange={onChange} />
 ))}
 </div>
 )}

 {/* ─── Niveles de Revisión (SIEMPRE al final, en toda gestión) ─── */}
 {action.action_feature && (action.action_feature.has_issue || action.action_feature.has_review || action.action_feature.has_approve) && (
 <ReviewLevelsView
 action={action}
 onAdvance={onAdvance}
 onReject={onReject}
 receiptFieldConfig={(fields.find((f) => f.type === "claim_document_receipt")?.config || {}) as ReceiptFieldConfig}
 requiredFieldsComplete={requiredFieldsComplete}
 missingRequiredFields={missingRequired.map((f) => f.label || f.id)}
 />
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
 claim?: Claim | null;
 claimParticipants?: ClaimsParticipant[] | null;
}) {
 const isActionEntity = ACTION_ENTITIES.some((e) => e.code === field.type);
 const isReserveEntity = field.type === "reserve_currency" || field.type === "reserve_payment_date" || field.type === "reserve_number";
 const isClaimEntity = CLAIM_ENTITIES.some((e) => e.code === field.type);

 // Cards agrupadas del siniestro (readonly, estilo compacto 10px)
 if (field.type === "claim_insured_card") {
 const insured = claimParticipants?.find((p) => p.type === "insured");
 if (!insured) return <CardEmpty label={field.label} />;
 return (
 <div className="rounded-md border border-border/60 p-1.5 space-y-1 bg-muted/20">
 <p className="text-[10px] font-semibold text-muted-foreground">{field.label || "Datos del Asegurado"}</p>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-x-3 gap-y-0.5 text-[10px]">
 <div><span className="app-data-label">RUT</span><p className="font-medium truncate">{insured.rut || "—"}</p></div>
 <div><span className="app-data-label">Tipo</span><p className="font-medium">{insured.person_type === "legal" ? "P. Jurídica" : insured.person_type === "natural" ? "P. Natural" : "—"}</p></div>
 <div><span className="app-data-label">Nombre</span><p className="font-medium truncate">{insured.first_name || "—"}</p></div>
 <div><span className="app-data-label">Apellido</span><p className="font-medium truncate">{insured.last_name || "—"}</p></div>
 <div><span className="app-data-label">Email</span><p className="font-medium truncate">{insured.email || "—"}</p></div>
 <div><span className="app-data-label">Teléfono</span><p className="font-medium truncate">{insured.cell_phone || insured.phone || "—"}</p></div>
 <div className="col-span-2"><span className="app-data-label">Dirección</span><p className="font-medium truncate">{insured.address || "—"}</p></div>
 <div><span className="app-data-label">País</span><p className="font-medium truncate">{insured.country || "—"}</p></div>
 <div><span className="app-data-label">Región</span><p className="font-medium truncate">{insured.region || "—"}</p></div>
 <div><span className="app-data-label">Ciudad</span><p className="font-medium truncate">{insured.city || "—"}</p></div>
 <div><span className="app-data-label">Comuna</span><p className="font-medium truncate">{insured.commune || "—"}</p></div>
 </div>
 </div>
 );
 }

 if (field.type === "claim_address_card") {
 if (!claim) return <CardEmpty label={field.label} />;
 return (
 <div className="rounded-md border border-border/60 p-1.5 space-y-1 bg-muted/20">
 <p className="text-[10px] font-semibold text-muted-foreground">{field.label || "Dirección del Siniestro"}</p>
 <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px]">
 <div><span className="app-data-label">Dirección</span><p className="font-medium truncate">{claim.claim_address || "—"}</p></div>
 <div><span className="app-data-label">Tipo</span><p className="font-medium truncate">{claim.destination_housing?.name || "—"}</p></div>
 <div><span className="app-data-label">País</span><p className="font-medium truncate">{claim.country?.name || "—"}</p></div>
 <div><span className="app-data-label">Región</span><p className="font-medium truncate">{claim.region?.name || "—"}</p></div>
 <div><span className="app-data-label">Ciudad</span><p className="font-medium truncate">{claim.city?.name || "—"}</p></div>
 <div><span className="app-data-label">Comuna</span><p className="font-medium truncate">{claim.commune?.name || "—"}</p></div>
 </div>
 </div>
 );
 }

 if (field.type === "claim_contact_card") {
 const contact = claimParticipants?.find((p) => p.type === "contact");
 if (!contact) return <CardEmpty label={field.label} />;
 return (
 <div className="rounded-md border border-border/60 p-1.5 space-y-1 bg-muted/20">
 <p className="text-[10px] font-semibold text-muted-foreground">{field.label || "Persona de Contacto"}</p>
 <div className="grid grid-cols-4 gap-x-3 gap-y-0.5 text-[10px]">
 <div><span className="app-data-label">Nombre</span><p className="font-medium truncate">{contact.first_name || "—"}</p></div>
 <div><span className="app-data-label">Apellido</span><p className="font-medium truncate">{contact.last_name || "—"}</p></div>
 <div><span className="app-data-label">Email</span><p className="font-medium truncate">{contact.email || "—"}</p></div>
 <div><span className="app-data-label">Teléfono</span><p className="font-medium truncate">{contact.cell_phone || contact.phone || "—"}</p></div>
 </div>
 </div>
 );
 }

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
 <div className="flex flex-col gap-0.5">
 <Label className="text-[10px] text-muted-foreground">{field.label}</Label>
 <Input
 type="text"
 className="h-7 text-[10px] bg-muted/30 border-dashed border-border/60 px-2 text-muted-foreground"
 value={displayValue}
 readOnly
 placeholder={`Se completa automáticamente`}
 />
 </div>
 );
}

function CardEmpty({ label }: { label: string }) {
 return (
 <div className="rounded-lg border border-dashed border-border p-3 text-center">
 <p className="text-[12px] font-semibold text-muted-foreground">{label}</p>
 <p className="text-[10px] text-muted-foreground mt-1">Sin datos disponibles</p>
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

function getClaimEntityValue(type: string, claim?: Claim | null, participants?: ClaimsParticipant[] | null): string {
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
 // ═══ Campos individuales del Asegurado ═══
 case "insured_rut": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.rut || "—";
 }
 case "insured_person_type": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.person_type === "legal" ? "Persona Jurídica" : insured?.person_type === "natural" ? "Persona Natural" : "—";
 }
 case "insured_first_name": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.first_name || "—";
 }
 case "insured_last_name": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.last_name || "—";
 }
 case "insured_email": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.email || "—";
 }
 case "insured_phone": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.cell_phone || insured?.phone || "—";
 }
 case "insured_address": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.address || "—";
 }
 case "insured_country": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.country || "—";
 }
 case "insured_region": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.region || "—";
 }
 case "insured_city": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.city || "—";
 }
 case "insured_commune": {
 const insured = participants?.find((p) => p.type === "insured");
 return insured?.commune || "—";
 }
 // ═══ Campos individuales de la Dirección del Siniestro ═══
 case "claim_destination_housing":
 return claim.destination_housing?.name || "—";
 case "claim_country":
 return claim.country?.name || "—";
 case "claim_region":
 return claim.region?.name || "—";
 case "claim_city":
 return claim.city?.name || "—";
 case "claim_commune":
 return claim.commune?.name || "—";
 // ═══ Campos individuales de la Persona de Contacto ═══
 case "contact_first_name": {
 const contact = participants?.find((p) => p.type === "contact");
 return contact?.first_name || "—";
 }
 case "contact_last_name": {
 const contact = participants?.find((p) => p.type === "contact");
 return contact?.last_name || "—";
 }
 case "contact_email": {
 const contact = participants?.find((p) => p.type === "contact");
 return contact?.email || "—";
 }
 case "contact_phone": {
 const contact = participants?.find((p) => p.type === "contact");
 return contact?.cell_phone || contact?.phone || "—";
 }
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
 return action.created_on ? new Date(action.created_on).toLocaleString("es-CL") : String(fallback || "");
 case "action_updated_at":
 return action.updated_on ? new Date(action.updated_on).toLocaleString("es-CL") : String(fallback || "");
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

function ReviewLevelsView({ action, onAdvance, onReject, receiptFieldConfig, requiredFieldsComplete, missingRequiredFields }: { action: ActionWithRelations; onAdvance?: (level: "issuer" | "reviewer" | "approver") => void; onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void; receiptFieldConfig?: ReceiptFieldConfig; requiredFieldsComplete?: boolean; missingRequiredFields?: string[] }) {
 const feature = action.action_feature;
 const { profile } = useAuth();
 const tpl = action.action_template;

 // ── Bloqueo de emisión: si el campo claim_document_receipt tiene
 // blockEmitUntilAllResolved=true, no se puede emitir hasta que todos
 // los documentos estén resueltos (received o not_needed). ──
 const blockEmit = receiptFieldConfig?.blockEmitUntilAllResolved === true;
 // RTA necesita ver los items del request del claim (no de la acción RTA,
 // porque el request está asociado a la NSA que lo creó)
 const { data: rtaRequests } = useQuery({
 queryKey: ["claim-doc-requests", action.claim_id],
 queryFn: () => getClaimDocumentRequests(action.claim_id),
 enabled: blockEmit && !!feature && !!action.claim_id,
 });
 const rtaRequest = rtaRequests?.[0];
 const rtaItems = rtaRequest?.claim_document_request_items || [];
 const rtaAllResolved = blockEmit
 ? rtaItems.length > 0 && rtaItems.every((it) => it.status === "received" || it.status === "not_needed")
 : true;
 const rtaPendingCount = rtaItems.filter((it) => it.status === "requested").length;

 if (!feature) return null;

 const statusCode = action.action_status?.code || "todo";

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

 // Niveles: usar is_review_applicable/is_approval_applicable del template (por línea de negocio)
 // con fallback a has_review/has_approve del feature
 const hasReview = tpl?.is_review_applicable ?? feature.has_review;
 const hasApprove = tpl?.is_approval_applicable ?? feature.has_approve;

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

 if (hasReview) {
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

 if (hasApprove) {
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
 const isClosed = statusCode === "issued" && !hasReview && !hasApprove;

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
 claimId={action.claim_id}
 currentUserId={profile?.id || null}
 onAdvance={onAdvance}
 onReject={onReject}
 canIssue={level.key === "issuer" ? (rtaAllResolved && (requiredFieldsComplete !== false)) : undefined}
 issueBlockedReason={
 level.key === "issuer"
 ? (blockEmit && !rtaAllResolved
 ? `Faltan ${rtaPendingCount} documento(s) por recibir`
 : requiredFieldsComplete === false
 ? `Faltan campos obligatorios: ${(missingRequiredFields || []).join(", ")}`
 : undefined)
 : undefined
 }
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
 claimId,
 currentUserId,
 onAdvance,
 onReject,
 canIssue,
 issueBlockedReason,
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
 claimId: string;
 currentUserId: string | null;
 onAdvance?: (level: "issuer" | "reviewer" | "approver") => void;
 onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void;
 canIssue?: boolean;
 issueBlockedReason?: string;
}) {
 const queryClient = useQueryClient();
 const [showRejectBox, setShowRejectBox] = useState(false);
 const [rejectComment, setRejectComment] = useState("");
 const { data: candidates } = useQuery({
 queryKey: ["users-by-roles", level.roles, claimId],
 queryFn: async () => {
 const { getClaimById } = await import("@/services/claims");
 const claim = await getClaimById(claimId);
 const companyId = claim?.company_id;
 const { getUsersByRolesForCompany } = await import("@/services/users");
 return getUsersByRolesForCompany(level.roles, companyId);
 },
 enabled: level.roles.length > 0,
 });

 // Cargar los roles del claim (adjuster_id, inspector_id, etc.) para incluirlos como candidatos
 const { data: claimRoleHolders } = useQuery({
 queryKey: ["claim-role-holders", claimId, level.roles.join(",")],
 queryFn: async () => {
 const { getClaimById } = await import("@/services/claims");
 const claim = await getClaimById(claimId);
 if (!claim) return [];
 const roleMap: Record<string, string | null | undefined> = {
 adjuster: claim.adjuster_id,
 assigned_adjuster: claim.assigned_adjuster_id,
 assistant: claim.assistant_id,
 inspector: claim.inspector_id,
 auditor: claim.auditor_id,
 dispatcher: claim.dispatcher_id,
 };
 // Recoger los profileIds que corresponden a los roles del nivel
 const profileIds: string[] = [];
 for (const [role, profileId] of Object.entries(roleMap)) {
 if (!profileId) continue;
 if (!level.roles.includes(role)) continue;
 if (!profileIds.includes(profileId)) profileIds.push(profileId);
 }
 if (profileIds.length === 0) return [];
 // Cargar los profiles
 const { fetchAll } = await import("@/lib/supabase/db");
 const profiles = await fetchAll<{ id: string; full_name: string; email: string; role: string }>("profiles", {
 select: "id, full_name, email, role",
 in: { id: profileIds },
 eq: { is_active: true },
 });
 return profiles;
 },
 enabled: level.roles.length > 0 && !!claimId,
 });

 // Mutación para asignar responsable
 const assignMut = useMutation({
 mutationFn: (profileId: string) => {
 const field = level.key === "issuer" ? "issuer_id" : level.key === "reviewer" ? "reviewer_id" : "approver_id";
 return updateClaimAction(actionId, { [field]: profileId });
 },
 onSuccess: () => {
 toast.success("Responsable asignado");
 queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
 queryClient.invalidateQueries({ queryKey: ["claim-actions"] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 // Lista fusionada: usuarios por rol + holders del claim + responsable actual (sin duplicados)
 const allCandidates = useMemo(() => {
 const map = new Map<string, { id: string; full_name: string; email: string; role: string; source?: string }>();
 for (const c of (candidates || [])) map.set(c.id, c);
 for (const h of (claimRoleHolders || [])) {
 if (!map.has(h.id)) map.set(h.id, { ...h, source: undefined });
 }
 // Incluir siempre al responsable actual aunque no cumpla el rol
 if (level.currentId && !map.has(level.currentId)) {
 map.set(level.currentId, { id: level.currentId, full_name: level.personName, email: "", role: "", source: undefined });
 }
 return Array.from(map.values());
 }, [candidates, claimRoleHolders, level.currentId, level.personName]);

 const sty = level.done
 ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
 : level.active
 ? "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 ring-1 ring-blue-200 dark:ring-blue-800"
 : "bg-muted/40 text-muted-foreground";

 const isCurrentUser = !!currentUserId && !!level.currentId && currentUserId === level.currentId;
 const isCandidate = !!currentUserId && allCandidates.some(c => c.id === currentUserId);
 // Regla: solo el responsable actual puede emitir/revisar/aprobar.
 // Si no es el responsable pero está en el combo, puede asignarse a sí mismo
 // desde el select del LevelCard, y luego recién puede actuar.
 // Si no está en el combo, no puede asignarse ni actuar.
 // RTA: la emisión se bloquea hasta que todos los documentos estén resueltos.
 // Campos obligatorios: la emisión se bloquea hasta que todos estén completos,
 // pero el rechazo sigue disponible (se puede rechazar una gestión incompleta).
 const isIssueBlocked = level.key === "issuer" && canIssue === false;
 const canAct = isCurrentUser;
 const canReject = level.active && !level.done && !!onReject && canAct;
 const canAdvance = level.active && !level.done && !isIssueBlocked && !!onAdvance && canAct;

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
 {level.currentId ? (
 <span className="text-[10px] opacity-80">{level.personName}</span>
 ) : (
 <span className="text-[10px] opacity-50 italic">Por asignar</span>
 )}
 </div>
 {/* Panel de asignación cuando:
  - no hay responsable y la etapa está activa, o
  - hay responsable pero no es el usuario actual y el usuario actual está en el combo
    (puede reasignarse a sí mismo para poder actuar) */}
 {level.active && !level.done && (!level.currentId || (!isCurrentUser && isCandidate)) && (
 <div className="flex flex-col gap-1 pt-0.5">
 <select
 className="text-[10px] rounded border border-border bg-background px-1.5 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-blue-400"
 value=""
 onChange={(e) => {
 if (e.target.value) assignMut.mutate(e.target.value);
 }}
 disabled={assignMut.isPending}
 >
 <option value="" disabled>{level.currentId ? "Tomar la gestión..." : "Seleccionar persona..."}</option>
 {(allCandidates || []).map((c) => (
 <option key={c.id} value={c.id}>
 {c.source === "internal" ? "★ " : ""}{c.full_name || c.email || c.id.slice(0, 8)}{c.source === "internal" ? " (Interno)" : ""}
 </option>
 ))}
 </select>
 </div>
 )}
 {/* Botones de acción: ✓ avanzar (solo si canAdvance) / ✗ rechazar (si canReject) */}
 {(canAdvance || canReject) && !showRejectBox && (
 <div className="flex gap-1 pt-0.5">
 {canAdvance && (
 <button
 type="button"
 onClick={handleAdvance}
 title={advanceLabel}
 className="flex-1 flex items-center justify-center h-5 rounded text-[9px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors"
 >
 <Check className="h-3 w-3" />
 </button>
 )}
 {canReject && (
 <button
 type="button"
 onClick={() => setShowRejectBox(true)}
 title="Rechazar"
 className="flex-1 flex items-center justify-center h-5 rounded text-[9px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
 >
 <X className="h-3 w-3" />
 </button>
 )}
 </div>
 )}
 {/* Bloqueo de emisión para RTA: mostrar motivo cuando no se puede emitir */}
 {isIssueBlocked && level.active && !level.done && (
 <div className="pt-0.5">
 <p className="text-[9px] text-amber-600 dark:text-amber-400 italic" title={issueBlockedReason}>
 🔒 {issueBlockedReason}
 </p>
 </div>
 )}
 {/* Caja de rechazo con motivo */}
 {canReject && showRejectBox && (
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

// Sección colapsable para entidades del final (Fuentes / Historia).
// Historia (claim_history) arranca colapsada porque es solo referencia.
// Fuentes (document_templates / claim_documents) arranca abierta.
function CollapsibleBottomSection({ field, action, readOnly, values, onAdvance, onReject, onChange }: { field: ScreenField; action: ActionWithRelations; readOnly?: boolean; values: Record<string, unknown>; onAdvance?: (level: "issuer" | "reviewer" | "approver") => void; onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void; onChange?: (data: Record<string, unknown>) => void }) {
 const defaultOpen = field.type !== "claim_history";
 const [open, setOpen] = useState(defaultOpen);
 return (
 <section className="app-panel p-3">
  <button
  type="button"
  onClick={() => setOpen((o) => !o)}
  className="flex items-center justify-between w-full text-left mb-2.5 group"
  aria-expanded={open}
  >
  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
  {field.label}
  </h4>
  <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
  {open ? "▼" : "▶"}
  </span>
  </button>
  {open && (
  <ComplexEntityView type={field.type} field={field} action={action} readOnly={readOnly} values={values} onAdvance={onAdvance} onReject={onReject} onChange={onChange} />
  )}
 </section>
 );
}

function ComplexEntityView({ type, field, action, readOnly, values, onAdvance, onReject, onChange }: { type: string; field?: ScreenField; action: ActionWithRelations; readOnly?: boolean; values: Record<string, unknown>; onAdvance?: (level: "issuer" | "reviewer" | "approver") => void; onReject?: (level: "issuer" | "reviewer" | "approver", comment: string) => void; onChange?: (data: Record<string, unknown>) => void }) {
 switch (type) {
 case "review_levels":
 return <ReviewLevelsView action={action} onAdvance={onAdvance} onReject={onReject} />;
 case "claim_coverages":
 return <ClaimCoveragesView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} action={action} />;
 case "claim_reserve":
 return <ClaimReservesView claimId={action?.claim_id} />;
 case "claim_reserve_form":
 return <ReserveEditorView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} generalValues={values} action={action} onChange={onChange} />;
 case "claim_adjustment_form":
 return <AdjustmentEditorView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} generalValues={values} action={action} onChange={onChange} />;
 case "claim_documents":
 return <DocumentRequestView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} />;
 case "document_templates":
 return <DocumentTemplatesView action={action} readOnly={readOnly} />;
 case "claim_document_receipt":
 return <DocumentReceiptView claimId={action?.claim_id} actionId={action?.id} readOnly={readOnly} action={action} fieldConfig={(field?.config || {}) as ReceiptFieldConfig} />;
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

function formatDateDisplay(value: string | null | undefined): string {
 if (!value) return "—";
 const [y, m, d] = value.split("-");
 if (y && m && d) return `${d}-${m}-${y}`;
 return value;
}

// ═══════════════════════════════════════════════════════════════
// CoverageCell — celda unificada para mostrar coberturas en tablas
// Formato: COD_PADRE / COD_SUB Nombre subcobertura
// Si no hay subcobertura: COD_PADRE Nombre cobertura
// ═══════════════════════════════════════════════════════════════
function CoverageCell({
 coverageCode,
 coverageName,
 subcoverageCode,
 subcoverageName,
}: {
 coverageCode?: string | null | undefined;
 coverageName?: string | null | undefined;
 subcoverageCode?: string | null | undefined;
 subcoverageName?: string | null | undefined;
}) {
 const hasSub = !!subcoverageName || !!subcoverageCode;
 return (
 <div>
 <div className="font-medium text-[11px]">
 {coverageCode && <span className="text-muted-foreground font-mono text-[10px] mr-1">{coverageCode}</span>}
 {hasSub && subcoverageCode && <span className="text-muted-foreground font-mono text-[10px]">/ {subcoverageCode}</span>}
 {!hasSub && <span>{coverageName || "—"}</span>}
 </div>
 {hasSub && (
 <div className="text-[10px] text-muted-foreground leading-tight">
 {subcoverageName || ""}
 </div>
 )}
 </div>
 );
}

function ClaimCoveragesView({ claimId, actionId, readOnly, action }: { claimId: string; actionId?: string; readOnly?: boolean; action?: ActionWithRelations }) {
 const queryClient = useQueryClient();
 const { profile } = useAuth();
 const [comboOpen, setComboOpen] = useState(false);
 const [searchTerm, setSearchTerm] = useState("");
 const comboBtnRef = useRef<HTMLButtonElement>(null);
 const [comboPos, setComboPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

 // Recalcular posición del dropdown cuando el modal hace scroll o resize
 const updateComboPos = useCallback(() => {
 if (comboBtnRef.current) {
 const rect = comboBtnRef.current.getBoundingClientRect();
 setComboPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
 }
 }, []);

 useEffect(() => {
 if (!comboOpen) return;
 updateComboPos();
 // Escuchar scroll en todos los contenedores scrollables del modal
 const handleScroll = () => updateComboPos();
 window.addEventListener("scroll", handleScroll, true);
 window.addEventListener("resize", handleScroll);
 // Buscar el modal-body y escuchar su scroll
 const modalBody = comboBtnRef.current?.closest(".modal-body");
 if (modalBody) {
 modalBody.addEventListener("scroll", handleScroll);
 }
 return () => {
 window.removeEventListener("scroll", handleScroll, true);
 window.removeEventListener("resize", handleScroll);
 if (modalBody) {
 modalBody.removeEventListener("scroll", handleScroll);
 }
 };
 }, [comboOpen, updateComboPos]);

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

 // Determinar el tipo de póliza:
 // - "none" → sin póliza (bloquear coberturas)
 // - "emision" → póliza pendiente/draft sin número (permitir cualquier cobertura del catálogo)
 // - "normal" → póliza con número (cargar policy_coverages)
 const policyType: "none" | "emision" | "normal" = !policyId
 ? "none"
 : claim?.policy?.status === "draft" || (!claim?.policy?.policy_number && claim?.policy?.policy_name?.includes("PENDIENTE"))
 ? "emision"
 : "normal";

 // Cargar coberturas de la póliza (solo póliza normal)
 const { data: policyCoverages, isLoading: loadingPolicy } = useQuery({
 queryKey: ["policy-coverages-by-id", policyId],
 queryFn: () => getPolicyCoveragesByPolicyId(policyId),
 enabled: !!policyId && policyType === "normal",
 });

 // Cargar catálogo de coberturas (solo en emisión)
 const { data: coverageCatalog, isLoading: loadingCatalog } = useQuery({
 queryKey: ["coverage-catalog", claim?.country_id],
 queryFn: () => getCoverageCatalog(claim?.country_id || undefined),
 enabled: policyType === "emision",
 });

 // Cargar coberturas del siniestro vinculadas a ESTA gestión
 const { data: claimCoverages, isLoading: loadingClaim } = useQuery({
 queryKey: ["claim-coverages-action", claimId, actionId],
 queryFn: () => getClaimCoveragesByAction(claimId, actionId!),
 enabled: !!claimId && !!actionId,
 });

 // Mutations
 const addCoverageMut = useMutation({
 mutationFn: (coverageId: string) => {
 if (policyType === "emision") {
 // En emisión: buscar en el catálogo de coberturas
 const cc = coverageCatalog?.find((c) => c.id === coverageId);
 if (!cc) throw new Error("Cobertura no encontrada en el catálogo");
 return createClaimCoverage({
 claim_id: claimId,
 claim_action_id: actionId,
 coverage_catalog_id: cc.id,
 coverage_name: cc.name,
 insured_amount: 0,
 deductible_amount: 0,
 currency: "CLP",
 });
 }
 // Póliza normal: buscar en policy_coverages
 const pc = policyCoverages?.find((p) => p.id === coverageId);
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
 toast.success("Cobertura desactivada");
 },
 onError: (e: Error) => toast.error(e.message),
 });

 // IDs de coberturas ya vinculadas a esta gestión
 const addedIds = new Set(
 (claimCoverages || [])
 .filter((c) => c.policy_coverage_id || c.coverage_catalog_id)
 .map((c) => c.policy_coverage_id || c.coverage_catalog_id)
 );

 // Coberturas disponibles para vincular
 const availableCoverages = policyType === "emision"
 ? (coverageCatalog || []).filter(
 (cc) => !addedIds.has(cc.id) &&
 (!searchTerm ||
 cc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 cc.code.toLowerCase().includes(searchTerm.toLowerCase()))
 ).map((cc) => ({
 id: cc.id,
 coverage_name: cc.name,
 subcoverage_name: null as string | null,
 insured_amount: null as number | null,
 coverage_catalog: { code: cc.code, name: cc.name },
 subcoverage_catalog: null as { code: string; name: string } | null,
 }))
 : (policyCoverages || []).filter(
 (pc) => !addedIds.has(pc.id) &&
 (!searchTerm ||
 pc.coverage_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
 (pc.subcoverage_name || "").toLowerCase().includes(searchTerm.toLowerCase()))
 );

 if (loadingPolicy || loadingClaim || loadingCatalog) {
 return <div className="text-[11px] text-muted-foreground py-2">Cargando coberturas...</div>;
 }

 // Sin póliza → bloquear
 if (policyType === "none") {
 return (
 <div className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 p-4 text-center">
 <p className="text-[12px] font-medium text-amber-700 dark:text-amber-400">
 Sin Póliza asignada
 </p>
 <p className="text-[11px] text-muted-foreground mt-1">
 Debe asociar el siniestro a una póliza con coberturas para ejecutar esta acción.
 Seleccione una póliza existente o use &ldquo;En Emisión de Número&rdquo; en el formulario del siniestro.
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-3">
 {/* Combobox para agregar coberturas */}
 {canEditCoverages ? (
 <div className="relative">
 <button
 ref={comboBtnRef}
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

 {comboOpen && createPortal(
 <>
 <div className="fixed inset-0 z-60" onClick={() => setComboOpen(false)} />
 <div
 className="fixed z-70 rounded-md border border-border bg-popover shadow-lg max-h-[280px] overflow-hidden flex flex-col"
 style={{ top: comboPos.top, left: comboPos.left, width: comboPos.width }}
 >
 <div className="p-2 border-b">
 <Input
 className="app-input h-8 "
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
 </>,
 document.body
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
 <CoverageCell
 coverageCode={c.policy_coverage?.coverage_catalog?.code || c.coverage_catalog?.code}
 coverageName={c.coverage_name}
 subcoverageCode={c.policy_coverage?.subcoverage_catalog?.code}
 subcoverageName={c.subcoverage_name}
 />
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
 title="Desactivar cobertura"
 >
 <Ban className="h-3 w-3" />
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
 <td className="px-2 py-1">
 <CoverageCell
 coverageCode={rc.claim_coverage?.policy_coverage?.coverage_catalog?.code || rc.claim_coverage?.coverage_catalog?.code}
 coverageName={rc.claim_coverage?.coverage_name}
 subcoverageCode={rc.claim_coverage?.policy_coverage?.subcoverage_catalog?.code}
 subcoverageName={rc.claim_coverage?.subcoverage_name}
 />
 </td>
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
 allValues,
 onChange,
 readOnly,
 action,
}: {
 field: ScreenField;
 value: unknown;
 allFields: ScreenField[];
 allValues?: Record<string, unknown>;
 onChange: (id: string, value: unknown) => void;
 readOnly?: boolean;
 action?: ActionWithRelations;
}) {
 const inputClass = "app-input h-8 ";

 // Motivos de cancellation_reason (lookup_catalog) — para coord_motivo
 // Mismos motivos que el modal de cancelar/reagendar de la inspección
 const { data: cancellationReasons } = useQuery({
 queryKey: ["lookup-catalog", "cancellation_reason"],
 queryFn: () => getLookupCatalog("cancellation_reason"),
 });

 // Calcular maxDate para campos datetime (días configurados en el template)
 const daysToIssue = action?.action_template?.days_to_issue || 0;
 const datetimeMaxDate = useMemo(() => {
 const d = new Date();
 d.setDate(d.getDate() + daysToIssue);
 return d.toISOString().slice(0, 16);
 }, [daysToIssue]);

 // SLA: total de días configurados en el template (issue + review + approve)
 const totalSlaDays = (action?.action_template?.days_to_issue || 0)
 + (action?.action_template?.days_to_review || 0)
 + (action?.action_template?.days_to_approve || 0);
 const createdOn = action?.created_on;
 const issuedOn = action?.issued_on;

 // Máx SLA = creación + total_días (para inf_compromiso e inf_fecha_entrega)
 const slaMaxDate = useMemo(() => {
 if (!createdOn || totalSlaDays <= 0) return undefined;
 const d = new Date(createdOn);
 d.setDate(d.getDate() + totalSlaDays);
 return d.toISOString().slice(0, 10);
 }, [createdOn, totalSlaDays]);

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

 case "date": {
 // inf_fecha_entrega fue eliminado — no se muestra más.
 // inf_compromiso: editable, con SLA y fecha propuesta.
 if (field.id === "inf_compromiso") {
 // Fecha de compromiso = editable, máx = slaMaxDate
 // Fecha propuesta = created_on + days_to_issue (SLA de emisión)
 // SLA: si issuedOn > compromiso → "no cumpliste compromiso"
 let slaHint: { type: "ok" | "warning" | "late"; text: string } | undefined;
 const compromisoStr = value ? String(value) : null;
 if (issuedOn && compromisoStr) {
 const issued = issuedOn.slice(0, 10);
 if (issued > compromisoStr) {
 slaHint = slaMaxDate && issued <= slaMaxDate
 ? { type: "warning", text: "No cumpliste el compromiso (SLA ok)" }
 : { type: "late", text: "No cumpliste el compromiso ni el SLA" };
 } else {
 slaHint = { type: "ok", text: "Compromiso cumplido" };
 }
 }
 // Fecha propuesta = created_on + days_to_issue
 const proposedDate = createdOn
 ? new Date(new Date(createdOn).setDate(new Date(createdOn).getDate() + daysToIssue)).toISOString().slice(0, 10)
 : undefined;
 return (
 <DateField
 field={field}
 value={value}
 allFields={allFields}
 onChange={onChange}
 readOnly={readOnly}
 maxDate={slaMaxDate}
 slaHint={slaHint}
 proposedDate={proposedDate}
 />
 );
 }

 return <DateField field={field} value={value} allFields={allFields} onChange={onChange} readOnly={readOnly} />;
 }

 case "textarea":
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Textarea
 className="app-input "
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

 case "select": {
 const selectItems = [
 { value: "__none", label: field.placeholder || "Seleccionar..." },
 ...(field.options || []).map((opt) => ({ value: opt.value, label: opt.label })),
 ];
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Select
 value={String(value || "__none")}
 onValueChange={(v) => onChange(field.id, v === "__none" ? "" : v)}
 disabled={readOnly}
 items={selectItems}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder={field.placeholder || "Seleccionar..."}>
 {(val: string) => {
 const item = selectItems.find((i) => i.value === val);
 return item ? item.label : (field.placeholder || "Seleccionar...");
 }}
 </SelectValue>
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
 }

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

 case "coord_result": {
 // Select de resultado de coordinación: Coordinada / Fallida / Desistida
 const resultItems = [
 { value: "__none", label: "Seleccionar resultado..." },
 { value: "coordinada", label: "✓ Coordinada (contacto exitoso)" },
 { value: "fallida", label: "⚠ Fallida (no se pudo contactar)" },
 { value: "desistida", label: "✗ Desistida (asegurado desiste)" },
 ];
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Select
 value={String(value || "__none")}
 onValueChange={(v) => onChange(field.id, v === "__none" ? "" : v)}
 disabled={readOnly}
 items={resultItems}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar resultado...">
 {(val: string) => {
 const item = resultItems.find((i) => i.value === val);
 return item ? item.label : "Seleccionar resultado...";
 }}
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar resultado...</SelectItem>
 <SelectItem value="coordinada">✓ Coordinada (contacto exitoso)</SelectItem>
 <SelectItem value="fallida">⚠ Fallida (no se pudo contactar)</SelectItem>
 <SelectItem value="desistida">✗ Desistida (asegurado desiste)</SelectItem>
 </SelectContent>
 </Select>
 </div>
 );
 }

 case "coord_motivo": {
 // Select con motivos de cancellation_reason (lookup_catalog)
 // Mismos motivos que el modal de cancelar/reagendar de la inspección
 // → vinculación CIN ↔ INS
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Select value={String(value || "") || null} onValueChange={(v) => onChange(field.id, v ?? "")}>
 <SelectTrigger className="app-input h-8">
 <SelectValue placeholder="Seleccionar motivo..." />
 </SelectTrigger>
 <SelectContent>
 {cancellationReasons?.map((r) => (
 <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>
 );
 }

 case "coord_fecha_recoord": {
 // Date input para fecha tentativa de re-coordinación
 // Máximo = SLA (created_on + total_días) — no puede superar la fecha máxima de ejecución
 const todayStr = new Date().toISOString().slice(0, 10);
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <DatePicker
 value={String(value || "")}
 onChange={(v) => onChange(field.id, v || null)}
 placeholder={field.placeholder || "dd-mm-aaaa"}
 disabled={readOnly}
 minDate={todayStr}
 maxDate={slaMaxDate || undefined}
 />
 {slaMaxDate && (
 <p className="text-[9px] text-muted-foreground">
 Máximo: {slaMaxDate} (SLA de la acción)
 </p>
 )}
 </div>
 );
 }

 case "coord_fecha": {
 // Scheduler con disponibilidad del inspector
 // Buscar el inspector y tipo de inspección por TIPO de campo (no por ID fijo)
 // porque los IDs pueden tener sufijos (_1, _2, etc.) según el editor
 const inspectorId = String(
 allFields.find((f) => f.type === "coord_inspector" || f.type === "inspector_select") &&
 (allValues?.[allFields.find((f) => f.type === "coord_inspector" || f.type === "inspector_select")!.id] || "")
 || ""
 );
 const inspectionTypeField = allFields.find((f) => f.type === "coord_inspection_type");
 const inspectionType = inspectionTypeField
 ? String(allValues?.[inspectionTypeField.id] || "onsite")
 : "onsite";
 return (
 <CoordScheduler
 field={field}
 value={value}
 inspectorId={inspectorId}
 inspectionType={inspectionType}
 onChange={onChange}
 readOnly={readOnly}
 daysToIssue={daysToIssue}
 />
 );
 }

 case "datetime": {
 // Si es coord_fecha, usar el scheduler con disponibilidad
 if (field.id === "coord_fecha" || field.id.startsWith("coord_fecha")) {
 const inspectorId = String(
 allFields.find((f) => f.type === "coord_inspector" || f.type === "inspector_select") &&
 (allValues?.[allFields.find((f) => f.type === "coord_inspector" || f.type === "inspector_select")!.id] || "")
 || ""
 );
 const inspectionTypeField = allFields.find((f) => f.type === "coord_inspection_type");
 const inspectionType = inspectionTypeField
 ? String(allValues?.[inspectionTypeField.id] || "onsite")
 : "onsite";
 return (
 <CoordScheduler
 field={field}
 value={value}
 inspectorId={inspectorId}
 inspectionType={inspectionType}
 onChange={onChange}
 readOnly={readOnly}
 daysToIssue={daysToIssue}
 />
 );
 }
 const valStr = String(value || "");
 const now = new Date();
 const maxDateObj = new Date(datetimeMaxDate);
 const valDate = valStr ? new Date(valStr) : null;
 const isPast = valDate && valDate < now;
 const isOverMax = valDate && daysToIssue > 0 && valDate > maxDateObj;
 const hasAlert = isPast || isOverMax;
 // min en hora local (datetime-local no usa UTC)
 const minLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Input
 type="datetime-local"
 className={`${inputClass} ${hasAlert ? "border-red-500 focus-visible:ring-red-500" : ""}`}
 value={valStr}
 min={minLocal}
 max={datetimeMaxDate || undefined}
 onChange={(e) => onChange(field.id, e.target.value)}
 disabled={readOnly}
 />
 {hasAlert && (
 <p className="text-[9px] text-red-600 font-medium">
 {isPast && "⚠ La fecha no puede ser en el pasado. "}
 {isOverMax && `⚠ La fecha excede el máximo de ${daysToIssue} días configurados para esta gestión.`}
 </p>
 )}
 {daysToIssue > 0 && !hasAlert && (
 <p className="text-[9px] text-muted-foreground">Máx: {daysToIssue} días desde hoy</p>
 )}
 </div>
 );
 }

 case "inspector_select":
 return <InspectorSelectField field={field} value={value} onChange={onChange} readOnly={readOnly} claimId={action?.claim_id} />;

 case "coord_inspector":
 return <InspectorSelectField field={field} value={value} onChange={onChange} readOnly={readOnly} claimId={action?.claim_id} />;

 case "coord_inspection_type":
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Select
 value={String(value || "")}
 onValueChange={(v) => onChange(field.id, v)}
 disabled={readOnly}
 items={[
 { value: "onsite", label: "Presencial" },
 { value: "remote", label: "Remota" },
 ]}
 >
 <SelectTrigger className="app-input h-8 w-full">
 <SelectValue placeholder="Seleccionar...">
 {(val: string) => val === "remote" ? "Remota" : val === "onsite" ? "Presencial" : "Seleccionar..."}
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="onsite">Presencial</SelectItem>
 <SelectItem value="remote">Remota</SelectItem>
 </SelectContent>
 </Select>
 </div>
 );

 case "coord_agendar":
 return <CoordInspectionStatus field={field} action={action} readOnly={readOnly} />;

 case "coord_ubicacion":
 case "coord_contacto":
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Input
 className="app-input h-8"
 value={String(value || "")}
 onChange={(e) => onChange(field.id, e.target.value)}
 disabled={readOnly}
 placeholder={field.type === "coord_ubicacion" ? "Detalle adicional de la dirección..." : "Nombre, teléfono, email..."}
 />
 </div>
 );

 case "coord_comentarios":
 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Textarea
 className="app-input text-[11px] min-h-[60px]"
 value={String(value || "")}
 onChange={(e) => onChange(field.id, e.target.value)}
 disabled={readOnly}
 placeholder="Comentarios finales..."
 rows={3}
 />
 </div>
 );

 default:
 return <div className="text-[11px] text-amber-600">Tipo no soportado: <strong>{field.type}</strong></div>;
 }
}

// ═══════════════════════════════════════════════════════════════
// InspectorSelectField — select de inspectores disponibles
// ═══════════════════════════════════════════════════════════════
function InspectorSelectField({
 field,
 value,
 onChange,
 readOnly,
 claimId,
}: {
 field: ScreenField;
 value: unknown;
 onChange: (id: string, value: unknown) => void;
 readOnly?: boolean;
 claimId?: string;
}) {
 // Cargar el claim para tener el inspector_id y el company_id
 const { data: claim } = useQuery({
 queryKey: ["claim", claimId],
 queryFn: () => getClaimById(claimId!),
 enabled: !!claimId,
 });

 const claimCompanyId = claim?.company_id;
 const { data: inspectors } = useQuery({
 queryKey: ["users-by-role", "inspector", claimCompanyId],
 queryFn: () => getUsersByRoleForCompany("inspector", claimCompanyId),
 enabled: !!claimId,
 });

 const claimInspectorId = claim?.inspector_id || null;
 const claimInspectorName = claim?.inspector?.full_name || null;

 const selectItems = [
 { value: "__none", label: "Seleccionar inspector..." },
 ...(inspectors || []).map((p) => ({
 value: p.id,
 label: p.id === claimInspectorId && claimInspectorName
 ? `${p.full_name || p.email} (Inspector del siniestro)`
 : p.full_name || p.email,
 })),
 ];

 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <Select
 value={String(value || "__none")}
 onValueChange={(v) => onChange(field.id, v === "__none" ? "" : v)}
 disabled={readOnly}
 items={selectItems}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder="Seleccionar inspector...">
 {(val: string) => {
 const item = selectItems.find((i) => i.value === val);
 return item ? item.label : "Seleccionar inspector...";
 }}
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__none">Seleccionar inspector...</SelectItem>
 {(inspectors || []).map((p) => {
 const isInternal = p.source === "internal";
 const isClaimInspector = p.id === claimInspectorId;
 return (
 <SelectItem
 key={p.id}
 value={p.id}
 className={isInternal ? "bg-amber-50 dark:bg-amber-950/20" : ""}
 >
 {p.full_name || p.email}
 {isClaimInspector && claimInspectorName && " (Inspector del siniestro)"}
 {isInternal && <span className="text-[9px] text-amber-600 ml-1">· Interno</span>}
 </SelectItem>
 );
 })}
 </SelectContent>
 </Select>
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// CoordInspectionStatus — panel informativo del estado de la inspección
// La inspección se crea automáticamente al EMITIR la gestión (issueClaimAction).
// ═══════════════════════════════════════════════════════════════
function CoordInspectionStatus({
 action,
}: {
 field?: ScreenField;
 action?: ActionWithRelations;
 allValues?: Record<string, unknown>;
 readOnly?: boolean;
}) {
 const claimId = action?.claim_id;

 // Inspecciones existentes
 const { data: sessions, isLoading } = useQuery({
 queryKey: ["inspection-sessions", claimId],
 queryFn: () => getInspectionSessions(claimId!),
 enabled: !!claimId,
 });

 const activeSession = sessions?.find((s) => s.status === "scheduled" || s.status === "active") || null;

 if (isLoading) {
 return <div className="text-[11px] text-muted-foreground py-2">Cargando estado de inspección...</div>;
 }

 // Si ya hay inspección agendada, mostrar el panel informativo
 if (activeSession) {
 return (
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
 <p className="text-[10px] text-muted-foreground text-center mt-2">
 Esta inspección está disponible en la gestión de Inspección.
 </p>
 </div>
 );
 }

 // Si la gestión ya está emitida pero no hay sesión, mostrar advertencia
 const isIssued = action?.action_status?.code === "issued" || action?.action_status?.code === "reviewed" || action?.action_status?.code === "approved" || action?.action_status?.code === "dispatched";
 if (isIssued) {
 return (
 <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-center">
 <p className="text-[11px] text-amber-700 dark:text-amber-400">
 La gestión fue emitida pero no se creó la sesión de inspección.
 </p>
 </div>
 );
 }

 // Si no hay inspección y la gestión está pendiente, mostrar mensaje informativo
 return (
 <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 text-center">
 <p className="text-[11px] text-muted-foreground">
 Al <strong>emitir</strong> esta gestión se agendará automáticamente la inspección
 con los datos de coordinación capturados arriba.
 </p>
 </div>
 );
}// ═══════════════════════════════════════════════════════════════

function DateField({
 field,
 value,
 allFields,
 onChange,
 readOnly,
 maxDate,
 autoFilledValue,
 slaHint,
 proposedDate,
}: {
 field: ScreenField;
 value: unknown;
 allFields: ScreenField[];
 onChange: (id: string, value: unknown) => void;
 readOnly?: boolean;
 maxDate?: string; // ISO yyyy-MM-dd — no permitir fechas posteriores
 autoFilledValue?: string | null; // si viene, se muestra este valor read-only
 slaHint?: { type: "ok" | "warning" | "late"; text: string };
 proposedDate?: string; // ISO yyyy-MM-dd — fecha sugerida clickable
}) {
 const [error, setError] = useState<string | null>(null);

 // Si hay autoFilledValue (ej: issued_on), mostrarlo read-only
 const effectiveValue = autoFilledValue ?? (value ? String(value) : "");
 const isAutoFilled = !!autoFilledValue;
 const effectiveReadOnly = readOnly || isAutoFilled;

 const validate = (dateStr: string) => {
 if (!dateStr) { setError(null); return; }
 const date = new Date(dateStr + "T00:00:00");

 if (maxDate) {
 const max = new Date(maxDate + "T00:00:00");
 if (date > max) { setError(`No puede ser mayor a ${formatDateDisplay(maxDate)}`); return; }
 }

 if (field.dateValidation) {
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
 }
 setError(null);
 };

 return (
 <div className="flex flex-col gap-1">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 <DatePicker
 value={effectiveValue}
 onChange={(v) => {
 if (effectiveReadOnly) return;
 onChange(field.id, v || null);
 validate(v);
 }}
 placeholder={isAutoFilled ? "Se completa al emitir" : field.placeholder || "dd-mm-aaaa"}
 disabled={effectiveReadOnly}
 maxDate={maxDate}
 />
 {field.dateValidation && !isAutoFilled && (
 <p className="text-[10px] text-amber-600">⚠ {getDateValidationLabel(field.dateValidation, allFields)}</p>
 )}
 {maxDate && !isAutoFilled && (
 <p className="text-[9px] text-muted-foreground">Máx permitido: {formatDateDisplay(maxDate)} (SLA)</p>
 )}
 {proposedDate && !isAutoFilled && !effectiveReadOnly && !effectiveValue && (
 <button
 type="button"
 onClick={() => { onChange(field.id, proposedDate); validate(proposedDate); }}
 className="text-[10px] text-primary hover:underline w-fit"
 >
 Sugerir: {formatDateDisplay(proposedDate)}
 </button>
 )}
 {slaHint && (
 <p className={`text-[10px] ${slaHint.type === "late" ? "text-red-500" : slaHint.type === "warning" ? "text-amber-600" : "text-emerald-600"}`}>
 {slaHint.type === "late" ? "⛔" : slaHint.type === "warning" ? "⚠" : "✓"} {slaHint.text}
 </p>
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

const CURRENCY_OPTIONS = [
 { value: "CLP", label: "CLP — Peso Chileno" },
 { value: "USD", label: "USD — Dólar EE.UU." },
 { value: "EUR", label: "EUR — Euro" },
 { value: "UF", label: "UF — Unidad de Fomento" },
 { value: "UTM", label: "UTM — Unidad Tributaria Mensual" },
 { value: "BRL", label: "BRL — Real Brasileño" },
 { value: "MXN", label: "MXN — Peso Mexicano" },
 { value: "ARS", label: "ARS — Peso Argentino" },
 { value: "COP", label: "COP — Peso Colombiano" },
 { value: "PEN", label: "PEN — Sol Peruano" },
];

function ReserveEditorView({ claimId, actionId, readOnly, generalValues, action, onChange }: { claimId: string; actionId?: string; readOnly?: boolean; generalValues: Record<string, unknown>; action?: ActionWithRelations; onChange?: (data: Record<string, unknown>) => void }) {
 // Snapshot de coberturas del padre (COB) — copia inmutable en action_data
 const snapshotCoverages = (generalValues.parent_snapshot as Array<{
 id: string;
 coverage_name: string;
 subcoverage_name: string | null;
 policy_coverage_id: string | null;
 coverage_catalog_id: string | null;
 coverage_code: string | null;
 subcoverage_code: string | null;
 insured_amount: number;
 claimed_amount: number;
 reserved_amount: number;
 deductible_amount: number;
 currency: string;
 }> | undefined);

 // Cargar claim para obtener moneda de la póliza o del siniestro
 const { data: claim } = useQuery({
 queryKey: ["claim", claimId],
 queryFn: () => getClaimById(claimId),
 enabled: !!claimId,
 });

 // Moneda: póliza → siniestro → CLP
 const defaultCurrency = claim?.policy?.currency || claim?.currency?.code || "CLP";

 // Fecha de resolución: hoy + days_to_issue del template
 const daysToIssue = action?.action_template?.days_to_issue || 0;
 const defaultPaymentDate = useMemo(() => {
 const d = new Date();
 d.setDate(d.getDate() + daysToIssue);
 return d.toISOString().slice(0, 10);
 }, [daysToIssue]);

 // parent_action_id = ID del COB que generó esta reserva (para fallback)
 const parentActionId = generalValues.parent_action_id as string | undefined;

 // Fallback a DB query solo si no hay snapshot (acciones antiguas)
 // Usa parent_action_id para traer SOLO las coberturas del COB padre, no todas
 const { data: dbCoverages, isLoading: loadingCov } = useQuery({
 queryKey: ["claim-coverages-by-parent-action", claimId, parentActionId],
 queryFn: () => parentActionId
 ? getClaimCoveragesByAction(claimId, parentActionId)
 : getClaimCoveragesFromIngreso(claimId),
 enabled: !!claimId && !snapshotCoverages,
 });

 // Cargar reserva existente para esta acción
 const { data: existingReserve, isLoading: loadingRes } = useQuery({
 queryKey: ["claim-reserve-by-action", actionId],
 queryFn: () => getClaimReserveByAction(actionId!),
 enabled: !!actionId,
 });

 // Usar snapshot si existe, sino fallback a DB
 const claimCoverages = snapshotCoverages || dbCoverages;

 if (loadingCov || loadingRes) {
 return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
 }

 if (!claimCoverages || claimCoverages.length === 0) {
 return (
 <div className="rounded-lg border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 p-4 text-center">
 <p className="text-[12px] font-medium text-red-700 dark:text-red-400">
 Inconsistencia de datos
 </p>
 <p className="text-[11px] text-muted-foreground mt-1">
 La reserva existe pero no se encontraron coberturas del Ingreso de Coberturas.
 Esto indica una inconsistencia en los datos. Contacte al administrador.
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
 generalValues={{
 ...generalValues,
 default_currency: defaultCurrency,
 default_payment_date: defaultPaymentDate,
 }}
 onChange={(data) => onChange?.(data)}
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
 onChange,
}: {
 claimId: string;
 actionId?: string;
 claimCoverages: { id: string; coverage_name: string | null; subcoverage_name: string | null; coverage_code?: string | null; subcoverage_code?: string | null; claimed_amount: number | null; deductible_amount: number | null }[];
 existingReserve: { id: string; currency: string | null; payment_date: string | null; notes: string | null; reserve_coverages?: { claim_coverage_id: string; claimed_amount: number | null; reserved_amount: number | null; deductible_amount: number | null }[] } | null;
 readOnly?: boolean;
 generalValues: Record<string, unknown>;
 onChange?: (data: Record<string, unknown>) => void;
}) {
 const queryClient = useQueryClient();

 // Campos generales: own field → reserva existente → valor por defecto calculado
 const initialCurrency = (generalValues.reserve_currency as string) || existingReserve?.currency || (generalValues.default_currency as string) || "CLP";
 const initialPaymentDate = (generalValues.reserve_payment_date as string) || existingReserve?.payment_date || (generalValues.default_payment_date as string) || new Date().toISOString().slice(0, 10);
 const initialNotes = (generalValues.reserve_notes as string) || existingReserve?.notes || "";

 const [currency, setCurrency] = useState(initialCurrency);
 const [paymentDate, setPaymentDate] = useState(initialPaymentDate);
 const [notes, setNotes] = useState(initialNotes);

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
 setRows((prev) => prev.map((r, i) => {
 if (i !== idx) return r;
 const next = { ...r, [field]: value };
 // Validaciones:
 // 1. reclamado >= 0
 // 2. reserva <= reclamado
 // 3. deducible <= reserva
 if (field === "claimed") {
 next.claimed = Math.max(0, value);
 if (next.reserved > next.claimed) next.reserved = next.claimed;
 if (next.deductible > next.reserved) next.deductible = next.reserved;
 } else if (field === "reserved") {
 next.reserved = Math.max(0, value);
 if (next.reserved > next.claimed) next.reserved = next.claimed;
 if (next.deductible > next.reserved) next.deductible = next.reserved;
 } else if (field === "deductible") {
 next.deductible = Math.max(0, value);
 if (next.deductible > next.reserved) next.deductible = next.reserved;
 }
 return next;
 }));
 };

 // Parsear número: quita ceros a la izquierda ("0400" → 400, "020" → 20)
 const parseNum = (s: string): number => {
 const cleaned = s.replace(/[^0-9]/g, "");
 if (!cleaned) return 0;
 return parseInt(cleaned, 10);
 };

 // Errores de validación por fila
 const rowErrors = rows.map((r) => ({
 claimed: r.claimed < 0,
 reserved: r.reserved > r.claimed,
 deductible: r.deductible > r.reserved,
 }));

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

 // Autoguardado con debounce
 useAutoSave(
 () => saveMut.mutate(),
 [rows, currency, paymentDate, notes],
 !readOnly
 );

 return (
 <div className="space-y-3">
 {/* Campos superiores: Moneda, Fecha de Resolución, Notas */}
 <div className="grid grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-muted/20">
 <div className="space-y-1">
 <Label className="app-field-label text-[10px]">Moneda</Label>
 {readOnly ? (
 <Input className="app-input h-7 bg-muted/30" value={currency} readOnly />
 ) : (
 <Select
 value={currency}
 onValueChange={(v) => {
 const val = v || "CLP";
 setCurrency(val);
 onChange?.({ reserve_currency: val });
 }}
 items={CURRENCY_OPTIONS}
 >
 <SelectTrigger className="app-input">
 <SelectValue>
 {(val: string) => {
 const opt = CURRENCY_OPTIONS.find((o) => o.value === val);
 return opt ? opt.label : val;
 }}
 </SelectValue>
 </SelectTrigger>
 <SelectContent>
 {CURRENCY_OPTIONS.map((opt) => (
 <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 )}
 </div>
 <div className="space-y-1">
 <Label className="app-field-label text-[10px]">Fecha Resolución</Label>
 {readOnly ? (
 <Input className="app-input h-7 bg-muted/30" value={formatDateDisplay(paymentDate)} readOnly />
 ) : (
 <DatePicker
 value={paymentDate}
 onChange={(v) => {
 setPaymentDate(v);
 onChange?.({ reserve_payment_date: v });
 }}
 placeholder="dd-mm-aaaa"
 minDate={new Date().toISOString().slice(0, 10)}
 maxDate={(generalValues.default_payment_date as string) || undefined}
 className="w-full"
 />
 )}
 </div>
 <div className="space-y-1 col-span-2">
 <Label className="app-field-label text-[10px]">Notas</Label>
 <Input
 className="app-input h-7 "
 value={notes}
 readOnly={readOnly}
 onChange={(e) => {
 setNotes(e.target.value);
 onChange?.({ reserve_notes: e.target.value });
 }}
 placeholder="Notas de la reserva..."
 />
 </div>
 </div>

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
 <CoverageCell
 coverageCode={cov?.coverage_code}
 coverageName={cov?.coverage_name}
 subcoverageCode={cov?.subcoverage_code}
 subcoverageName={cov?.subcoverage_name}
 />
 </td>
 <td className="px-2 py-1.5 text-right">
 {readOnly ? (
 <span className="font-mono">{formatMoney(row.claimed)}</span>
 ) : (
 <Input
 type="text"
 inputMode="decimal"
 className={`app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto ${rowErrors[idx].claimed ? "border-red-500 focus-visible:ring-red-500" : ""}`}
 value={row.claimed}
 onChange={(e) => updateRow(idx, "claimed", parseNum(e.target.value))}
 title="El reclamado debe ser mayor o igual que 0"
 />
 )}
 </td>
 <td className="px-2 py-1.5 text-right">
 {readOnly ? (
 <span className="font-mono">{formatMoney(row.reserved)}</span>
 ) : (
 <Input
 type="text"
 inputMode="decimal"
 className={`app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto ${rowErrors[idx].reserved ? "border-red-500 focus-visible:ring-red-500" : ""}`}
 value={row.reserved}
 onChange={(e) => updateRow(idx, "reserved", parseNum(e.target.value))}
 title="La reserva no puede ser mayor que el reclamado"
 />
 )}
 </td>
 <td className="px-2 py-1.5 text-right">
 {readOnly ? (
 <span className="font-mono">{formatMoney(row.deductible)}</span>
 ) : (
 <Input
 type="text"
 inputMode="decimal"
 className={`app-input h-7 text-[11px] text-right font-mono w-[90px] ml-auto ${rowErrors[idx].deductible ? "border-red-500 focus-visible:ring-red-500" : ""}`}
 value={row.deductible}
 onChange={(e) => updateRow(idx, "deductible", parseNum(e.target.value))}
 title="El deducible no puede ser mayor que la reserva"
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
 <td className="px-2 py-1.5 text-right font-mono font-bold text-primary">{formatMoney(totalNet)}</td>
 </tr>
 </tfoot>
 </table>
 </div>

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

function AdjustmentEditorView({ claimId, readOnly, generalValues, action, onChange }: { claimId: string; actionId?: string; readOnly?: boolean; generalValues: Record<string, unknown>; action?: ActionWithRelations; onChange?: (data: Record<string, unknown>) => void }) {
 // Snapshot de reservas del padre (RES) — copia inmutable en action_data
 const snapshotReserves = (generalValues.parent_snapshot as Array<{
 id: string;
 reserve_number: string | null;
 currency: string | null;
 payment_date: string | null;
 notes: string | null;
 claimed_amount: number;
 reserve_amount: number;
 deductible_amount: number;
 final_amount: number;
 adjusted_amount: number | null;
 adjusted_deductible: number | null;
 adjusted_final_amount: number | null;
 coverages: Array<{
 claim_coverage_id: string;
 coverage_name: string | null;
 subcoverage_name: string | null;
 coverage_code: string | null;
 subcoverage_code: string | null;
 insured_amount: number;
 claimed_amount: number;
 reserved_amount: number;
 deductible_amount: number;
 net_reserve: number;
 adjusted_amount: number | null;
 adjusted_deductible: number | null;
 adjusted_net: number | null;
 adjustment_notes: string | null;
 }>;
 }> | undefined);

 // Fallback a DB query solo si no hay snapshot (acciones antiguas)
 const { data: dbReserves, isLoading: loadingRes } = useQuery({
 queryKey: ["claim-reserves", claimId],
 queryFn: () => getClaimReserves(claimId),
 enabled: !!claimId && !snapshotReserves,
 });

 // Transformar snapshot al formato que espera AdjustmentEditorForm
 const reserve = snapshotReserves && snapshotReserves.length > 0
 ? {
 id: snapshotReserves[0].id,
 reserve_number: snapshotReserves[0].reserve_number,
 currency: snapshotReserves[0].currency,
 payment_date: snapshotReserves[0].payment_date,
 notes: snapshotReserves[0].notes,
 reserve_coverages: snapshotReserves[0].coverages.map((c) => ({
 claim_coverage_id: c.claim_coverage_id,
 reserved_amount: c.reserved_amount,
 deductible_amount: c.deductible_amount,
 adjusted_amount: c.adjusted_amount,
 adjusted_deductible: c.adjusted_deductible,
 adjustment_notes: c.adjustment_notes,
 claim_coverage: { coverage_name: c.coverage_name, subcoverage_name: c.subcoverage_name, coverage_code: c.coverage_code, subcoverage_code: c.subcoverage_code },
 })),
 }
 : dbReserves && dbReserves.length > 0
 ? dbReserves[0]
 : null;

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
 generalValues={{
 ...generalValues,
 days_to_issue: action?.action_template?.days_to_issue || 0,
 }}
 onChange={onChange}
 />
 );
}

function AdjustmentEditorForm({
 claimId,
 reserve,
 readOnly,
 generalValues,
 onChange,
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
 claim_coverage?: { coverage_name: string | null; subcoverage_name: string | null; coverage_code?: string | null; subcoverage_code?: string | null } | null;
 }[];
 };
 readOnly?: boolean;
 generalValues: Record<string, unknown>;
 onChange?: (data: Record<string, unknown>) => void;
}) {
 const queryClient = useQueryClient();

 // Moneda del ajuste = moneda de la reserva (inmutable)
 const currency = reserve.currency || "CLP";

 // Fecha de resolución del ajuste: own field → fecha de la reserva → hoy + days_to_issue del PCA
 const daysToIssue = (generalValues.days_to_issue as number) || 0;
 const maxDate = useMemo(() => {
 const d = new Date();
 d.setDate(d.getDate() + daysToIssue);
 return d.toISOString().slice(0, 10);
 }, [daysToIssue]);

 const initialAdjDate = (generalValues.adjustment_date as string) || reserve.payment_date || new Date().toISOString().slice(0, 10);
 const [adjustmentDate, setAdjustmentDate] = useState(initialAdjDate);

 // Notas del ajuste
 const initialNotes = (generalValues.adjustment_notes as string) || reserve.notes || "";
 const [notes, setNotes] = useState(initialNotes);

 // Inicializar estado desde la reserva (lazy init)
 const [rows, setRows] = useState(() =>
 reserve.reserve_coverages.map((rc) => ({
 claim_coverage_id: rc.claim_coverage_id,
 coverage_name: rc.claim_coverage?.coverage_name || "—",
 subcoverage_name: rc.claim_coverage?.subcoverage_name || null,
 coverage_code: rc.claim_coverage?.coverage_code || null,
 subcoverage_code: rc.claim_coverage?.subcoverage_code || null,
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

 // Parsear número: quita ceros a la izquierda ("0400" → 400, "020" → 20)
 const parseNum = (s: string): number => {
 const cleaned = s.replace(/[^0-9]/g, "");
 if (!cleaned) return 0;
 return parseInt(cleaned, 10);
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

 // Autoguardado con debounce
 useAutoSave(
 () => saveMut.mutate(),
 [rows, notes],
 !readOnly && !!reserve
 );

 return (
 <div className="space-y-3">
 {/* Campos superiores: Moneda, Fecha Resolución, Notas (igual que reserva) */}
 <div className="grid grid-cols-4 gap-3 p-3 rounded-lg border border-border bg-muted/20">
 <div className="space-y-1">
 <Label className="app-field-label text-[10px]">Moneda</Label>
 <Input className="app-input h-7 bg-muted/30" value={currency} readOnly />
 </div>
 <div className="space-y-1">
 <Label className="app-field-label text-[10px]">Fecha Resolución</Label>
 {readOnly ? (
 <Input className="app-input h-7 bg-muted/30" value={formatDateDisplay(adjustmentDate)} readOnly />
 ) : (
 <DatePicker
 value={adjustmentDate}
 onChange={(v) => {
 setAdjustmentDate(v);
 onChange?.({ adjustment_date: v });
 }}
 placeholder="dd-mm-aaaa"
 minDate={new Date().toISOString().slice(0, 10)}
 maxDate={maxDate || undefined}
 className="w-full"
 />
 )}
 </div>
 <div className="space-y-1 col-span-2">
 <Label className="app-field-label text-[10px]">Notas</Label>
 <Input
 className="app-input h-7 "
 value={notes}
 readOnly={readOnly}
 onChange={(e) => {
 setNotes(e.target.value);
 onChange?.({ adjustment_notes: e.target.value });
 }}
 placeholder="Notas del ajuste..."
 />
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
 <CoverageCell
 coverageCode={row.coverage_code}
 coverageName={row.coverage_name}
 subcoverageCode={row.subcoverage_code}
 subcoverageName={row.subcoverage_name}
 />
 </td>
 <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{formatMoney(row.reserved)}</td>
 <td className="px-2 py-1.5 text-right font-mono text-muted-foreground">{formatMoney(row.deductible)}</td>
 <td className="px-2 py-1.5 text-right">
 {readOnly ? (
 <span className="font-mono">{formatMoney(row.adjusted_amount)}</span>
 ) : (
 <Input
 type="text"
 inputMode="decimal"
 className="app-input h-7 text-[11px] text-right font-mono w-[100px] ml-auto"
 value={row.adjusted_amount}
 onChange={(e) => updateRow(idx, "adjusted_amount", parseNum(e.target.value))}
 />
 )}
 </td>
 <td className="px-2 py-1.5 text-right">
 {readOnly ? (
 <span className="font-mono">{formatMoney(row.adjusted_deductible)}</span>
 ) : (
 <Input
 type="text"
 inputMode="decimal"
 className="app-input h-7 text-[11px] text-right font-mono w-[90px] ml-auto"
 value={row.adjusted_deductible}
 onChange={(e) => updateRow(idx, "adjusted_deductible", parseNum(e.target.value))}
 />
 )}
 </td>
 <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatMoney(final)}</td>
 <td className="px-2 py-1.5">
 {readOnly ? (
 <span className="text-[10px] text-muted-foreground">{row.adjustment_notes || "—"}</span>
 ) : (
 <Input
 className="app-input w-full"
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
 <td className="px-2 py-1.5 text-right font-mono font-bold text-primary">{formatMoney(totalFinal)}</td>
 <td className="px-2 py-1.5"></td>
 </tr>
 <tr className="border-t border-border">
 <td className="px-2 py-1.5 text-[10px] text-muted-foreground" colSpan={5}>Reserva Neta vs Ajuste Final</td>
 <td className="px-2 py-1.5 text-right font-mono text-[11px] text-muted-foreground">{formatMoney(totalNetReserve)}</td>
 <td className="px-2 py-1.5 text-right">
 <span className={`font-mono text-[11px] font-semibold ${difference < 0 ? "text-rose-600" : difference > 0 ? "text-emerald-600" : "text-muted-foreground"}`}>
 {difference >= 0 ? "+" : ""}{formatMoney(difference)}
 </span>
 </td>
 </tr>
 </tfoot>
 </table>
 </div>

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
 // Cargar el siniestro para obtener business_line_id + código de la gestión
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

 // Cargar el código de la gestión (ej: HNSA-001)
 const { data: actionCode } = useQuery({
 queryKey: ["action-code", actionId],
 queryFn: async () => {
 const { getSupabaseClient } = await import("@/lib/supabase/client");
 const supabase = getSupabaseClient();
 const { data, error } = await supabase
 .from("claim_actions")
 .select("code")
 .eq("id", actionId!)
 .maybeSingle();
 if (error) throw new Error(error.message);
 return data?.code || null;
 },
 enabled: !!actionId,
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

 // Items ya solicitados en esta acción
 const existingItems = existingRequest?.claim_document_request_items || [];

 // Códigos ya en esta solicitud (para no mostrarlos en "disponibles para agregar")
 const thisRequestCodes = new Set(existingItems.map((i) => i.document_type_code));

 // Items ya solicitados en OTRAS solicitudes (para no mostrarlos again)
 const otherRequestCodes = new Set<string>();
 existingRequests?.forEach((r) => {
 if (r.id === existingRequest?.id) return; // excluir esta solicitud
 r.claim_document_request_items?.forEach((item) => {
 if (item.status === "requested" || item.status === "received") {
 otherRequestCodes.add(item.document_type_code);
 }
 });
 });

 // Documentos disponibles para agregar = requirements - ya en esta solicitud - ya en otras
 const availableDocs = (requirements || []).filter(
 (r) => !thisRequestCodes.has(r.document_type_code) && !otherRequestCodes.has(r.document_type_code)
 );

 // Documentos obligatorios disponibles (no solicitados/recibidos en ninguna solicitud)
 const requiredAvailableDocs = availableDocs.filter((d) => d.is_required);
 // Clave estable para deps de useMemo/useAutoSave
 const requiredCodesKey = requiredAvailableDocs.map((d) => d.document_type_code).join(",");

 const [selected, setSelected] = useState<Set<string>>(new Set());
 const [notes, setNotes] = useState<string>(existingRequest?.notes || "");

 // Set derivado: seleccionados por el usuario + obligatorios (siempre checked)
 const checkedSet = useMemo(
 () => new Set([...selected, ...requiredAvailableDocs.map((d) => d.document_type_code)]),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [selected, requiredCodesKey]
 );

 // ── Mutación: crear solicitud nueva ──
 const saveMut = useMutation({
 mutationFn: async () => {
 // Guard: si ya existe la solicitud, no crear otra
 if (existingRequest) return;
 // Incluir docs obligatorios + los seleccionados por el usuario
 const items = (requirements || [])
 .filter((d) => d.is_required || selected.has(d.document_type_code))
 .filter((d) => !thisRequestCodes.has(d.document_type_code) && !otherRequestCodes.has(d.document_type_code))
 .map((d, i) => ({
 document_type_code: d.document_type_code,
 document_name: d.document_name,
 sort_order: i + 1,
 }));
 if (items.length === 0) return;
 await createClaimDocumentRequest({
 claim_id: claimId!,
 claim_action_id: actionId,
 notes,
 items,
 });
 },
 onSuccess: () => {
 toast.success("Solicitud de documentos creada");
 setSelected(new Set());
 queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
 queryClient.invalidateQueries({ queryKey: ["claim-doc-request-by-action", actionId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 // ── Mutación: agregar un item a solicitud existente ──
 const addItemMut = useMutation({
 mutationFn: async (doc: { document_type_code: string; document_name: string }) => {
 if (!existingRequest) return;
 // Guard: no agregar si ya existe un item con el mismo document_type_code
 if (existingItems.some((it) => it.document_type_code === doc.document_type_code)) return;
 const sort_order = (existingItems.length || 0) + 1;
 await addItemsToClaimDocumentRequest(existingRequest.id, [{
 document_type_code: doc.document_type_code,
 document_name: doc.document_name,
 sort_order,
 }]);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
 queryClient.invalidateQueries({ queryKey: ["claim-doc-request-by-action", actionId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 // ── Mutación: remover item ──
 const removeItemMut = useMutation({
 mutationFn: (itemId: string) => removeItemFromClaimDocumentRequest(itemId),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
 queryClient.invalidateQueries({ queryKey: ["claim-doc-request-by-action", actionId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 // ── Mutación: actualizar notas ──
 const updateNotesMut = useMutation({
 mutationFn: ({ reqId, value }: { reqId: string; value: string }) =>
 updateClaimDocumentRequestNotes(reqId, value),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["claim-doc-request-by-action", actionId] });
 },
 });

 // Autoguardado: crear solicitud nueva cuando hay selección o docs obligatorios
 useAutoSave(
 () => saveMut.mutate(),
 [selected, notes, requiredAvailableDocs.length],
 !readOnly && !existingRequest && (selected.size > 0 || requiredAvailableDocs.length > 0)
 );

 // Autoguardado: notas (solo si cambió respecto al original)
 useAutoSave(
 () => {
 if (existingRequest) updateNotesMut.mutate({ reqId: existingRequest.id, value: notes });
 },
 [notes],
 !readOnly && !!existingRequest && notes !== (existingRequest?.notes || "")
 );

 if (loadingReq || loadingEx) {
 return <div className="text-[11px] text-muted-foreground py-2">Cargando...</div>;
 }

 // ── Construir filas unificadas: TODOS los docs de la línea en una grilla ──
 // Mapa de items de esta solicitud: code → item
 const thisRequestItems = new Map(existingItems.map((i) => [i.document_type_code, i]));
 // Mapa de items de otras solicitudes: code → status
 const otherRequestItems = new Map<string, string>();
 existingRequests?.forEach((r) => {
 if (r.id === existingRequest?.id) return;
 r.claim_document_request_items?.forEach((item) => {
 if (item.status === "requested" || item.status === "received") {
 otherRequestItems.set(item.document_type_code, item.status);
 }
 });
 });

 type RowState = {
 code: string;
 name: string;
 isRequired: boolean;
 isOn: boolean; // toggle iluminado
 isLocked: boolean; // no se puede cambiar
 badge?: { text: string; className: string };
 itemId?: string; // si está en esta solicitud, el id del item
 };

 const rows: RowState[] = (requirements || []).map((doc) => {
 const thisItem = thisRequestItems.get(doc.document_type_code);
 const otherStatus = otherRequestItems.get(doc.document_type_code);

 // ¿Está encendido?
 const isOn = !!thisItem || doc.is_required || otherStatus === "requested" || otherStatus === "received" || checkedSet.has(doc.document_type_code);

 // ¿Está bloqueado?
 let isLocked = false;
 let badge: { text: string; className: string } | undefined;

 if (readOnly) {
 isLocked = true;
 } else if (thisItem?.status === "received") {
 isLocked = true;
 badge = { text: "Recibido", className: "bg-emerald-100 text-emerald-700" };
 } else if (thisItem?.status === "not_needed") {
 isLocked = true;
 badge = { text: "No necesario", className: "bg-muted text-muted-foreground" };
 } else if (otherStatus === "received") {
 isLocked = true;
 badge = { text: "Recibido en otra", className: "bg-emerald-100 text-emerald-700" };
 } else if (otherStatus === "requested") {
 isLocked = true;
 badge = { text: "En otra solicitud", className: "bg-blue-100 text-blue-700" };
 } else if (doc.is_required) {
 isLocked = true;
 }

 if (doc.is_required && !badge) {
 badge = { text: "Obligatorio", className: "bg-rose-100 text-rose-700" };
 }

 return {
 code: doc.document_type_code,
 name: doc.document_name,
 isRequired: doc.is_required,
 isOn,
 isLocked,
 badge,
 itemId: thisItem?.id,
 };
 });

 // ── Acción del toggle ──
 const handleToggle = (row: RowState) => {
 if (row.isLocked || readOnly) return;
 // Bloquear si hay una mutación en curso (evita race condition / doble click)
 if (addItemMut.isPending || removeItemMut.isPending || saveMut.isPending) return;

 if (existingRequest) {
 // Solicitud existente: agregar o remover inmediatamente
 if (row.isOn) {
 // Apagar = remover de la solicitud
 if (row.itemId) removeItemMut.mutate(row.itemId);
 } else {
 // Encender = agregar a la solicitud
 addItemMut.mutate({ document_type_code: row.code, document_name: row.name });
 }
 } else {
 // Sin solicitud: usar set local (autoguardado crea la solicitud)
 setSelected((prev) => {
 const next = new Set(prev);
 if (next.has(row.code)) next.delete(row.code);
 else next.add(row.code);
 return next;
 });
 }
 };

 // ── Una sola grilla unificada ──
 if (rows.length === 0) {
 return (
 <div className="rounded-lg border border-dashed border-border py-6 text-center">
 <p className="text-[11px] text-muted-foreground">
 No hay documentos configurados para esta línea de negocio.
 </p>
 </div>
 );
 }

 return (
 <div className="space-y-2">
 {/* Header de la solicitud */}
 <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-[11px]">
 <span className="font-medium">Gestión: {actionCode || "—"}</span>
 <Badge className={
 existingRequest?.status === "closed" ? "bg-emerald-100 text-emerald-700" :
 existingRequest?.status === "cancelled" ? "bg-rose-100 text-rose-700" :
 existingRequest?.status === "received" ? "bg-blue-100 text-blue-700" :
 existingRequest ? "bg-amber-100 text-amber-700" :
 "bg-muted text-muted-foreground"
 }>
 {existingRequest?.status === "requested" ? "Solicitada" :
 existingRequest?.status === "received" ? "Recibida" :
 existingRequest?.status === "closed" ? "Cerrada" :
 existingRequest?.status === "cancelled" ? "Cancelada" :
 "Nueva"}
 </Badge>
 </div>

 {/* Grilla única con todos los documentos — ToggleChip por fila */}
 <div className="space-y-1.5">
 {rows.map((row) => (
 <div
 key={row.code}
 className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
 row.isOn ? "border-primary/40 bg-primary/5" : "border-border"
 } ${row.isLocked ? "cursor-not-allowed" : ""}`}
 >
 <div className="flex items-center gap-2 flex-1 min-w-0">
 <ToggleChip
 active={row.isOn}
 onClick={() => handleToggle(row)}
 disabled={row.isLocked}
 className={row.isRequired ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : ""}
 >
 {row.name}
 </ToggleChip>
 </div>
 {row.badge ? (
 <Badge className={row.badge.className}>{row.badge.text}</Badge>
 ) : row.isOn ? (
 <Badge className="bg-amber-100 text-amber-700">Solicitado</Badge>
 ) : (
 <span className="text-[10px] text-muted-foreground">Disponible</span>
 )}
 </div>
 ))}
 </div>

 {/* Notas */}
 {!readOnly && (
 <div>
 <Label className="app-field-label text-[10px]">Notas de la solicitud</Label>
 <Textarea
 className="app-input text-[11px] min-h-[50px]"
 placeholder="Indicaciones para el asegurado o corredor..."
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 />
 </div>
 )}
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// Recepción Total de Antecedentes (RTA)
// Controla la recepción de los documentos solicitados en la NSA.
// NO sube documentos nuevos — solo controla cuáles se han recibido.
// Muestra exactamente los documentos de la solicitud NSA.
// Auto-emite cuando todos los documentos están received o not_needed.
// issued_by = usuario que marcó el último documento.
// No hay responsable real — cualquiera puede marcar recibido.
// "No necesario" solo lo pueden marcar los emisores del combo (issuer_roles).
// Obligatorios no pueden marcarse como not_needed.
// ═══════════════════════════════════════════════════════════════

function DocumentReceiptView({ claimId, actionId, readOnly, action, fieldConfig }: { claimId?: string; actionId?: string; readOnly?: boolean; action?: ActionWithRelations; fieldConfig?: ReceiptFieldConfig }) {
 const { profile } = useAuth();
 const queryClient = useQueryClient();

 // Config del campo (desde la configuración de la pantalla, no hardcodeado)
 const notNeededRequiresReason = fieldConfig?.notNeededRequiresReason !== false; // default true
 const notNeededOnlyIssuers = fieldConfig?.notNeededOnlyIssuers !== false; // default true

 // Estado del modal "No necesario" (motivo obligatorio si notNeededRequiresReason=true)
 const [notNeededTarget, setNotNeededTarget] = useState<{ itemId: string; docCode: string; docName: string } | null>(null);
 const [notNeededReason, setNotNeededReason] = useState("");

 // Cargar todas las solicitudes de documentos del siniestro
 const { data: requests, isLoading } = useQuery({
 queryKey: ["claim-doc-requests", claimId],
 queryFn: () => getClaimDocumentRequests(claimId!),
 enabled: !!claimId,
 });

 // Cargar el código de la gestión (ej: HRTA-001)
 const { data: actionCode } = useQuery({
 queryKey: ["action-code", actionId],
 queryFn: async () => {
 const { getSupabaseClient } = await import("@/lib/supabase/client");
 const supabase = getSupabaseClient();
 const { data, error } = await supabase
 .from("claim_actions")
 .select("code")
 .eq("id", actionId!)
 .maybeSingle();
 if (error) throw new Error(error.message);
 return data?.code || null;
 },
 enabled: !!actionId,
 });

 // Cargar documentos disponibles para saber cuáles son obligatorios
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

 const { data: requirements } = useQuery({
 queryKey: ["document-requirements", claim?.business_line_id],
 queryFn: () => getDocumentRequirements(claim?.business_line_id || undefined),
 enabled: !!claim?.business_line_id,
 });

 // Mapa code → is_required
 const codeToRequired = new Map((requirements || []).map((r) => [r.document_type_code, r.is_required]));

 // Tomar la solicitud más reciente que no esté cerrada/cancelada
 const activeRequest = requests?.find(
 (r) => r.status === "requested" || r.status === "received"
 ) || requests?.[0] || null;

 const items = activeRequest?.claim_document_request_items || [];

 // ── Cargar nombres de los usuarios que aparecen en received_by / not_needed_by ──
 const userIds = Array.from(new Set(
 items.flatMap((i) => [i.received_by, i.not_needed_by].filter(Boolean) as string[])
 ));
 const { data: receiptUsers } = useQuery({
 queryKey: ["receipt-users", userIds.join(",")],
 queryFn: async () => {
 if (userIds.length === 0) return [] as { id: string; full_name: string | null; email: string | null }[];
 const { getSupabaseClient } = await import("@/lib/supabase/client");
 const supabase = getSupabaseClient();
 const { data, error } = await supabase
 .from("profiles")
 .select("id, full_name, email")
 .in("id", userIds);
 if (error) throw new Error(error.message);
 return (data || []) as { id: string; full_name: string | null; email: string | null }[];
 },
 enabled: userIds.length > 0,
 });
 const userMap = new Map((receiptUsers || []).map((u) => [u.id, u]));
 const getUserName = (id: string | null) => id ? (userMap.get(id)?.full_name || userMap.get(id)?.email || "—") : null;

 // ── Permisos del usuario ──
 // No hay responsable real — cualquiera puede marcar recibido.
 // "No necesario": si notNeededOnlyIssuers=true, solo emisores del combo.
 const issuerRoles = action?.action_template?.issuer_roles || [];
 const userRole = profile?.role || "";
 const canMarkNotNeeded = !readOnly && (
 notNeededOnlyIssuers ? issuerRoles.includes(userRole) : true
 );

 // ── Mutación: actualizar estado de un item ──
 const updateItemMut = useMutation({
 mutationFn: async ({ itemId, status, notes, userId }: { itemId: string; status: string; notes?: string; userId?: string }) => {
 const updates: { status: string; received_by?: string | null; not_needed_by?: string | null; notes?: string | null } = { status };
 if (status === "received" && userId) updates.received_by = userId;
 if (status === "not_needed" && userId) updates.not_needed_by = userId;
 if (notes !== undefined) updates.notes = notes;
 await updateClaimDocumentRequestItem(itemId, updates);
 },
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["claim-doc-requests", claimId] });
 queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
 queryClient.invalidateQueries({ queryKey: ["claim-actions", claimId] });
 },
 onError: (e: Error) => toast.error(e.message),
 });

 // ── Mutación: auto-emitir la RTA ──
 const autoIssueMut = useMutation({
 mutationFn: async () => {
 if (!actionId) throw new Error("Sin gestión");
 await issueClaimAction(actionId, profile?.id);
 },
 onSuccess: () => {
 toast.success("Recepción completada — gestión emitida automáticamente");
 queryClient.invalidateQueries({ queryKey: ["claim-actions", claimId] });
 queryClient.invalidateQueries({ queryKey: ["claim-action", actionId] });
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
 No hay solicitudes de documentos para este siniestro. La gestión NSA debe crear una solicitud primero.
 </p>
 </div>
 );
 }

 // ── ¿Todos los documentos están resueltos? ──
 const allResolved = items.length > 0 && items.every(
 (item) => item.status === "received" || item.status === "not_needed"
 );

 // ── Contar estados ──
 const receivedCount = items.filter((i) => i.status === "received").length;
 const notNeededCount = items.filter((i) => i.status === "not_needed").length;
 const pendingCount = items.filter((i) => i.status === "requested").length;

 // ── Verificar auto-emisión después de un cambio ──
 const checkAutoIssue = (updatedItems: typeof items) => {
 const nowAllResolved = updatedItems.length > 0 && updatedItems.every(
 (i) => i.status === "received" || i.status === "not_needed"
 );
 if (nowAllResolved && action?.action_status?.code === "todo") {
 setTimeout(() => autoIssueMut.mutate(), 300);
 }
 };

 // ── Marcar documento como recibido (cualquiera) ──
 const markReceived = (itemId: string) => {
 if (readOnly) return;
 updateItemMut.mutate(
 { itemId, status: "received", userId: profile?.id },
 {
 onSuccess: () => {
 const updatedItems = items.map((i) =>
 i.id === itemId ? { ...i, status: "received" as const, received_by: profile?.id || null, received_at: new Date().toISOString() } : i
 );
 checkAutoIssue(updatedItems);
 },
 }
 );
 };

 // ── Marcar documento como no necesario ──
 // Si notNeededRequiresReason=true: abre modal con motivo obligatorio.
 // Si notNeededRequiresReason=false: marca directo sin motivo.
 // Si era el último pendiente → auto-emite a nombre del usuario.
 const openNotNeededModal = (itemId: string, docCode: string, docName: string) => {
 if (readOnly || !canMarkNotNeeded) return;
 // No se puede marcar como no necesario un obligatorio
 if (codeToRequired.get(docCode)) {
 toast.error("No se puede marcar como 'No necesario' un documento obligatorio.");
 return;
 }
 // Si no requiere motivo, marcar directo
 if (!notNeededRequiresReason) {
 updateItemMut.mutate(
 { itemId, status: "not_needed", userId: profile?.id },
 {
 onSuccess: () => {
 const updatedItems = items.map((i) =>
 i.id === itemId ? { ...i, status: "not_needed" as const, not_needed_by: profile?.id || null, not_needed_at: new Date().toISOString() } : i
 );
 checkAutoIssue(updatedItems);
 },
 }
 );
 return;
 }
 // Si requiere motivo, abrir modal
 setNotNeededTarget({ itemId, docCode, docName });
 setNotNeededReason("");
 };

 const confirmNotNeeded = () => {
 if (!notNeededTarget) return;
 const reason = notNeededReason.trim();
 if (notNeededRequiresReason && !reason) {
 toast.error("Debe ingresar el motivo por el que no es necesario.");
 return;
 }
 updateItemMut.mutate(
 { itemId: notNeededTarget.itemId, status: "not_needed", notes: notNeededRequiresReason ? reason : undefined, userId: profile?.id },
 {
 onSuccess: () => {
 const updatedItems = items.map((i) =>
 i.id === notNeededTarget.itemId ? {
 ...i,
 status: "not_needed" as const,
 notes: notNeededRequiresReason ? reason : null,
 not_needed_by: profile?.id || null,
 not_needed_at: new Date().toISOString(),
 } : i
 );
 setNotNeededTarget(null);
 setNotNeededReason("");
 checkAutoIssue(updatedItems);
 },
 }
 );
 };

 const cancelNotNeeded = () => {
 setNotNeededTarget(null);
 setNotNeededReason("");
 };

 // ── Revertir a pendiente (cualquiera) ──
 const markPending = (itemId: string) => {
 if (readOnly) return;
 updateItemMut.mutate({ itemId, status: "requested" });
 };

 const isClosed = activeRequest.status === "closed" || activeRequest.status === "cancelled";
 const isIssued = action?.action_status?.code !== "todo"; // ya emitida
 const canEdit = !readOnly && !isClosed && !isIssued;

 // Formatear fecha de recepción
 const formatReceivedDate = (dateStr: string | null) => {
 if (!dateStr) return null;
 const d = new Date(dateStr);
 return d.toLocaleDateString("es-CL") + " " + d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
 };

 return (
 <div className="space-y-2">
 {/* Header */}
 <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20 text-[11px]">
 <span className="font-medium">Gestión: {actionCode || "—"}</span>
 <Badge className={
 isIssued ? "bg-emerald-100 text-emerald-700" :
 activeRequest.status === "closed" ? "bg-emerald-100 text-emerald-700" :
 activeRequest.status === "cancelled" ? "bg-rose-100 text-rose-700" :
 "bg-amber-100 text-amber-700"
 }>
 {isIssued ? "Emitida" :
 activeRequest.status === "closed" ? "Cerrada" :
 activeRequest.status === "cancelled" ? "Cancelada" :
 "Pendiente"}
 </Badge>
 </div>

 {/* Resumen de progreso */}
 <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
 <span className="text-emerald-600 font-medium">✓ {receivedCount} recibidos</span>
 {notNeededCount > 0 && <span className="text-muted-foreground font-medium">○ {notNeededCount} no necesarios</span>}
 {pendingCount > 0 && <span className="text-amber-600 font-medium">● {pendingCount} pendientes</span>}
 <span className="ml-auto">{items.length} total</span>
 </div>

 {/* Grilla de documentos con ToggleChip */}
 <div className="space-y-1.5">
 {items.map((item) => {
 const isRequired = codeToRequired.get(item.document_type_code) || false;
 const isReceived = item.status === "received";
 const isNotNeeded = item.status === "not_needed";
 const isPending = item.status === "requested";

 return (
 <div
 key={item.id}
 className={`flex items-center justify-between gap-2 p-2 rounded-lg border transition-colors ${
 isReceived ? "border-emerald-400/50 bg-emerald-50 dark:bg-emerald-950/20" :
 isNotNeeded ? "border-border bg-muted/20" :
 "border-border"
 }`}
 >
 <div className="flex items-center gap-2 flex-1 min-w-0">
 {/* ToggleChip: Recibido — cualquiera puede marcar */}
 <ToggleChip
 active={isReceived}
 onClick={() => {
 if (isReceived) {
 markPending(item.id);
 } else {
 markReceived(item.id);
 }
 }}
 disabled={!canEdit || isNotNeeded}
 className={isReceived ? "border-emerald-400 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400" : ""}
 >
 {item.document_name}
 </ToggleChip>
 {isRequired && (
 <Badge className="bg-rose-100 text-rose-700 text-[9px]">Obligatorio</Badge>
 )}
 </div>

 {/* Estado / Acciones */}
 <div className="flex items-center gap-1.5 shrink-0">
 {isReceived && (
 <div className="flex flex-col items-end gap-0.5">
 <Badge className="bg-emerald-100 text-emerald-700">Recibido</Badge>
 {item.received_at && (
 <span className="text-[9px] text-muted-foreground" title={`Recibido por ${getUserName(item.received_by) || "—"}`}>
 por {getUserName(item.received_by) || "—"} · {formatReceivedDate(item.received_at)}
 </span>
 )}
 </div>
 )}
 {isNotNeeded && (
 <div className="flex flex-col items-end gap-0.5">
 <Badge className="bg-muted text-muted-foreground">No necesario</Badge>
 {item.not_needed_at && (
 <span className="text-[9px] text-muted-foreground" title={`Marcado por ${getUserName(item.not_needed_by) || "—"}`}>
 por {getUserName(item.not_needed_by) || "—"} · {formatReceivedDate(item.not_needed_at)}
 </span>
 )}
 {item.notes && (
 <span className="text-[9px] text-muted-foreground italic max-w-[220px] truncate" title={item.notes}>
 &ldquo;{item.notes}&rdquo;
 </span>
 )}
 </div>
 )}
 {isPending && (
 <>
 <Badge className="bg-amber-100 text-amber-700">Pendiente</Badge>
 {/* Botón "No necesario" — solo emisores del combo, no obligatorios */}
 {canMarkNotNeeded && !isRequired && (
 <button
 type="button"
 className="text-[10px] text-muted-foreground hover:text-rose-600 transition-colors px-1.5 py-0.5 rounded border border-border hover:border-rose-300"
 onClick={() => openNotNeededModal(item.id, item.document_type_code, item.document_name)}
 disabled={updateItemMut.isPending}
 title="Marcar como no necesario"
 >
 No necesario
 </button>
 )}
 </>
 )}
 </div>
 </div>
 );
 })}
 </div>

 {/* Mensaje de auto-emisión */}
 {allResolved && !isIssued && (
 <p className="text-[10px] text-emerald-600 text-center font-medium py-1">
 ✓ Todos los documentos recibidos — la gestión se emitirá automáticamente...
 </p>
 )}

 {isIssued && (
 <p className="text-[10px] text-emerald-600 text-center font-medium py-1">
 ✓ Recepción completada — gestión emitida por {action?.issuer?.full_name || action?.issuer?.email || "—"}
 </p>
 )}

 {/* Notas de la solicitud */}
 {activeRequest.notes && (
 <p className="text-[10px] text-muted-foreground italic px-1">{activeRequest.notes}</p>
 )}

 {/* Modal: Motivo "No necesario" — motivo obligatorio antes de grabar */}
 {notNeededTarget && createPortal(
 <div
 className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
 onClick={cancelNotNeeded}
 >
 <div
 className="w-full max-w-md rounded-lg border border-border bg-background p-4 shadow-lg"
 onClick={(e) => e.stopPropagation()}
 >
 <div className="mb-3">
 <h3 className="text-[13px] font-semibold">Marcar como “No necesario”</h3>
 <p className="text-[11px] text-muted-foreground mt-0.5">
 Documento: <strong>{notNeededTarget.docName}</strong>
 </p>
 </div>
 <div className="space-y-2">
 <Label className="text-[11px]">Motivo <span className="text-rose-600">*</span></Label>
 <Textarea
 className="min-h-[80px] text-[12px]"
 placeholder="Explique por qué este documento no es necesario..."
 value={notNeededReason}
 onChange={(e) => setNotNeededReason(e.target.value)}
 autoFocus
 onKeyDown={(e) => {
 if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) confirmNotNeeded();
 }}
 />
 <p className="text-[10px] text-muted-foreground">
 {notNeededReason.trim().length === 0
 ? "Debe ingresar un motivo para poder grabar."
 : "Si este era el último documento pendiente, la RTA se emitirá automáticamente a su nombre."}
 </p>
 </div>
 <div className="flex justify-end gap-2 mt-3">
 <button
 type="button"
 className="px-3 py-1.5 text-[11px] rounded border border-border text-muted-foreground hover:bg-muted/30"
 onClick={cancelNotNeeded}
 disabled={updateItemMut.isPending}
 >
 Cancelar
 </button>
 <button
 type="button"
 className="px-3 py-1.5 text-[11px] rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
 onClick={confirmNotNeeded}
 disabled={updateItemMut.isPending || notNeededReason.trim().length === 0}
 >
 {updateItemMut.isPending ? "Grabando..." : "Grabar"}
 </button>
 </div>
 </div>
 </div>,
 document.body
 )}
 </div>
 );
}


// ═══════════════════════════════════════════════════════════════
// CoordFieldsGrid — layout personalizado para pantalla de coordinación
// Row 1: [Tipo Inspección (6)] [Inspector (6)]
// Row 2: [Fecha/Hora picker (6)] [Ubicación (6)]
// Row 3: [Slots (6)] [Contacto (6)]
// Row 4: [Comentarios (12)]
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// InspectionSessionView — vista de inspecciones del siniestro
// ═══════════════════════════════════════════════════════════════

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
 href={`/dashboard/inspecciones/${session.id}`}
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

// ═══════════════════════════════════════════════════════════════

function CoordScheduler({
 field,
 value,
 inspectorId,
 inspectionType,
 onChange,
 readOnly,
 daysToIssue,
 mode = "full",
 selectedDate: sharedDate,
 setSelectedDate: sharedSetDate,
}: {
 field: ScreenField;
 value: unknown;
 inspectorId: string;
 inspectionType: string;
 onChange: (id: string, value: unknown) => void;
 readOnly?: boolean;
 daysToIssue?: number;
 mode?: "picker" | "slots" | "full";
 selectedDate?: string;
 setSelectedDate?: (d: string) => void;
}) {
 const [localDate, setLocalDate] = useState<string>("");
 const [showCustomTime, setShowCustomTime] = useState(false);
 const [customTime, setCustomTime] = useState("12:00");

 // Usar fecha compartida si está disponible, sino local
 const selectedDate = sharedDate ?? localDate;
 const setSelectedDate = sharedSetDate ?? setLocalDate;

 // Duración según tipo de inspección
 const slotMinutes = inspectionType === "remote" ? 30 : 180; // 30 min remota, 3h presencial
 const slotLabel = inspectionType === "remote" ? "30 min" : "3 hrs";

 // Rangos horarios
 const DAY_START = 6, DAY_END = 22, NORMAL_START = 9, NORMAL_END = 19;

 // Cargar disponibilidad del inspector para la fecha seleccionada
 const { data: schedule, isLoading: scheduleLoading } = useQuery({
 queryKey: ["inspector-schedule", inspectorId, selectedDate],
 queryFn: () => {
 const start = `${selectedDate}T00:00:00`;
 const end = `${selectedDate}T23:59:59`;
 return getInspectorSchedule(inspectorId, start, end);
 },
 enabled: !!inspectorId && !!selectedDate && mode !== "picker",
 });

 // Generar slots disponibles
 const slots = useMemo(() => {
 if (!selectedDate) return [];
 const result: { time: string; label: string; available: boolean; extra: boolean; bookedInfo?: string }[] = [];
 const totalMin = (DAY_END - DAY_START) * 60;
 const now = new Date();
 const isToday = selectedDate === new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];

 for (let offset = 0; offset + slotMinutes <= totalMin; offset += slotMinutes) {
 const startHour = DAY_START + Math.floor(offset / 60);
 const startMin = offset % 60;
 const endHour = DAY_START + Math.floor((offset + slotMinutes) / 60);
 const endMin = (offset + slotMinutes) % 60;
 const timeStr = `${String(startHour).padStart(2, "0")}:${String(startMin).padStart(2, "0")}`;
 const endStr = `${String(endHour).padStart(2, "0")}:${String(endMin).padStart(2, "0")}`;

 // Si es hoy, saltar slots que ya pasaron
 if (isToday) {
 const slotStartCheck = new Date(`${selectedDate}T${timeStr}:00`);
 if (slotStartCheck <= now) continue;
 }

 const isExtra = startHour < NORMAL_START || startHour >= NORMAL_END;
 const slotStart = new Date(`${selectedDate}T${timeStr}:00`);
 const slotEnd = new Date(`${selectedDate}T${endStr}:00`);
 const booked = schedule?.find((s) => {
 const sStart = new Date(s.scheduled_at);
 const sDuration = s.inspection_type === "onsite" ? 180 : 30;
 const sEnd = new Date(sStart.getTime() + sDuration * 60000);
 return sStart < slotEnd && sEnd > slotStart;
 });

 result.push({
 time: timeStr,
 label: `${timeStr} - ${endStr}`,
 available: !booked,
 extra: isExtra,
 bookedInfo: booked ? `Ocupado: ${booked.claim?.claim_number}` : undefined,
 });
 }
 return result;
 }, [selectedDate, slotMinutes, schedule]);

 // Valor actual formateado para mostrar
 const currentValue = String(value || "");
 const valDate = currentValue ? new Date(currentValue) : null;
 const isPast = valDate && valDate < new Date();

 // Asignar un slot
 const assignSlot = (timeStr: string) => {
 const datetimeStr = `${selectedDate}T${timeStr}`;
 onChange(field.id, datetimeStr);
 };

 // Asignar horario personalizado
 const assignCustom = () => {
 const datetimeStr = `${selectedDate}T${customTime}`;
 onChange(field.id, datetimeStr);
 };

 // Fecha mínima = hoy (inicializada una vez)
 const [todayLocal] = useState(() => {
 return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split("T")[0];
 });

 // ─── Modo PICKER: solo el selector de fecha ───
 if (mode === "picker") {
 // Calcular si la fecha seleccionada excede daysToIssue (alarma, no bloqueo)
 const isOverMax = daysToIssue && daysToIssue > 0 && selectedDate ? (() => {
 const maxDate = new Date();
 maxDate.setDate(maxDate.getDate() + daysToIssue);
 const sel = new Date(selectedDate + "T23:59:59");
 return sel > maxDate;
 })() : false;

 return (
 <div className="flex flex-col gap-2">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 <span className="text-muted-foreground ml-2">({slotLabel} por inspección)</span>
 </Label>
 <div className="flex items-center gap-2">
 <DatePicker
 value={selectedDate}
 onChange={(v) => setSelectedDate(v)}
 placeholder="dd-mm-aaaa"
 disabled={readOnly}
 minDate={todayLocal}
 className={isOverMax ? "border-amber-500" : ""}
 />
 {currentValue && (
 <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 shrink-0 text-[11px]">
 {valDate ? valDate.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" }) : ""}
 </Badge>
 )}
 </div>
 {!inspectorId && selectedDate && (
 <p className="text-[10px] text-amber-600">⚠ Seleccione un inspector para ver disponibilidades.</p>
 )}
 {isPast && (
 <p className="text-[9px] text-red-600 font-medium">⚠ La fecha no puede ser en el pasado.</p>
 )}
 {isOverMax && (
 <p className="text-[9px] text-amber-600 font-medium">
 ⚠ La fecha excede el máximo recomendado de {daysToIssue} días. Se permite pero requiere justificación.
 </p>
 )}
 {daysToIssue && daysToIssue > 0 && !isOverMax && (
 <p className="text-[9px] text-muted-foreground">Máx recomendado: {daysToIssue} días</p>
 )}
 </div>
 );
 }

 // ─── Modo SLOTS: solo la caja de slots ───
 if (mode === "slots") {
 if (!selectedDate) {
 return (
 <div className="flex flex-col gap-2">
 <Label className="app-field-label text-[11px]">
 Disponibilidad
 </Label>
 <p className="text-[11px] text-muted-foreground py-2">Seleccione una fecha para ver horarios.</p>
 </div>
 );
 }
 if (!inspectorId) {
 return (
 <div className="flex flex-col gap-2">
 <Label className="app-field-label text-[11px]">
 Disponibilidad
 </Label>
 <p className="text-[11px] text-amber-600 py-2">⚠ Seleccione un inspector para ver disponibilidades.</p>
 </div>
 );
 }
 return (
 <div className="flex flex-col gap-2">
 <Label className="app-field-label text-[11px]">
 Disponibilidad {slotLabel}
 </Label>
 <div className="rounded-lg border border-border p-2">
 {scheduleLoading ? (
 <p className="text-[11px] text-muted-foreground text-center py-2">Cargando disponibilidades...</p>
 ) : slots.length === 0 ? (
 <p className="text-[11px] text-muted-foreground text-center py-2">No hay slots disponibles para esta fecha.</p>
 ) : (
 <>
 <div className="flex flex-wrap gap-1.5">
 {slots.map((slot) => (
 <button
 key={slot.time}
 type="button"
 disabled={readOnly || !slot.available}
 onClick={() => assignSlot(slot.time)}
 className={`px-2 py-1 rounded-md text-[10px] font-medium transition-colors ${
 !slot.available
 ? "bg-muted/50 text-muted-foreground/50 cursor-not-allowed line-through"
 : slot.extra
 ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/20"
 : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20"
 } ${currentValue === `${selectedDate}T${slot.time}` ? "ring-2 ring-primary" : ""}`}
 title={slot.bookedInfo || (slot.extra ? "Horario extra (fuera de 09-19)" : "Horario normal")}
 >
 {slot.time}
 {slot.extra && <span className="ml-1 text-[8px]">★</span>}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border text-[9px] text-muted-foreground">
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500/30" /> Normal 09-19</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-amber-500/30" /> Extra ★</span>
 <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-muted" /> Ocupado</span>
 </div>
 </>
 )}

 {/* Botón para horario personalizado */}
 {!readOnly && (
 <div className="mt-2 pt-2 border-t border-border">
 {!showCustomTime ? (
 <button
 type="button"
 onClick={() => setShowCustomTime(true)}
 className="text-[10px] text-sky-600 hover:underline"
 >
 + Asignar horario personalizado
 </button>
 ) : (
 <div className="flex items-center gap-2">
 <Input
 type="time"
 className="app-input h-7 text-[11px] w-auto"
 value={customTime}
 onChange={(e) => setCustomTime(e.target.value)}
 />
 <button
 type="button"
 onClick={assignCustom}
 className="px-2 py-1 rounded-md text-[10px] font-medium bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 border border-sky-500/20"
 >
 Asignar
 </button>
 <button
 type="button"
 onClick={() => setShowCustomTime(false)}
 className="text-[10px] text-muted-foreground hover:underline"
 >
 Cancelar
 </button>
 </div>
 )}
 </div>
 )}
 </div>
 {daysToIssue && daysToIssue > 0 && !isPast && (
 <p className="text-[9px] text-muted-foreground">Máx: {daysToIssue} días desde hoy</p>
 )}
 </div>
 );
 }

 // ─── Modo FULL: panel calendario unificado ───
 // Calcular si la fecha seleccionada excede daysToIssue (alarma, no bloqueo)
 const isOverMaxDate = daysToIssue && daysToIssue > 0 && selectedDate ? (() => {
 const maxDate = new Date();
 maxDate.setDate(maxDate.getDate() + daysToIssue);
 const sel = new Date(selectedDate + "T23:59:59");
 return sel > maxDate;
 })() : false;

 // Formatear fecha seleccionada para mostrar
 const selectedDateLabel = selectedDate
 ? new Date(selectedDate + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" })
 : null;

 return (
 <div className="flex flex-col gap-1.5">
 {/* Label arriba */}
 <div className="flex items-center justify-between">
 <Label className="app-field-label text-[11px]">
 {field.label} {field.required && <span className="text-red-500">*</span>}
 </Label>
 </div>

 {/* Control doble: fecha centrada a la izquierda, slots a la derecha */}
 <div className="flex flex-col sm:flex-row gap-2">
 {/* Columna izquierda: date picker + fecha centrada verticalmente */}
 <div className="flex flex-col justify-center gap-1 sm:w-[110px] shrink-0">
 <DatePicker
 value={selectedDate}
 onChange={(v) => setSelectedDate(v)}
 placeholder="dd-mm-aaaa"
 disabled={readOnly}
 minDate={todayLocal}
 className={`w-full ${isOverMaxDate ? "border-amber-500" : ""}`}
 />
 {currentValue && valDate && (
 <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 w-fit text-[11px] px-1 py-0">
 ✓ {valDate.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" })}
 </Badge>
 )}
 {selectedDateLabel && (
 <p className="text-[10px] text-muted-foreground capitalize leading-tight">{selectedDateLabel}</p>
 )}
 </div>

 {/* Columna derecha: slots + barra inferior con info */}
 {inspectorId && selectedDate ? (
 <div className="flex-1 min-w-0 flex flex-col gap-1">
 {scheduleLoading ? (
 <p className="text-[10px] text-muted-foreground py-2">Cargando disponibilidades...</p>
 ) : slots.length === 0 ? (
 <p className="text-[10px] text-muted-foreground py-2">No hay slots disponibles.</p>
 ) : (
 <>
 {/* Grid de slots — 12 columnas, compactos (24px) */}
 <div className="grid grid-cols-12 gap-1">
 {slots.map((slot) => (
 <button
 key={slot.time}
 type="button"
 disabled={readOnly || !slot.available}
 onClick={() => assignSlot(slot.time)}
 className={`h-6 max-h-[24px] rounded text-[10px] font-medium transition-colors flex items-center justify-center gap-0.5 ${
 !slot.available
 ? "bg-muted/40 text-muted-foreground/40 cursor-not-allowed line-through border border-border/30"
 : slot.extra
 ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 border border-amber-500/20"
 : "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 border border-emerald-500/20"
 } ${currentValue === `${selectedDate}T${slot.time}` ? "ring-2 ring-primary bg-primary/5" : ""}`}
 title={slot.bookedInfo || `${slot.label}${slot.extra ? " (extra)" : ""}`}
 >
 {slot.time}
 {slot.extra && <span className="text-[7px]">★</span>}
 </button>
 ))}
 </div>
 {/* Barra inferior: tipo + leyenda + horario personalizado */}
 <div className="flex flex-wrap items-center gap-2 mt-0.5 pt-1 border-t border-border/30 text-[9px] text-muted-foreground">
 <span className="font-medium text-foreground/80">
 {inspectionType === "remote" ? "Remota · 30 min" : "Presencial · 3 hrs"}
 </span>
 <div className="flex flex-wrap items-center gap-2 ml-auto">
 <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded bg-emerald-500/40" /> 09-19</span>
 <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded bg-amber-500/40" /> Extra ★</span>
 <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded bg-muted" /> Ocupado</span>
 </div>
 {!readOnly && (
 <button
 type="button"
 onClick={() => setShowCustomTime(true)}
 className="text-sky-600 hover:underline ml-1"
 >
 + Horario personalizado
 </button>
 )}
 </div>
 {showCustomTime && !readOnly && (
 <div className="flex items-center gap-1.5">
 <Input
 type="time"
 className="app-input h-6 text-[10px] w-auto"
 value={customTime}
 onChange={(e) => setCustomTime(e.target.value)}
 />
 <button
 type="button"
 onClick={assignCustom}
 className="px-2 py-0.5 rounded text-[9px] font-medium bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 border border-sky-500/20"
 >
 Asignar
 </button>
 <button
 type="button"
 onClick={() => setShowCustomTime(false)}
 className="text-[9px] text-muted-foreground hover:underline"
 >
 Cancelar
 </button>
 </div>
 )}
 </>
 )}
 </div>
 ) : !selectedDate ? (
 <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground py-2">
 Seleccione una fecha para ver horarios.
 </div>
 ) : (
 <div className="flex-1 flex items-center justify-center text-[10px] text-muted-foreground py-2">
 Seleccione un inspector para ver disponibilidades.
 </div>
 )}
 </div>

 {/* Alertas compactas abajo */}
 {(isPast || isOverMaxDate || (daysToIssue && daysToIssue > 0 && !isPast && !isOverMaxDate)) && (
 <div className="flex flex-wrap gap-2 text-[9px]">
 {isPast && <span className="text-red-600 font-medium">⚠ Fecha en el pasado.</span>}
 {isOverMaxDate && <span className="text-amber-600 font-medium">⚠ Excede máx {daysToIssue} días.</span>}
 {daysToIssue && daysToIssue > 0 && !isPast && !isOverMaxDate && (
 <span className="text-muted-foreground">Máx: {daysToIssue} días</span>
 )}
 </div>
 )}
 </div>
 );
}

// ═══════════════════════════════════════════════════════════════
// DocumentWorkspace — Sistema de documentos de gestión con versionado,
// lock para edición offline y conversión a PDF.
//
// Flujo:
// 1. Si no hay documento: muestra 2 opciones (Plantilla del sistema / Subir Word/Excel/PPT)
// 2. Si hay documento editable: muestra el documento actual con botones
//    (Descargar con lock, Subir Nueva Versión, Historial, Convertir a PDF)
// 3. Si hay PDF: muestra el PDF como documento final (acción cerrada)
//
// El botón "Convertir a PDF" aparece según el flag is_dispatch_applicable
// del action_template:
//   - false: aparece en todos los estados donde la gestión funciona
//   - true: aparece SOLO en estado "despacho", solo despachadores
// ═══════════════════════════════════════════════════════════════

interface ClaimActionDocument {
  id: string;
  claim_action_id: string;
  version: number;
  source: string;
  document_template_id: string | null;
  file_url: string;
  file_path: string;
  file_name: string;
  original_filename: string | null;
  mime_type: string;
  file_size: number | null;
  file_type: "docx" | "xlsx" | "pptx" | "pdf";
  workflow_level: string | null;
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  created_by: string | null;
  created_at: string;
  is_current: boolean;
  locked_by_user?: { id: string; full_name: string; email: string } | null;
  created_by_user?: { id: string; full_name: string; email: string } | null;
  document_template?: { id: string; name: string; file_name: string } | null;
}

function DocumentTemplatesView({ action, readOnly }: { action: ActionWithRelations; readOnly?: boolean }) {
  return <DocumentWorkspace action={action} readOnly={readOnly} />;
}

function DocumentWorkspace({ action, readOnly }: { action: ActionWithRelations; readOnly?: boolean }) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar el claim para obtener company_id y event_id (filtros de plantillas)
  const { data: claim } = useQuery({
    queryKey: ["claim", action.claim_id],
    queryFn: () => getClaimById(action.claim_id),
    enabled: !!action.claim_id,
  });

  // Cargar el documento actual de la gestión
  const { data: currentDocData, isLoading: docLoading } = useQuery({
    queryKey: ["claim-action-document-current", action.id],
    queryFn: async () => {
      const res = await fetch(`/api/claims/actions/${action.id}/documents?current=true`);
      if (!res.ok) throw new Error("Error al cargar documento");
      return res.json() as Promise<{ document: ClaimActionDocument | null }>;
    },
    enabled: !!action.id,
  });

  const currentDoc = currentDocData?.document || null;
  const hasPdf = currentDoc?.file_type === "pdf";
  const hasEditable = currentDoc && currentDoc.file_type !== "pdf";

  // Cargar plantillas disponibles (solo para el picker)
  const actionTemplateId = action.action_template_id || undefined;
  const { data: templates } = useQuery({
    queryKey: ["doc-templates-for-action", actionTemplateId, claim?.company_id, claim?.event_id],
    queryFn: () =>
      getDocumentTemplates({
        actionTemplateId,
        companyId: claim?.company_id || undefined,
        eventId: claim?.event_id || undefined,
      }),
    enabled: !!actionTemplateId && !hasEditable && !hasPdf,
  });

  // ─── Mutaciones ───

  // Generar desde plantilla
  const generateMut = useMutation({
    mutationFn: async (templateId: string) => {
      const res = await fetch(`/api/claims/actions/${action.id}/generate-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al generar documento" }));
        throw new Error(err.error || "Error al generar documento");
      }
      return res.json() as Promise<{ document: ClaimActionDocument }>;
    },
    onSuccess: () => {
      toast.success("Documento generado correctamente");
      queryClient.invalidateQueries({ queryKey: ["claim-action-document-current", action.id] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", action.claim_id] });
      setShowTemplatePicker(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Subir documento (nuevo o nueva versión)
  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/claims/actions/${action.id}/upload-document`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al subir documento" }));
        throw new Error(err.error || "Error al subir documento");
      }
      return res.json() as Promise<{ document: ClaimActionDocument }>;
    },
    onSuccess: () => {
      toast.success("Documento subido correctamente");
      queryClient.invalidateQueries({ queryKey: ["claim-action-document-current", action.id] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", action.claim_id] });
      setShowUpload(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Lock + descargar (al hacer click en Descargar, se bloquea primero)
  const lockAndDownloadMut = useMutation({
    mutationFn: async () => {
      if (!currentDoc) throw new Error("No hay documento");
      const res = await fetch(`/api/claims/actions/${action.id}/documents/${currentDoc.id}/lock`, {
        method: "POST",
      });
      if (res.status === 409) {
        const err = await res.json();
        throw new Error(`Documento bloqueado por ${err.lockedBy?.full_name || "otro usuario"}`);
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al bloquear" }));
        throw new Error(err.error || "Error al bloquear");
      }
      return res.json() as Promise<{ document: ClaimActionDocument }>;
    },
    onSuccess: (data) => {
      // Abrir descarga en nueva pestaña
      window.open(data.document.file_url, "_blank");
      queryClient.invalidateQueries({ queryKey: ["claim-action-document-current", action.id] });
      toast.success("Documento descargado y bloqueado para edición. Subí la nueva versión cuando termines.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Unlock (al subir nueva versión, se desbloquea automáticamente desde el backend)
  const unlockMut = useMutation({
    mutationFn: async () => {
      if (!currentDoc) throw new Error("No hay documento");
      const res = await fetch(`/api/claims/actions/${action.id}/documents/${currentDoc.id}/unlock`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al desbloquear" }));
        throw new Error(err.error || "Error al desbloquear");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claim-action-document-current", action.id] });
      toast.success("Documento desbloqueado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Force unlock (admin)
  const forceUnlockMut = useMutation({
    mutationFn: async () => {
      if (!currentDoc) throw new Error("No hay documento");
      const res = await fetch(`/api/claims/actions/${action.id}/documents/${currentDoc.id}/force-unlock`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al forzar desbloqueo" }));
        throw new Error(err.error || "Error al forzar desbloqueo");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["claim-action-document-current", action.id] });
      toast.success("Documento desbloqueado forzadamente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Convertir a PDF
  const convertPdfMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/claims/actions/${action.id}/convert-to-pdf`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al convertir a PDF" }));
        throw new Error(err.error || "Error al convertir a PDF");
      }
      return res.json() as Promise<{ document: ClaimActionDocument }>;
    },
    onSuccess: () => {
      toast.success("PDF generado — gestión cerrada y publicada");
      queryClient.invalidateQueries({ queryKey: ["claim-action-document-current", action.id] });
      queryClient.invalidateQueries({ queryKey: ["claim-actions", action.claim_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ─── Render ───

  if (docLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-muted-foreground text-[11px]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando documento...
      </div>
    );
  }

  // Caso 1: No hay documento → mostrar opciones para crear
  if (!currentDoc) {
    return (
      <div className="space-y-2">
        {readOnly && (
          <p className="text-[10px] text-muted-foreground italic">
            La gestión no tiene documento.
          </p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            disabled={readOnly}
            onClick={() => setShowTemplatePicker(true)}
            className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-3 text-left hover:border-[#0095DA]/50 hover:bg-[#0095DA]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0095DA]/10">
              <FileText className="h-4 w-4 text-[#0095DA]" />
            </div>
            <div>
              <p className="text-[11px] font-medium">Plantilla del sistema</p>
              <p className="text-[10px] text-muted-foreground">Generar Word/Excel/PPT con datos del siniestro</p>
            </div>
          </button>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => setShowUpload(true)}
            className="flex flex-col items-start gap-1.5 rounded-lg border border-border p-3 text-left hover:border-[#0095DA]/50 hover:bg-[#0095DA]/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10">
              <Upload className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] font-medium">Subir documento</p>
              <p className="text-[10px] text-muted-foreground">Word, Excel o PowerPoint</p>
            </div>
          </button>
        </div>

        {/* Modal: Picker de plantillas */}
        {showTemplatePicker && (
          <DocumentTemplatePicker
            templates={templates || []}
            isLoading={!templates}
            onPick={(id) => generateMut.mutate(id)}
            onClose={() => setShowTemplatePicker(false)}
            isGenerating={generateMut.isPending}
          />
        )}

        {/* Modal: Upload */}
        {showUpload && (
          <DocumentUploadDialog
            onUpload={(file) => uploadMut.mutate(file)}
            onClose={() => setShowUpload(false)}
            isUploading={uploadMut.isPending}
            accept=".docx,.xlsx,.pptx"
            title="Subir documento"
            description="Subí un archivo Word, Excel o PowerPoint. No se pueden subir PDFs directamente."
          />
        )}
      </div>
    );
  }

  // Caso 2/3: Hay documento (editable o PDF)
  const isLockedByOther = currentDoc.locked_by && currentDoc.locked_by !== action.issued_by;
  const isLockedByMe = currentDoc.locked_by && currentDoc.locked_by === action.issued_by;
  const FileIconCmp = currentDoc.file_type === "xlsx" ? FileSpreadsheet : currentDoc.file_type === "pptx" ? Presentation : currentDoc.file_type === "pdf" ? FileIcon : FileText;
  const fileColor = currentDoc.file_type === "pdf" ? "text-red-600" : "text-[#0095DA]";

  return (
    <div className="space-y-2">
      {/* Documento actual */}
      <div className="rounded-lg border border-border p-3 space-y-2">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-${currentDoc.file_type === "pdf" ? "red" : "[#0095DA]"}/10`}>
            <FileIconCmp className={`h-4 w-4 ${fileColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-medium truncate">
                {currentDoc.original_filename || currentDoc.file_name}
              </p>
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 uppercase">
                v{currentDoc.version}
              </Badge>
              {currentDoc.file_type === "pdf" && (
                <Badge className="text-[9px] px-1 py-0 h-4 bg-red-500/10 text-red-600 border-red-200 dark:border-red-900/50">
                  PDF Final
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              {currentDoc.file_name} · {formatFileSize(currentDoc.file_size)} · {formatDate(currentDoc.created_at)}
              {currentDoc.created_by_user && ` · ${currentDoc.created_by_user.full_name}`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="btn-neutral btn-icon shrink-0"
            title="Historial de versiones"
          >
            <History className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Indicador de lock */}
        {currentDoc.locked_by && (
          <div className="flex items-center gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 px-2 py-1.5">
            <Lock className="h-3.5 w-3.5 text-amber-600" />
            <span className="text-[10px] text-amber-700 dark:text-amber-400 flex-1">
              Bloqueado por {currentDoc.locked_by_user?.full_name || "otro usuario"}
              {currentDoc.lock_expires_at && ` · expira ${formatDate(currentDoc.lock_expires_at)}`}
            </span>
            {isLockedByMe && (
              <button
                type="button"
                onClick={() => unlockMut.mutate()}
                disabled={unlockMut.isPending}
                className="text-[10px] text-amber-700 dark:text-amber-400 hover:underline"
              >
                Desbloquear
              </button>
            )}
            {isLockedByOther && (
              <button
                type="button"
                onClick={() => forceUnlockMut.mutate()}
                disabled={forceUnlockMut.isPending}
                className="text-[10px] text-red-600 hover:underline"
              >
                Forzar desbloqueo
              </button>
            )}
          </div>
        )}

        {/* Botones de acción */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {/* Descargar (con lock) — solo para documentos editables */}
            {hasEditable && !currentDoc.locked_by && (
              <button
                type="button"
                onClick={() => lockAndDownloadMut.mutate()}
                disabled={lockAndDownloadMut.isPending}
                className="pg-btn-platinum"
                title="Descargar para editar offline (bloquea el documento)"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar
              </button>
            )}

            {/* Subir nueva versión — solo para documentos editables */}
            {hasEditable && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMut.isPending}
                className="pg-btn-platinum"
                title="Subir nueva versión del documento"
              >
                <Upload className="h-3.5 w-3.5" />
                Subir
              </button>
            )}

            {/* Convertir a PDF — solo para documentos editables, después del último nivel */}
            {hasEditable && (
              <button
                type="button"
                onClick={() => convertPdfMut.mutate()}
                disabled={convertPdfMut.isPending}
                className="pg-btn-platinum"
                title="Convertir documento a PDF (cierra la gestión)"
              >
                {convertPdfMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileIcon className="h-3.5 w-3.5" />}
                PDF
              </button>
            )}

            {/* Descargar PDF — solo para PDFs */}
            {hasPdf && (
              <a
                href={currentDoc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pg-btn-platinum"
                title="Descargar PDF final"
              >
                <Download className="h-3.5 w-3.5" />
                Descargar
              </a>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,.xlsx,.pptx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMut.mutate(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Mensaje si es PDF (acción cerrada) */}
        {hasPdf && (
          <div className="flex items-center gap-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 px-2 py-1.5">
            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
            <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
              Gestión cerrada y publicada — el PDF es el documento final
            </span>
          </div>
        )}
      </div>

      {/* Modal: Historial de versiones */}
      {showHistory && (
        <DocumentVersionHistory actionId={action.id} onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DocumentTemplatePicker — Modal para elegir una plantilla del sistema
// ═══════════════════════════════════════════════════════════════

function DocumentTemplatePicker({
  templates,
  isLoading,
  onPick,
  onClose,
  isGenerating,
}: {
  templates: DocumentTemplate[];
  isLoading: boolean;
  onPick: (id: string) => void;
  onClose: () => void;
  isGenerating: boolean;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="modal-md" showCloseButton>
        <div className="modal-header">
          <DialogTitle className="modal-title">Plantilla del sistema</DialogTitle>
          <DialogDescription className="modal-subtitle">
            Elegí una plantilla para generar el documento con los datos del siniestro
          </DialogDescription>
        </div>
        <div className="modal-body space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-[11px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando plantillas...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[11px] text-muted-foreground">No hay plantillas configuradas para esta gestión.</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Configurá plantillas en Catálogos → Gestiones → Plantillas de Documento
              </p>
            </div>
          ) : (
            templates.map((tpl) => {
              const placeholders = tpl.detected_placeholders || [];
              const fileType = tpl.file_type || "docx";
              const Icon = fileType === "xlsx" ? FileSpreadsheet : fileType === "pptx" ? Presentation : FileText;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  disabled={isGenerating}
                  onClick={() => onPick(tpl.id)}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-left hover:border-[#0095DA]/50 hover:bg-[#0095DA]/5 transition-colors w-full disabled:opacity-50"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#0095DA]/10">
                    <Icon className="h-4 w-4 text-[#0095DA]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium truncate">{tpl.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {tpl.file_name}
                      {placeholders.length > 0 && ` · ${placeholders.length} placeholder${placeholders.length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <Play className="h-3.5 w-3.5 text-emerald-600" />
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="modal-footer">
          <Button className="pg-btn-platinum" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// DocumentUploadDialog — Modal para subir un archivo
// ═══════════════════════════════════════════════════════════════

function DocumentUploadDialog({
  onUpload,
  onClose,
  isUploading,
  accept,
  title,
  description,
}: {
  onUpload: (file: File) => void;
  onClose: () => void;
  isUploading: boolean;
  accept: string;
  title: string;
  description: string;
}) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="modal-md" showCloseButton>
        <div className="modal-header">
          <DialogTitle className="modal-title">{title}</DialogTitle>
          <DialogDescription className="modal-subtitle">{description}</DialogDescription>
        </div>
        <div className="modal-body space-y-3">
          <div
            onClick={() => inputRef.current?.click()}
            className="cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center hover:border-[#0095DA]/50 hover:bg-[#0095DA]/5 transition-colors"
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-[11px] text-muted-foreground">
              {selectedFile ? selectedFile.name : "Hacé click para seleccionar un archivo"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Formatos aceptados: {accept}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setSelectedFile(file);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <Button className="pg-btn-platinum" onClick={onClose}>Cancelar</Button>
          <Button
            className="pg-btn-platinum"
            disabled={!selectedFile || isUploading}
            onClick={() => selectedFile && onUpload(selectedFile)}
          >
            {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            Subir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════
// DocumentVersionHistory — Modal con historial de versiones
// ═══════════════════════════════════════════════════════════════

function DocumentVersionHistory({ actionId, onClose }: { actionId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["claim-action-documents", actionId],
    queryFn: async () => {
      const res = await fetch(`/api/claims/actions/${actionId}/documents`);
      if (!res.ok) throw new Error("Error al cargar historial");
      return res.json() as Promise<{ documents: ClaimActionDocument[] }>;
    },
  });

  const restoreMut = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/claims/actions/${actionId}/documents/${docId}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error al restaurar" }));
        throw new Error(err.error || "Error al restaurar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Versión restaurada");
      queryClient.invalidateQueries({ queryKey: ["claim-action-document-current", actionId] });
      queryClient.invalidateQueries({ queryKey: ["claim-action-documents", actionId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="modal-md" showCloseButton>
        <div className="modal-header">
          <DialogTitle className="modal-title">Historial de versiones</DialogTitle>
          <DialogDescription className="modal-subtitle">
            Todas las versiones del documento de la gestión
          </DialogDescription>
        </div>
        <div className="modal-body space-y-1.5">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground text-[11px]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando historial...
            </div>
          ) : !data?.documents || data.documents.length === 0 ? (
            <p className="text-center py-8 text-[11px] text-muted-foreground">No hay versiones</p>
          ) : (
            data.documents.map((doc) => {
              const Icon = doc.file_type === "xlsx" ? FileSpreadsheet : doc.file_type === "pptx" ? Presentation : doc.file_type === "pdf" ? FileIcon : FileText;
              const color = doc.file_type === "pdf" ? "text-red-600" : "text-[#0095DA]";
              const sourceLabel = {
                template: "Plantilla",
                upload_docx: "Subido",
                upload_xlsx: "Subido",
                upload_pptx: "Subido",
                pdf_conversion: "Conversión PDF",
              }[doc.source] || doc.source;
              return (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5"
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-${doc.file_type === "pdf" ? "red" : "[#0095DA]"}/10`}>
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-medium">v{doc.version}</p>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                        {sourceLabel}
                      </Badge>
                      {doc.is_current && (
                        <Badge className="text-[9px] px-1 py-0 h-4 bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900/50">
                          Actual
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {doc.original_filename || doc.file_name} · {formatFileSize(doc.file_size)} · {formatDate(doc.created_at)}
                      {doc.created_by_user && ` · ${doc.created_by_user.full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-neutral btn-icon"
                      title="Descargar"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                    {!doc.is_current && doc.file_type !== "pdf" && (
                      <button
                        type="button"
                        onClick={() => restoreMut.mutate(doc.id)}
                        disabled={restoreMut.isPending}
                        className="btn-neutral btn-icon"
                        title="Restaurar esta versión"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="modal-footer">
          <Button className="pg-btn-platinum" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ───

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}
