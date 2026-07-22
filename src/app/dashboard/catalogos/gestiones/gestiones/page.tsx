"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePagination } from "@/hooks/use-pagination";
import { useTableSort } from "@/hooks/use-table-sort";
import { Pagination } from "@/components/ui/pagination";
import { SortableTh } from "@/components/ui/sortable-th";
import {
 getActionTemplates,
 getActionTypes,
 getActionFeatures,
 getBusinessLinesForActions,
 getClaimStatuses,
 type ActionTemplate,
} from "@/services/actions";
// Server actions con validación server-side (permisos + campos inmutables)
import {
 createGestion,
 updateGestion,
 deleteGestion,
 setGestionClaimStatuses,
} from "@/server/actions/gestiones";
import { getInsuranceCompanies, getCountries, getEvents } from "@/services/catalogs";
import { getCompanies } from "@/services/companies";
import { toast } from "sonner";
import {
 Search, Pencil, Ban, FileSpreadsheet, Check,
 Clock, ArrowLeft, X,
 ChevronRight, FileText, Send, CheckCircle2, Settings2,
 AlertTriangle, Shield,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { userTypeLabels } from "@/services/permissions";
import { useAuth } from "@/hooks/use-auth";
import { getFieldPermissions, type FieldPermission } from "@/services/field-permissions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { Textarea } from "@/components/ui/textarea";
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from "@/components/ui/select";
import { DocumentTemplatesCard } from "./document-templates-card";
import { CamposPlantillaModal } from "./campos-plantilla-modal";

interface FormState {
 action_type_id: string;
 action_features_id: string;
 line_business_id: string;
 name: string;
 description: string;
 code: string;
 is_blocker: boolean;
 review_levels: number;
 is_dispatch_applicable: boolean;
 days_to_issue: number;
 days_to_review: number;
 days_to_approve: number;
 days_to_alert_to_issue: number;
 days_to_alert_to_review: number;
 days_to_alert_to_approve: number;
 issuer_roles: string[];
 reviewer_roles: string[];
 approver_roles: string[];
 default_issuer_role: string | null;
 default_reviewer_role: string | null;
 default_approver_role: string | null;
 claim_status_ids: string[];
}

const emptyForm: FormState = {
 action_type_id: "",
 action_features_id: "",
 line_business_id: "",
 name: "",
 description: "",
 code: "",
 is_blocker: false,
 review_levels: 1,
 is_dispatch_applicable: false,
 days_to_issue: 1,
 days_to_review: 0,
 days_to_approve: 0,
 days_to_alert_to_issue: 0,
 days_to_alert_to_review: 0,
 days_to_alert_to_approve: 0,
 issuer_roles: [],
 reviewer_roles: [],
 approver_roles: [],
 default_issuer_role: null,
 default_reviewer_role: null,
 default_approver_role: null,
 claim_status_ids: [],
};

export default function GestionesPage() {
 const queryClient = useQueryClient();
 const { canCreate, canEdit, canDelete } = usePermissions();
 const { profile } = useAuth();
 const [search, setSearch] = useState("");
 const [filterFeature, setFilterFeature] = useState("");
 const [filterLine, setFilterLine] = useState("");
 const [showInactive, setShowInactive] = useState(false);
 const [mode, setMode] = useState<"list" | "edit">("list");
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState<FormState>(emptyForm);
 const [camposModalOpen, setCamposModalOpen] = useState(false);

 // Field-level permissions: qué campos puede editar este rol
 const { data: fieldPerms } = useQuery<FieldPermission[]>({
 queryKey: ["field-permissions", profile?.role, "catalogos_gestiones"],
 queryFn: () => getFieldPermissions(profile!.role, "catalogos_gestiones"),
 enabled: !!profile?.role,
 });

 // Helper: ¿este campo es editable para el rol actual?
 // Solo aplica en modo edición (al crear, todos los campos están habilitados).
 // Si no hay permiso configurado para el campo, default = editable.
 const fieldRestricted = new Set(
 (fieldPerms ?? []).filter(p => !p.can_edit).map(p => p.field_name)
 );
 const isFieldDisabled = (fieldName: string): boolean => {
 if (!editingId) return false; // creando: todo habilitado
 return fieldRestricted.has(fieldName);
 };

 const { data: templates, isLoading, error } = useQuery({
 queryKey: ["action-templates"],
 queryFn: () => getActionTemplates(true),
 });
 const { data: types } = useQuery({ queryKey: ["action-types"], queryFn: getActionTypes });
 const { data: features } = useQuery({ queryKey: ["action-features-v2"], queryFn: getActionFeatures, staleTime: 0, refetchOnMount: true });
 const { data: businessLines } = useQuery({ queryKey: ["business-lines-actions"], queryFn: getBusinessLinesForActions });
 const { data: claimStatuses } = useQuery({ queryKey: ["claim-statuses"], queryFn: getClaimStatuses });
 const { data: clients } = useQuery({ queryKey: ["companies-list"], queryFn: getCompanies });
 const { data: insuranceCompanies } = useQuery({ queryKey: ["insurance-companies-list"], queryFn: getInsuranceCompanies });
 const { data: countries } = useQuery({ queryKey: ["countries-list"], queryFn: getCountries });
 const { data: events } = useQuery({ queryKey: ["events-list"], queryFn: getEvents });

 const createMut = useMutation({
 mutationFn: async (data: FormState) => {
 const { claim_status_ids, ...rest } = data;
 const created = await createGestion({
 ...rest,
 line_business_id: rest.line_business_id || null,
 });
 if (claim_status_ids.length > 0) {
 await setGestionClaimStatuses(created.id, claim_status_ids);
 }
 return created;
 },
 onSuccess: () => { toast.success("Gestión creada"); queryClient.invalidateQueries({ queryKey: ["action-templates"] }); setMode("list"); resetForm(); },
 onError: (e: Error) => toast.error(e.message),
 });

 const updateMut = useMutation({
 mutationFn: async ({ id, data }: { id: string; data: FormState }) => {
 const { claim_status_ids, ...rest } = data;
 await updateGestion(id, {
 ...rest,
 // action_features_id y line_business_id son inmutables en update;
 // el server action valida que no hayan cambiado vs BD.
 // Se envían para que el server pueda comparar.
 });
 await setGestionClaimStatuses(id, claim_status_ids);
 },
 onSuccess: () => { toast.success("Gestión actualizada"); queryClient.invalidateQueries({ queryKey: ["action-templates"] }); setMode("list"); setEditingId(null); },
 onError: (e: Error) => toast.error(e.message),
 });

 const deleteMut = useMutation({
 mutationFn: deleteGestion,
 onSuccess: () => { toast.success("Gestión desactivada"); queryClient.invalidateQueries({ queryKey: ["action-templates"] }); },
 onError: (e: Error) => toast.error(e.message),
 });

 const filtered = templates?.filter((t) => {
 const matchText = [t.name, t.code, t.action_type?.name, t.action_feature?.name]. join(" ").toLowerCase().includes(search.toLowerCase());
 const matchFeature = !filterFeature || t.action_features_id === filterFeature;
 const matchLine = !filterLine || t.line_business_id === filterLine;
 const matchActive = showInactive || t.is_active;
 return matchText && matchFeature && matchLine && matchActive;
 });

 // Sort con accessors para campos anidados
 const { sorted, sortKey, sortDir, toggleSort } = useTableSort(filtered, {
 name: (t: ActionTemplate) => t.name,
 code: (t: ActionTemplate) => (t.line_business?.code_prefix || "") + (t.action_feature?.code || ""),
 action_type: (t: ActionTemplate) => t.action_type?.name || "",
 action_feature: (t: ActionTemplate) => t.action_feature?.name || "",
 line_business: (t: ActionTemplate) => t.line_business?.name || "",
 days_to_issue: (t: ActionTemplate) => t.days_to_issue,
 is_active: (t: ActionTemplate) => t.is_active,
 }, "name");

 const { page, pageSize, total, totalPages, paginatedData, setPage, setPageSize } = usePagination(sorted);

 const resetForm = () => setForm(emptyForm);

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.name.trim()) { toast.error("El nombre es requerido"); return; }
 if (!form.action_type_id) { toast.error("El tipo es requerido"); return; }
 if (!form.action_features_id) { toast.error("La característica es requerida"); return; }
 // Validar que las alertas no excedan los días de vencimiento
 if (form.days_to_alert_to_issue > form.days_to_issue) { toast.error("La alerta de emisor no puede ser mayor que los días de vencimiento"); return; }
 if (form.review_levels >= 2 && form.days_to_alert_to_review > form.days_to_review) { toast.error("La alerta de revisor no puede ser mayor que los días de vencimiento"); return; }
 if (form.review_levels >= 3 && form.days_to_alert_to_approve > form.days_to_approve) { toast.error("La alerta de aprobador no puede ser mayor que los días de vencimiento"); return; }
 if (editingId) { updateMut.mutate({ id: editingId, data: form }); }
 else { createMut.mutate(form); }
 };

 const toggleStatus = (id: string) => {
 setForm(f => ({
 ...f,
 claim_status_ids: f.claim_status_ids.includes(id)
 ? f.claim_status_ids.filter(s => s !== id)
 : [...f.claim_status_ids, id],
 }));
 };

 const startEdit = (t: NonNullable<typeof templates>[number]) => {
 setEditingId(t.id);
 setForm({
 action_type_id: t.action_type_id,
 action_features_id: t.action_features_id,
 line_business_id: t.line_business_id || "",
 name: t.name,
 description: t.description || "",
 code: t.code || "",
 is_blocker: t.is_blocker,
 review_levels: t.review_levels ?? 1,
 is_dispatch_applicable: t.is_dispatch_applicable ?? false,
 days_to_issue: t.days_to_issue,
 days_to_review: t.days_to_review,
 days_to_approve: t.days_to_approve,
 days_to_alert_to_issue: t.days_to_alert_to_issue,
 days_to_alert_to_review: t.days_to_alert_to_review,
 days_to_alert_to_approve: t.days_to_alert_to_approve,
 issuer_roles: t.issuer_roles || [],
 reviewer_roles: t.reviewer_roles || [],
 approver_roles: t.approver_roles || [],
 default_issuer_role: t.default_issuer_role || null,
 default_reviewer_role: t.default_reviewer_role || null,
 default_approver_role: t.default_approver_role || null,
 claim_status_ids: t.claim_statuses?.map(cs => cs.claim_status_id) || [],
 });
 setMode("edit");
 };

 const startNew = () => {
 setEditingId(null);
 resetForm();
 setMode("edit");
 };

 const cancelEdit = () => {
 setMode("list");
 setEditingId(null);
 resetForm();
 };

 // ═══════════════════════════════════════════════════════════════
 // MODO EDICIÓN — Pantalla completa (estructura por cards estilo McLarens mejorado)
 // ═══════════════════════════════════════════════════════════════
 if (mode === "edit") {
 const saving = createMut.isPending || updateMut.isPending;

 // Roles disponibles para todos los niveles del workflow
 // Estos corresponden a los valores reales de profiles.role
 const WORKFLOW_ROLES = Object.entries(userTypeLabels).map(([value, label]) => ({ value, label }));

 const toggleRole = (
 rolesField: "issuer_roles" | "reviewer_roles" | "approver_roles",
 role: string
 ) => {
 const current = form[rolesField];
 const defaultField = rolesField === "issuer_roles" ? "default_issuer_role"
 : rolesField === "reviewer_roles" ? "default_reviewer_role"
 : "default_approver_role";
 const currentDefault = form[defaultField as keyof typeof form] as string | null;
 const isRemoving = current.includes(role);

 let newRoles: string[];
 let newDefault: string | null;

 if (isRemoving) {
 // Quitar el rol
 newRoles = current.filter(r => r !== role);
 // Si el rol quitado era el default, asignar el primero de los restantes
 if (currentDefault === role) {
 newDefault = newRoles.length > 0 ? newRoles[0] : null;
 } else {
 newDefault = currentDefault;
 }
 } else {
 // Agregar el rol
 newRoles = [...current, role];
 // Si no hay default, este rol pasa a ser el default automáticamente
 if (!currentDefault) {
 newDefault = role;
 } else {
 newDefault = currentDefault;
 }
 }

 setForm({
 ...form,
 [rolesField]: newRoles,
 [defaultField]: newDefault,
 });
 };

 const toggleDefaultRole = (
 rolesField: "issuer_roles" | "reviewer_roles" | "approver_roles",
 role: string
 ) => {
 const defaultField = rolesField === "issuer_roles" ? "default_issuer_role"
 : rolesField === "reviewer_roles" ? "default_reviewer_role"
 : "default_approver_role";
 const currentDefault = form[defaultField as keyof typeof form] as string | null;
 // No permitir quitar el default — solo cambiar a otro rol
 // Si se click el que ya es default, no hacer nada (siempre debe haber uno)
 if (currentDefault === role) return;
 setForm({
 ...form,
 [defaultField]: role,
 });
 };

 // Configuración visual por nivel — paleta profesional
 const STEP_CONFIG = {
 issuer: {
 color: "text-sky-600 dark:text-sky-400",
 bg: "bg-sky-500/8 dark:bg-sky-500/10",
 border: "border-sky-500/25 dark:border-sky-500/20",
 ring: "ring-sky-500/20",
 checkBg: "bg-sky-500/15",
 checkBorder: "border-sky-500/40",
 },
 reviewer: {
 color: "text-violet-600 dark:text-violet-400",
 bg: "bg-violet-500/8 dark:bg-violet-500/10",
 border: "border-violet-500/25 dark:border-violet-500/20",
 ring: "ring-violet-500/20",
 checkBg: "bg-violet-500/15",
 checkBorder: "border-violet-500/40",
 },
 approver: {
 color: "text-emerald-600 dark:text-emerald-400",
 bg: "bg-emerald-500/8 dark:bg-emerald-500/10",
 border: "border-emerald-500/25 dark:border-emerald-500/20",
 ring: "ring-emerald-500/20",
 checkBg: "bg-emerald-500/15",
 checkBorder: "border-emerald-500/40",
 },
 } as const;

 // Render de un nivel del workflow como tarjeta profesional
 const renderWorkflowStep = (cfg: {
 key: "issuer" | "reviewer" | "approver";
 title: string;
 icon: React.ReactNode;
 rolesField: "issuer_roles" | "reviewer_roles" | "approver_roles";
 defaultField: "default_issuer_role" | "default_reviewer_role" | "default_approver_role";
 daysField: "days_to_issue" | "days_to_review" | "days_to_approve";
 alertField: "days_to_alert_to_issue" | "days_to_alert_to_review" | "days_to_alert_to_approve";
 }) => {
 const selectedRoles = form[cfg.rolesField];
 const defaultRole = form[cfg.defaultField];
 const daysValue = form[cfg.daysField];
 const alertValue = form[cfg.alertField];
 const alertInvalid = alertValue > daysValue;
 const rolesDisabled = isFieldDisabled(cfg.rolesField);
 const daysDisabled = isFieldDisabled(cfg.daysField);
 const alertDisabled = isFieldDisabled(cfg.alertField);
 const sty = STEP_CONFIG[cfg.key];

 const clampDays = (n: number) => Math.max(0, Math.min(999, isNaN(n) ? 0 : n));
 const clampAlert = (n: number) => Math.max(0, Math.min(999, isNaN(n) ? 0 : n));

 return (
 <div className={`rounded-lg border ${sty.border} bg-card overflow-hidden transition-shadow hover:shadow-sm`}>
 {/* Header con color del nivel */}
 <div className={`flex items-center gap-2 px-3 py-2 ${sty.bg} border-b ${sty.border}`}>
 <span className={`flex h-5 w-5 items-center justify-center rounded-md ${sty.bg} ${sty.color} shrink-0`}>
 {cfg.icon}
 </span>
 <span className={`text-[12px] font-semibold ${sty.color}`}>{cfg.title}</span>
 </div>
 {/* Body */}
 <div className="p-3 space-y-3">
 {/* Roles — chips clicables con pelotita verde de "por defecto" */}
 <div className="space-y-1.5">
 <div className="flex items-center justify-between">
 <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">Roles</span>
 {selectedRoles.length > 0 && (
 <span className="text-[9px] text-muted-foreground/50">Click en la pelotita verde para marcar el rol por defecto</span>
 )}
 </div>
 <div className="flex flex-wrap gap-1">
 {WORKFLOW_ROLES.map(r => {
 const active = selectedRoles.includes(r.value);
 const isDefault = defaultRole === r.value;
 return (
 <div key={r.value} className="relative inline-flex">
 <button
 type="button"
 onClick={() => !rolesDisabled && toggleRole(cfg.rolesField, r.value)}
 disabled={rolesDisabled}
 className={`px-2 py-0.5 pr-6 rounded-md text-[11px] font-medium border transition-all ${
 active
 ? `${sty.checkBorder} ${sty.checkBg} ${sty.color}`
 : "border-border text-muted-foreground hover:bg-muted/50 hover:border-border/80"
 } ${rolesDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
 >
 {r.label}
 </button>
 {/* Pelotita verde de "por defecto" */}
 {active && (
 <button
 type="button"
 onClick={(e) => {
 e.stopPropagation();
 if (!rolesDisabled) toggleDefaultRole(cfg.rolesField, r.value);
 }}
 disabled={rolesDisabled}
 title={isDefault ? "Rol por defecto (click para quitar)" : "Marcar como rol por defecto"}
 className={`absolute top-1/2 right-1 -translate-y-1/2 h-3 w-3 rounded-full border transition-all ${
 isDefault
 ? "bg-emerald-500 border-emerald-600 dark:border-emerald-400 shadow-sm"
 : "bg-transparent border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-500/20"
 } ${rolesDisabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
 />
 )}
 </div>
 );
 })}
 </div>
 </div>
 {/* SLA — Vencimiento + Alerta apilados */}
 <div className="space-y-2 pt-2.5 border-t border-border/50">
 {/* Vencimiento */}
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5">
 <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
 <span className="text-[11px] text-muted-foreground">Vence</span>
 </div>
 <div className="flex items-center gap-1">
 <Input
 type="number"
 min={0}
 max={999}
 value={daysValue ?? 0}
 onChange={(e) => {
 const newDays = clampDays(parseInt(e.target.value));
 const currentAlert = form[cfg.alertField];
 setForm({ ...form, [cfg.daysField]: newDays, [cfg.alertField]: Math.min(currentAlert, newDays) });
 }}
 disabled={daysDisabled}
 style={{ borderRadius: "6px", height: "28px", width: "56px", padding: 0, fontSize: "12px" }}
 className="border border-border bg-card text-center font-semibold tabular-nums focus-visible:ring-1 focus-visible:ring-primary/30"
 />
 <span className="text-[10px] text-muted-foreground shrink-0 w-6">días</span>
 </div>
 </div>
 {/* Alerta */}
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-1.5">
 <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${alertInvalid ? "text-red-500" : "text-muted-foreground"}`} />
 <span className="text-[11px] text-muted-foreground">Alerta</span>
 </div>
 <div className="flex items-center gap-1">
 <Input
 type="number"
 min={0}
 max={999}
 value={alertValue ?? 0}
 onChange={(e) => setForm({ ...form, [cfg.alertField]: clampAlert(parseInt(e.target.value)) })}
 disabled={alertDisabled}
 style={{ borderRadius: "6px", height: "28px", width: "56px", padding: 0, fontSize: "12px" }}
 className={`bg-card text-center font-semibold tabular-nums focus-visible:ring-1 focus-visible:ring-primary/30 border ${
 alertInvalid ? "border-red-500/60" : "border-border"
 }`}
 />
 <span className="text-[10px] text-muted-foreground shrink-0 w-6">días</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 };

 return (
 <div className="app-page">
 {/* Breadcrumbs */}
 <nav className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
 <button type="button" onClick={cancelEdit} className="hover:text-foreground transition-colors">
 Gestiones
 </button>
 <ChevronRight className="h-3 w-3" />
 <span className="text-foreground font-medium">
 {form.name || (editingId ? "Editar" : "Nueva")}
 </span>
 </nav>

 {/* Header con botón volver + título */}
 <div className="flex items-center justify-between mb-4">
 <div className="flex items-center gap-3">
 <button
 type="button"
 onClick={cancelEdit}
 className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
 >
 <ArrowLeft className="h-4 w-4" />
 </button>
 <div>
 <h1 className="app-page-title flex items-center gap-2">
 <FileSpreadsheet className="h-5 w-5 text-[#0095DA]" />
 {editingId ? "Editar Gestión" : "Nueva Gestión"}
 </h1>
 <p className="app-page-lead">
 {editingId ? form.name : "Configura una nueva gestión para los siniestros."}
 </p>
 </div>
 </div>
 {/* Botón para abrir el catálogo de campos de plantillas — solo si la característica soporta templates */}
 {(() => {
 const feat = features?.find(f => f.id === form.action_features_id);
 if (!feat?.has_template) return null;
 return (
 <button
 type="button"
 onClick={() => setCamposModalOpen(true)}
 className="pg-btn-platinum"
 title="Ver campos disponibles para plantillas Word"
 >
 Campos
 </button>
 );
 })()}
 </div>

 <form autoComplete="off" onSubmit={handleSubmit} id="gestion-form" className="space-y-4">
 {/* Layout 2 columnas en xl: izq = Config + Workflow, der = Plantillas */}
 <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4 items-start">
 {/* Columna izquierda: Configuración + Workflow */}
 <div className="space-y-4">
 {/* ═══ Card: Configuración ═══ */}
 <section className="app-panel !p-0 overflow-hidden">
 {/* Header bar de la card */}
 <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5 bg-muted/30">
 <div className="flex items-center gap-2">
 <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
 <h3 className="text-[12px] font-semibold text-foreground">Configuración</h3>
 </div>
 </div>
 {/* Body */}
 <div className="p-4 space-y-3">
 {/* Fila 1: Código + Nombre + Tipo (3 cols) */}
 <div className="grid grid-cols-3 gap-x-4 gap-y-2">
 <div className="flex flex-col gap-1">
 <Label className="text-[10px] text-muted-foreground">Código</Label>
 <div className="app-input flex items-center px-2 font-mono text-muted-foreground bg-muted/40">
 {(() => {
 const feat = features?.find(f => f.id === form.action_features_id);
 const line = businessLines?.find(b => b.id === form.line_business_id);
 const prefix = line?.code_prefix || "";
 const featCode = feat?.code || "";
 return (prefix + featCode) || "—";
 })()}
 </div>
 </div>
 <div className="flex flex-col gap-1">
 <Label className="text-[10px] text-muted-foreground">
 Nombre <span className="text-red-500">*</span>
 </Label>
 <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej: Coordinación de Inspección" className="app-input" disabled={isFieldDisabled("name")} />
 </div>
 <div className="flex flex-col gap-1">
 <Label className="text-[10px] text-muted-foreground">
 Tipo <span className="text-red-500">*</span>
 </Label>
 <Select value={form.action_type_id || null} onValueChange={(v) => setForm({ ...form, action_type_id: v ?? "" })} items={types?.map(t => ({ value: t.id, label: t.name })) || []}>
 <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
 <SelectContent>{types?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 </div>

 {/* Fila 2: Característica + Línea + Despacho (3 cols) */}
 <div className="grid grid-cols-3 gap-x-4 gap-y-2">
 <div className="flex flex-col gap-1">
 <Label className="text-[10px] text-muted-foreground">
 Característica <span className="text-red-500">*</span>
 {editingId && <span className="text-amber-600 ml-1">(inmutable)</span>}
 </Label>
 <Select
 value={form.action_features_id}
 onValueChange={(v) => {
 const feat = features?.find(f => f.id === v);
 setForm({ ...form, action_features_id: v || "", is_dispatch_applicable: feat?.has_template ? form.is_dispatch_applicable : false });
 }}
 items={features?.map(f => ({ value: f.id, label: f.code ? `${f.name} (${f.code})` : f.name })) || []}
 disabled={!!editingId}
 >
 <SelectTrigger className="app-input"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
 <SelectContent>{features?.map(f => <SelectItem key={f.id} value={f.id}>{f.code ? `${f.name} (${f.code})` : f.name}</SelectItem>)}</SelectContent>
 </Select>
 {/* Resumen compacto de la característica seleccionada */}
 {(() => {
 const feat = features?.find(f => f.id === form.action_features_id);
 if (!feat) return null;
 const tipo = feat.has_template ? "Pantalla + Templates" : "Pantalla";
 return (
 <div className="flex flex-wrap items-center gap-1 mt-1">
 <span className="app-badge app-badge-active">{tipo}</span>
 <span className="app-badge app-badge-active">
 Máx. {feat.max_review_levels} nivel{feat.max_review_levels !== 1 ? "es" : ""}
 </span>
 </div>
 );
 })()}
 </div>
 <div className="flex flex-col gap-1">
 <Label className="text-[10px] text-muted-foreground">
 Línea de Negocio
 {editingId && <span className="text-amber-600 ml-1">(inmutable)</span>}
 </Label>
 <Select
 value={form.line_business_id || "__none"}
 onValueChange={(v) => setForm({ ...form, line_business_id: v === "__none" || v === null ? "" : v })}
 items={businessLines?.map(b => ({ value: b.id, label: b.code_prefix ? `${b.name} (${b.code_prefix})` : b.name })) || []}
 disabled={!!editingId}
 >
 <SelectTrigger className="app-input"><SelectValue placeholder="Sin selección" /></SelectTrigger>
 <SelectContent><SelectItem value="__none">Sin selección</SelectItem>{businessLines?.map(b => <SelectItem key={b.id} value={b.id}>{b.code_prefix ? `${b.name} (${b.code_prefix})` : b.name}</SelectItem>)}</SelectContent>
 </Select>
 </div>
 {/* Despacho: solo visible si la característica tiene templates */}
 {(() => {
 const feat = features?.find(f => f.id === form.action_features_id);
 if (!feat?.has_template) return <div />; // celda vacía para mantener el grid de 3
 return (
 <div className="flex flex-col gap-1">
 <Label className="text-[10px] text-muted-foreground" title="Si está activo, solo el perfil Despachador puede convertir el documento a PDF después de completar todas las revisiones">
 Solo despachador convierte a PDF
 </Label>
 <div className="flex h-7 items-center gap-2">
 <Switch
 checked={form.is_dispatch_applicable}
 onCheckedChange={(v) => setForm({ ...form, is_dispatch_applicable: v })}
 disabled={isFieldDisabled("is_dispatch_applicable")}
 />
 <span className="text-[11px] text-muted-foreground">{form.is_dispatch_applicable ? "Sí" : "No"}</span>
 </div>
 </div>
 );
 })()}
 </div>

 {/* Descripción full-width */}
 <div className="flex flex-col gap-1">
 <Label className="text-[10px] text-muted-foreground">Descripción</Label>
 <Textarea
 value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 placeholder="Describe el objetivo y alcance de esta gestión..."
 className="app-input min-h-[50px] resize-y"
 rows={2}
 disabled={isFieldDisabled("description")}
 />
 </div>

 {/* Bloqueante + Estados de liquidación */}
 <div className="flex flex-col gap-3">
 {(() => {
 const canBlock = form.review_levels >= 1 && form.days_to_issue > 0;
 return (
 <div className="flex items-center gap-2 flex-wrap">
 <ToggleChip
 active={form.is_blocker}
 onClick={(v) => setForm({ ...form, is_blocker: v })}
 disabled={!canBlock || isFieldDisabled("is_blocker")}
 icon={<Shield className="h-3 w-3" />}
 >
 Bloqueante
 </ToggleChip>
 {canBlock && form.is_blocker && (
 <span className="text-[10px] text-muted-foreground">Bloquea login si hay tareas atrasadas</span>
 )}
 {!canBlock && (
 <span className="text-[10px] text-amber-600">Requiere workflow con días &gt; 0</span>
 )}
 </div>
 );
 })()}
 {/* Estados de liquidación donde aplica */}
 <div>
 <Label className="text-[10px] text-muted-foreground mb-1.5 block">
 Estados de liquidación donde aplica
 </Label>
 <div className="flex flex-wrap gap-1.5">
 {claimStatuses?.map(cs => {
 const active = form.claim_status_ids.includes(cs.id);
 return (
 <button
 key={cs.id}
 type="button"
 onClick={() => toggleStatus(cs.id)}
 className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] transition-colors ${
 active
 ? "border-primary bg-primary/10 text-primary font-medium"
 : "border-border text-muted-foreground hover:bg-muted/50"
 }`}
 >
 <Check className={`h-2.5 w-2.5 ${active ? "opacity-100" : "opacity-0"}`} />
 {cs.name}
 </button>
 );
 })}
 {(!claimStatuses || claimStatuses.length === 0) && (
 <span className="text-[10px] text-muted-foreground">No hay estados configurados.</span>
 )}
 </div>
 </div>
 </div>
 </div>
 </section>
 <section className="app-panel">
 <h3 className="app-section-title">
 <Clock className="h-3.5 w-3.5" />
 Configuración del Workflow
 </h3>

 {/* Selector de niveles — segmented control profesional */}
 <div className="mb-4">
 <Label className="text-[10px] text-muted-foreground mb-2 block">
 Niveles de revisión
 {(() => {
 const feat = features?.find(f => f.id === form.action_features_id);
 return feat ? ` (máx. ${feat.max_review_levels} según característica)` : "";
 })()}
 </Label>
 {(() => {
 const feat = features?.find(f => f.id === form.action_features_id);
 const maxLevels = feat?.max_review_levels ?? 3;
 if (form.review_levels > maxLevels) {
 setForm({ ...form, review_levels: maxLevels });
 }
 const levelsDisabled = isFieldDisabled("review_levels");
 const options = [
 { value: 0, label: "Sin workflow" },
 { value: 1, label: "Emisión" },
 { value: 2, label: "Emisión + Revisión" },
 { value: 3, label: "Emisión + Revisión + Aprobación" },
 ];
 return (
 <div className="flex gap-1.5 flex-wrap">
 {options.map(opt => {
 const disabled = opt.value > maxLevels || levelsDisabled;
 const active = form.review_levels === opt.value;
 return (
 <button
 key={opt.value}
 type="button"
 disabled={disabled}
 onClick={() => setForm({ ...form, review_levels: opt.value })}
 className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
 active
 ? "border-primary bg-primary/10 text-primary"
 : "border-border text-muted-foreground hover:bg-muted/50"
 } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
 >
 {opt.label}
 </button>
 );
 })}
 </div>
 );
 })()}
 </div>

 {/* Steps según el nivel seleccionado — 3 tarjetas lado a lado */}
 {form.review_levels === 0 ? (
 <div className="rounded-lg border border-dashed border-border/60 p-4 text-center text-[12px] text-muted-foreground">
 Esta gestión no tiene workflow de revisión.
 </div>
 ) : (
 <div className="grid grid-cols-3 gap-2">
 {form.review_levels >= 1 && renderWorkflowStep({
 key: "issuer",
 title: "Emisión",
 icon: <Send className="h-3 w-3" />,
 rolesField: "issuer_roles",
 defaultField: "default_issuer_role",
 daysField: "days_to_issue",
 alertField: "days_to_alert_to_issue",
 })}
 {form.review_levels >= 2 && renderWorkflowStep({
 key: "reviewer",
 title: "Revisión",
 icon: <FileText className="h-3 w-3" />,
 rolesField: "reviewer_roles",
 defaultField: "default_reviewer_role",
 daysField: "days_to_review",
 alertField: "days_to_alert_to_review",
 })}
 {form.review_levels >= 3 && renderWorkflowStep({
 key: "approver",
 title: "Aprobación",
 icon: <CheckCircle2 className="h-3 w-3" />,
 rolesField: "approver_roles",
 defaultField: "default_approver_role",
 daysField: "days_to_approve",
 alertField: "days_to_alert_to_approve",
 })}
 </div>
 )}

 </section>
 </div>{/* /columna izquierda */}

 {/* Columna derecha: Templates */}
 <div>
 {/* ═══ Card: Templates ═══ */}
 {(() => {
 const feat = features?.find(f => f.id === form.action_features_id);
 const hasTemplate = feat?.has_template ?? false;
 if (!hasTemplate) {
 return (
 <section className="app-panel">
 <h3 className="app-section-title">
 <FileText className="h-3.5 w-3.5" />
 Templates
 </h3>
 <div className="app-empty-state flex flex-col items-center gap-2">
 <AlertTriangle className="h-5 w-5 text-amber-500" />
 <span>Esta característica no soporta templates.</span>
 <span className="text-[10px]">
 La pantalla asociada no tiene flujo de templates. Asigná una pantalla con campo &laquo;Templates&raquo; en el catálogo de pantallas para habilitar esta sección.
 </span>
 </div>
 </section>
 );
 }
 if (!editingId) {
 return (
 <section className="app-panel">
 <h3 className="app-section-title">
 <FileText className="h-3.5 w-3.5" />
 Templates
 </h3>
 <div className="app-empty-state">
 Guarda la gestión primero para configurar sus templates.
 </div>
 </section>
 );
 }
 return (
 <DocumentTemplatesCard
 actionTemplateId={editingId}
 events={events?.map((e) => ({ id: e.id, name: e.name })) || []}
 clients={clients?.map((c) => ({ id: c.id, name: c.name })) || []}
 insuranceCompanies={insuranceCompanies?.map((c) => ({ id: c.id, name: c.name })) || []}
 countries={countries?.map((c) => ({ id: c.id, name: c.name })) || []}
 />
 );
 })()}
 </div>{/* /columna derecha */}
 </div>{/* /grid 2 columnas */}

 {/* ═══ Footer con botones ═══ */}
 <div className="flex items-center justify-end gap-2 pt-2">
 <button type="button" className="pg-btn-platinum" onClick={cancelEdit}>
 Cancelar
 </button>
 <button type="submit" form="gestion-form" disabled={saving} className="pg-btn-platinum">
 {saving ? "Guardando..." : editingId ? "Guardar" : "Crear"}
 </button>
 </div>
 </form>

 {/* Modal: catálogo de campos para plantillas */}
 <CamposPlantillaModal open={camposModalOpen} onOpenChange={setCamposModalOpen} />
 </div>
 );
 }

 // ═══════════════════════════════════════════════════════════════
 // MODO LISTA
 // ═══════════════════════════════════════════════════════════════
 return (
 <div className="app-page">
 <div className="app-grid-header">
 <div className="app-grid-header-left">
 <div className="app-grid-icon bg-linear-to-br from-[#0095DA] to-[#005BBB]">
 <FileSpreadsheet />
 </div>
 <div className="app-grid-title-row">
 <h1 className="app-page-title shrink-0">Gestiones</h1>
 </div>
 </div>
 <div className="app-grid-header-right">
 {canCreate("catalogos") && (
 <Button onClick={startNew} className="pg-btn-platinum">
 Nueva
 </Button>
 )}
 </div>
 </div>

 <div className="app-panel">
 <div className="app-grid-toolbar">
 <div className="app-grid-toolbar-left">
 <div className="app-grid-search-wrap">
 <Search />
 <Input
 className="liquid-search"
 placeholder="Buscar..."
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 />
 </div>
 <Select value={filterFeature || "__all"} onValueChange={(v) => setFilterFeature(v === "__all" || v === null ? "" : v)} items={[{ value: "__all", label: "Todas" }, ...(features || []).map(f => ({ value: f.id, label: f.code ? `${f.name} (${f.code})` : f.name }))]}>
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Todas" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__all">Todas</SelectItem>
 {features?.map(f => <SelectItem key={f.id} value={f.id}>{f.code ? `${f.name} (${f.code})` : f.name}</SelectItem>)}
 </SelectContent>
 </Select>
 <Select value={filterLine || "__all"} onValueChange={(v) => setFilterLine(v === "__all" || v === null ? "" : v)} items={[{ value: "__all", label: "Todas" }, ...(businessLines || []).map(b => ({ value: b.id, label: b.code_prefix ? `${b.name} (${b.code_prefix})` : b.name }))]}>
 <SelectTrigger className="app-input app-filter-narrow">
 <SelectValue placeholder="Todas" />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="__all">Todas</SelectItem>
 {businessLines?.map(b => <SelectItem key={b.id} value={b.id}>{b.code_prefix ? `${b.name} (${b.code_prefix})` : b.name}</SelectItem>)}
 </SelectContent>
 </Select>
 <ToggleChip
 active={showInactive}
 onClick={(v) => setShowInactive(v)}
 >
 Inactivas
 </ToggleChip>
 {(filterFeature || filterLine || search) && (
 <Button variant="ghost" size="sm" className="h-8 text-[12px] text-muted-foreground px-2" onClick={() => { setFilterFeature(""); setFilterLine(""); setSearch(""); setPage(1); }}>
 <X className="h-3.5 w-3.5" /> Limpiar
 </Button>
 )}
 </div>
 <Pagination variant="controls" page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
 </div>
 <div className="app-data-table-wrap">
 <table className="app-data-table">
 <thead><tr>
 <th className="w-10"></th>
 <SortableTh sortKey="code" currentKey={sortKey as string} direction={sortDir} onSort={(k) => toggleSort(k as never)}>Código</SortableTh>
 <SortableTh sortKey="name" currentKey={sortKey as string} direction={sortDir} onSort={(k) => toggleSort(k as never)}>Nombre</SortableTh>
 <SortableTh sortKey="action_type" currentKey={sortKey as string} direction={sortDir} onSort={(k) => toggleSort(k as never)}>Tipo</SortableTh>
 <SortableTh sortKey="action_feature" currentKey={sortKey as string} direction={sortDir} onSort={(k) => toggleSort(k as never)}>Característica</SortableTh>
 <SortableTh sortKey="line_business" currentKey={sortKey as string} direction={sortDir} onSort={(k) => toggleSort(k as never)}>Línea</SortableTh>
 <SortableTh sortKey="days_to_issue" currentKey={sortKey as string} direction={sortDir} onSort={(k) => toggleSort(k as never)}>SLA</SortableTh>
 <th className="w-[80px]"></th>
 </tr></thead>
 <tbody>
 {isLoading ? <tr><td colSpan={8} className="text-center text-muted-foreground py-4">Cargando...</td></tr>
 : error ? <tr><td colSpan={8} className="text-center text-red-500 py-4">Error: {error.message}</td></tr>
 : paginatedData.length === 0 ? <tr><td colSpan={8} className="text-center text-muted-foreground py-4">No se encontraron registros.</td></tr>
 : paginatedData.map((t) => (
 <tr key={t.id}>
 <td><span className={`inline-block h-2 w-2 rounded-full ${t.is_active ? "bg-emerald-500" : "bg-zinc-400"}`} /></td>
 <td className="text-muted-foreground font-mono">
 {(() => {
 const prefix = t.line_business?.code_prefix || "";
 const featCode = t.action_feature?.code || "";
 return (prefix + featCode) || "—";
 })()}
 </td>
 <td className="font-medium">{t.name}</td>
 <td className="text-muted-foreground">{t.action_type?.name || "—"}</td>
 <td className="text-muted-foreground">{t.action_feature?.code ? `${t.action_feature.name} (${t.action_feature.code})` : t.action_feature?.name || "—"}</td>
 <td className="text-muted-foreground">{t.line_business?.code_prefix ? `${t.line_business.name} (${t.line_business.code_prefix})` : t.line_business?.name || "—"}</td>
 <td className="text-center">{t.days_to_issue}d</td>
 <td>
 <div className="app-row-actions">
 {canEdit("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm" onClick={() => startEdit(t)}><Pencil className="h-4 w-4" /></Button>
 )}
 {canDelete("catalogos") && (
 <Button variant="ghost" size="icon" className="btn-icon-sm btn-danger-hover" onClick={() => { if (confirm("¿Desactivar esta gestión?")) deleteMut.mutate(t.id); }}><Ban className="h-4 w-4" /></Button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <Pagination page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={setPageSize} />
 </div>
 </div>
 );
}
