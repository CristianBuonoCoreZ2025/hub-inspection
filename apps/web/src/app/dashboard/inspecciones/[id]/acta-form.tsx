"use client";

import { useState, useEffect, Fragment } from "react";
import { useForm, useWatch } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { actaSchema, type ActaInput } from "@/lib/validations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateInspectionSession, createThirdParty, updateThirdParty, deleteThirdParty, getInspectionSessionById, type SessionDetail } from "@/services/inspections";
import { useFlash } from "@/components/ui/alert-context";
import {
 Shield,
 Building,
 Hammer,
 FileText,
 Users,
 ClipboardList,
 CheckCircle,
 Lock,
 MapPin,
 AlertTriangle,
 XCircle,
 Loader2,
 Save,
 Trash2,
 Plus,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDatePicker } from "@/components/ui/form-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { useLookupCatalogs } from "@/hooks/use-lookup-catalog";
import { getPropertyClassifications, getHousingDestinations, getClassificationDestinations, getBuildingAges } from "@/services/catalogs";
import { resolveFieldConfig, filterClassificationsByDestination, getSortedVisibleFields } from "@/lib/field-config";
import { savePendingActa } from "@/lib/offline/sync-session";
import { useQuery } from "@tanstack/react-query";
import type { InspectionSession } from "@/types";
import type { OfflineCatalogs } from "@/db/offline-db";
import { getUserTimeZone } from "@/lib/timezone";

const steps = [
 { id: 1, label: "Datos Generales", icon: ClipboardList, key: "datos" },
 { id: 2, label: "Riesgo Siniestrado", icon: Building, key: "riesgo" },
 { id: 3, label: "Materialidad", icon: Hammer, key: "materialidad" },
 { id: 4, label: "Seguridad", icon: Shield, key: "seguridad" },
 { id: 5, label: "Declaracion", icon: FileText, key: "declaracion" },
 { id: 6, label: "Terceros", icon: Users, key: "terceros" },
];

interface ActaFormProps {
 session: SessionDetail;
 readOnly?: boolean;
 /** Si está en modo offline, guarda cambios en IndexedDB en vez de Supabase */
 offlineMode?: boolean;
 /** Callback al guardar offline (para refrescar estado del padre) */
 onOfflineSaved?: () => void;
 /** Catálogos descargados para uso offline */
 offlineCatalogs?: OfflineCatalogs;
 /** Si es mobile, usa botón icono; si es desktop, usa botón de texto */
 isMobile?: boolean;
}

export default function ActaForm({ session, readOnly = false, offlineMode = false, onOfflineSaved, offlineCatalogs, isMobile = false }: ActaFormProps) {
 const queryClient = useQueryClient();
 const flash = useFlash();
 const [step, setStep] = useState(1);

 const { catalogs: lookupCatalogs } = useLookupCatalogs([
 "interviewed_relationship",
 "materiality_walls",
 "materiality_roof",
 "materiality_flooring",
 "materiality_ceiling",
 "materiality_interior_finish",
 "materiality_exterior_finish",
 "materiality_closure",
 ]);

 const catalogs = offlineMode && offlineCatalogs ? offlineCatalogs.lookup_catalog : lookupCatalogs;

 // Catálogos desde tablas separadas
 const { data: propertyClassificationsQuery = [] } = useQuery({
 queryKey: ["property-classifications"],
 queryFn: getPropertyClassifications,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode,
 });
 const { data: housingDestinationsQuery = [] } = useQuery({
 queryKey: ["housing-destinations"],
 queryFn: getHousingDestinations,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode,
 });
 const { data: classificationDestinationsQuery = [] } = useQuery({
 queryKey: ["classification-destinations"],
 queryFn: getClassificationDestinations,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode,
 });
 const { data: buildingAgesQuery = [] } = useQuery({
 queryKey: ["building-ages"],
 queryFn: getBuildingAges,
 staleTime: 1000 * 60 * 30,
 enabled: !offlineMode,
 });

 const propertyClassifications = offlineMode && offlineCatalogs ? offlineCatalogs.property_classifications : propertyClassificationsQuery;
 const housingDestinations = offlineMode && offlineCatalogs ? offlineCatalogs.housing_destinations : housingDestinationsQuery;
 const classificationDestinations = offlineMode && offlineCatalogs ? offlineCatalogs.classification_destinations : classificationDestinationsQuery;
 const buildingAges = offlineMode && offlineCatalogs ? offlineCatalogs.building_ages : buildingAgesQuery;

 // Pre-llenar desde el siniestro: si el acta no tiene datos del entrevistado,
 // usar los del asegurado desde claims_participants
 const claim = session.claim as {
 claim_number?: string | null;
 claim_address?: string | null;
 claim_latitude?: number | null;
 claim_longitude?: number | null;
 claims_participants?: Array<{
 type: string;
 full_name: string | null;
 first_name: string | null;
 last_name: string | null;
 email: string | null;
 phone: string | null;
 cell_phone: string | null;
 rut?: string | null;
 }>;
 country?: { name: string } | null;
 region?: { name: string } | null;
 city?: { name: string } | null;
 commune?: { name: string } | null;
 destination_housing?: { name: string } | null;
 } | null | undefined;
 const participants = claim?.claims_participants || [];
 const insuredParticipant = participants.find((p) => p.type === "insured");
 const preInsuredName = insuredParticipant?.full_name || "";
 const preInsuredEmail = insuredParticipant?.email || "";

 const form = useForm<ActaInput>({
 resolver: standardSchemaResolver(actaSchema),
 defaultValues: {
 inspection_date: session.inspection_date || "",
 inspection_time: session.inspection_time || "",
 interviewed_name: session.interviewed_name || preInsuredName,
 interviewed_email: session.interviewed_email || preInsuredEmail,
 interviewed_relationship: session.interviewed_relationship || "",
 police_report_number: session.police_report_number || "",
 police_report_name: session.police_report_name || "",
 police_report_rut: session.police_report_rut || "",
 firefighters_company: session.firefighters_company || "",
 other_insurances: session.other_insurances || false,
 other_insurance_company: session.other_insurance_company || "",
 inspector_observations: session.inspector_observations || "",
 property_risk: {
 risk_type: "", risk_class: "", property_type: "", apartment_number: "",
 floor_count: "", age_years: "", built_surface: "", room_count: "",
 bathroom_count: "", office_count: "", warehouse_count: "",
 is_habitable: true, owner_name: preInsuredName, branch_count: "",
 worker_resident_count: "", business_line: "",
 ...(session.property_risk as Record<string, unknown> || {}),
 },
 property_materiality: {
 walls: "", roof: "", interior_flooring: "", interior_ceilings: "",
 interior_finishes: "", exterior_finishes: "", perimeter_closure: "", others: "",
 ...(session.property_materiality as Record<string, unknown> || {}),
 },
 security_measures: {
 protections: { has_it: false, detail: "" },
 security_locks: { has_it: false, detail: "" },
 security_guards: { has_it: false, detail: "" },
 alarms: { has_it: false, detail: "" },
 cameras: { has_it: false, detail: "" },
 other_measures: { has_it: false, detail: "" },
 ...(session.security_measures as Record<string, unknown> || {}),
 },
 insured_statement: {
 statement: "", entry_exit_point: "", alarm_activation: "",
 stolen_items_estimate: "", vehicle_use: "", incident_duration: "",
 ...(session.insured_statement as Record<string, unknown> || {}),
 },
 third_parties: session.third_parties || [],
 },
 });

 const [offlineSaving, setOfflineSaving] = useState(false);

 // Sincronizar la tabla third_parties con el campo JSON del acta
 const syncThirdPartiesTable = async (sessionId: string, actaThirdParties: Array<Record<string, unknown>>) => {
   const freshSession = await getInspectionSessionById(sessionId).catch(() => null);
   const serverThirdParties = (freshSession?.third_parties ?? []) as unknown as Array<{ id: string }>;
   const serverIds = new Set(serverThirdParties.map((t) => t.id));

   // Eliminar terceros que ya no están en el acta
   for (const serverTp of serverThirdParties) {
     const stillExists = actaThirdParties.some((tp) => tp.id === serverTp.id);
     if (!stillExists) {
       await deleteThirdParty(serverTp.id);
     }
   }

   // Crear o actualizar terceros del acta
   for (const tp of actaThirdParties) {
     const { id: _id, created_at: _c, updated_at: _u, ...rest } = tp;
     void _c; void _u;
     if (_id && serverIds.has(_id as string)) {
       // Ya existe: actualizar
       await updateThirdParty(_id as string, rest as Partial<import("@/types").ThirdParty>);
     } else {
       // No existe: crear
       void _id;
       await createThirdParty({
         ...rest,
         session_id: sessionId,
       } as Omit<import("@/types").ThirdParty, "id" | "created_at" | "updated_at">);
     }
   }
 };

 // Botón de guardar: texto "Grabar" en desktop, icono disquete en mobile
 const SaveButton = () => {
   const saving = saveMutation.isPending || offlineSaving;
   const useIconButton = isMobile || offlineMode;
   if (useIconButton) {
     return (
       <button
         type="submit"
         disabled={saving || readOnly}
         className="acta-save-btn"
         aria-label="Guardar"
       >
         {saving ? <Loader2 size={18} strokeWidth={2} className="animate-spin" /> : <Save size={18} strokeWidth={2} />}
       </button>
     );
   }
   return (
     <button
       type="submit"
       disabled={saving || readOnly}
       className="pg-btn-platinum"
       aria-label="Grabar"
     >
       {saving ? <><Loader2 size={14} strokeWidth={2} className="animate-spin mr-1" /> Guardando...</> : "Grabar"}
     </button>
   );
 };

 const saveMutation = useMutation({
 mutationFn: async (data: ActaInput) => {
   if (offlineMode) {
      await savePendingActa(session.id, {
       inspection_date: data.inspection_date || null,
       inspection_time: data.inspection_time || null,
       interviewed_name: data.interviewed_name || null,
       interviewed_email: data.interviewed_email || null,
       interviewed_relationship: data.interviewed_relationship || null,
       police_report_number: data.police_report_number || null,
       police_report_name: data.police_report_name || null,
       police_report_rut: data.police_report_rut || null,
       firefighters_company: data.firefighters_company || null,
       other_insurances: data.other_insurances,
       other_insurance_company: data.other_insurance_company || null,
       inspector_observations: data.inspector_observations || null,
       property_risk: data.property_risk,
       property_materiality: data.property_materiality,
       security_measures: data.security_measures,
       insured_statement: data.insured_statement,
       third_parties: data.third_parties,
     } as Partial<InspectionSession>);
     onOfflineSaved?.();
     return;
   }
   await updateInspectionSession(session.id, {
     inspection_date: data.inspection_date || null,
     inspection_time: data.inspection_time || null,
     interviewed_name: data.interviewed_name || null,
     interviewed_email: data.interviewed_email || null,
     interviewed_relationship: data.interviewed_relationship || null,
     police_report_number: data.police_report_number || null,
     police_report_name: data.police_report_name || null,
     police_report_rut: data.police_report_rut || null,
     firefighters_company: data.firefighters_company || null,
     other_insurances: data.other_insurances,
     other_insurance_company: data.other_insurance_company || null,
     inspector_observations: data.inspector_observations || null,
     property_risk: data.property_risk,
     property_materiality: data.property_materiality,
     security_measures: data.security_measures,
     insured_statement: data.insured_statement,
     third_parties: data.third_parties,
   } as Partial<InspectionSession>);
   // Sincronizar tabla third_parties
   await syncThirdPartiesTable(session.id, data.third_parties as Array<Record<string, unknown>>);
   return;
 },
 onSuccess: () => {
   if (!offlineMode) {
     queryClient.invalidateQueries({ queryKey: ["inspection-session", session.id] });
   }
   flash({ description: "Acta guardada", type: "success", duration: 800 });
 },
 onError: (err: Error) => flash({ description: err.message, type: "error" }),
 });

 const onSubmit = form.handleSubmit(async (data) => {
   if (offlineMode) {
     // En modo offline, llamar directamente sin useMutation
     // (useMutation puede colgarse si hay mutations online pendientes en el cache)
     setOfflineSaving(true);
     try {
       await savePendingActa(session.id, {
         inspection_date: data.inspection_date || null,
         inspection_time: data.inspection_time || null,
         interviewed_name: data.interviewed_name || null,
         interviewed_email: data.interviewed_email || null,
         interviewed_relationship: data.interviewed_relationship || null,
         police_report_number: data.police_report_number || null,
         police_report_name: data.police_report_name || null,
         police_report_rut: data.police_report_rut || null,
         firefighters_company: data.firefighters_company || null,
         other_insurances: data.other_insurances,
         other_insurance_company: data.other_insurance_company || null,
         inspector_observations: data.inspector_observations || null,
         property_risk: data.property_risk,
         property_materiality: data.property_materiality,
         security_measures: data.security_measures,
         insured_statement: data.insured_statement,
         third_parties: data.third_parties,
       } as Partial<InspectionSession>);
       flash({ description: "Acta guardada", type: "success", duration: 800 });
       // Resetear isDirty del form para que no muestre "Cambios sin guardar"
       form.reset(data);
       onOfflineSaved?.();
     } catch (err) {
       flash({ description: (err as Error).message, type: "error" });
     } finally {
       setOfflineSaving(false);
     }
     return;
   }
   saveMutation.mutate(data);
 });

 // Sincronizar el step del acta con el cliente (piloto automático)
 const currentStepKey = steps.find((s) => s.id === step)?.key || "datos";
 useEffect(() => {
   if (offlineMode) return;
   updateInspectionSession(session.id, { acta_step: currentStepKey }).catch(() => {});
 }, [currentStepKey, session.id, offlineMode]);

 // ── Reset risk_class si no está en las clasificaciones filtradas por destino ──
 const watchedPropertyType = useWatch({ control: form.control, name: "property_risk.property_type" as never });
 const watchedRiskClass = useWatch({ control: form.control, name: "property_risk.risk_class" as never });
 useEffect(() => {
  const propertyType = String(watchedPropertyType ?? "");
  const riskClass = String(watchedRiskClass ?? "");
  if (!riskClass || !propertyType) return;
  const filtered = filterClassificationsByDestination(
   propertyClassifications,
   housingDestinations,
   classificationDestinations,
   propertyType,
  );
  // No borrar mientras los catálogos aún cargan o si no hay filtros disponibles
  if (filtered.length === 0) return;
  const stillValid = filtered.some((c) => c.name === riskClass || c.id === riskClass);
  if (!stillValid) {
   form.setValue("property_risk.risk_class" as never, "" as never);
  }
 }, [watchedPropertyType, watchedRiskClass, propertyClassifications, housingDestinations, classificationDestinations, form]);

 // Helpers sin tipado estricto para evitar conflictos con react-hook-form + paths anidados
 const field = (name: string) => form.register(name as never);
 const watch = (name: string) => form.watch(name as never);
 const set = (name: string, value: unknown) => form.setValue(name as never, value as never, { shouldValidate: false, shouldDirty: true });

 const catalogSelect = (name: string, category: string, placeholder = "Seleccionar...") => {
 const items = catalogs[category] || [];
 const raw = watch(name);
 const current = raw ? String(raw) : null;
 return (
 <Select
 value={current}
 onValueChange={(v) => set(name, v ?? "")}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder={placeholder} />
 </SelectTrigger>
 <SelectContent>
 {items.length === 0 ? (
 <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Sin opciones</div>
 ) : (
 items.map((item) => (
 <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
 ))
 )}
 </SelectContent>
 </Select>
 );
 };

 const tableSelect = (name: string, items: { id: string; name: string }[], placeholder = "Seleccionar...") => {
 const raw = watch(name);
 const current = raw ? String(raw) : null;
 return (
 <Select
 value={current}
 onValueChange={(v) => set(name, v ?? "")}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder={placeholder} />
 </SelectTrigger>
 <SelectContent>
 {items.length === 0 ? (
 <div className="px-2 py-1.5 text-[11px] text-muted-foreground">Sin opciones</div>
 ) : (
 items.map((item) => (
 <SelectItem key={item.id} value={item.name}>{item.name}</SelectItem>
 ))
 )}
 </SelectContent>
 </Select>
 );
 };

 const numberSelect = (name: string, max: number, placeholder = "Seleccionar...") => {
 const raw = watch(name);
 const current = raw ? String(raw) : null;
 return (
 <Select
 value={current}
 onValueChange={(v) => set(name, v ?? "")}
 >
 <SelectTrigger className="app-input w-full">
 <SelectValue placeholder={placeholder} />
 </SelectTrigger>
 <SelectContent>
 {Array.from({ length: max }, (_, i) => String(i + 1)).map((n) => (
 <SelectItem key={n} value={n}>{n}</SelectItem>
 ))}
 {max >= 10 && <SelectItem value={`${max}+`}>{`${max}+`}</SelectItem>}
 </SelectContent>
 </Select>
 );
 };

 // Input numérico con sugerencias (datalist) — permite escribir cualquier número
 // pero muestra valores del catálogo como sugerencias.
 // Usa type="text" + inputMode="numeric" para que el navegador no bloquee
 // el submit cuando el value viene del catálogo con texto (ej: "5 Años").
 const numberInputWithSuggestions = (name: string, suggestions: { id: string; name: string }[], placeholder = "0") => {
 const raw = watch(name);
 const current = raw ? String(raw) : "";
 const listId = `${name.replace(/\./g, "-")}-suggestions`;
 return (
 <>
 <Input
 type="text"
 inputMode="numeric"
 list={listId}
 placeholder={placeholder}
 value={current}
 onChange={(e) => set(name, e.target.value)}
 className="app-input"
 />
 <datalist id={listId}>
 {suggestions.map((s) => (
 <option key={s.id} value={s.name} />
 ))}
 </datalist>
 </>
 );
 };

 return (
 <form onSubmit={onSubmit} className="app-stack">
 {/* Banner de solo lectura */}
 {readOnly && (
 <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
 <Lock className="h-3.5 w-3.5 shrink-0" />
 Inspección finalizada — el acta es de solo lectura
 </div>
 )}
 {/* Stepper horizontal — wizard de pasos */}
 <div className="acta-wizard">
 <div className="acta-wizard-steps">
 {steps.map((s, idx) => {
 const Icon = s.icon;
 const active = s.id === step;
 const completed = s.id < step;
 const isLast = idx === steps.length - 1;
 return (
 <Fragment key={s.id}>
 <button
 type="button"
 onClick={() => setStep(s.id)}
 className={`acta-wizard-step ${active ? "acta-wizard-step-active" : ""} ${completed ? "acta-wizard-step-done" : ""}`}
 >
 <span className="acta-wizard-step-num">
 {completed ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
 </span>
 <span className="acta-wizard-step-label">{s.label}</span>
 </button>
 {!isLast && (
 <span className={`acta-wizard-step-line ${completed ? "acta-wizard-step-line-done" : ""}`} />
 )}
 </Fragment>
 );
 })}
 </div>
 <div className="acta-wizard-progress">
 <span className="acta-wizard-progress-text">Paso {step} de {steps.length}</span>
 <div className="acta-wizard-progress-bar">
 <div className="acta-wizard-progress-fill" style={{ width: `${(step / steps.length) * 100}%` }} />
 </div>
 </div>
 </div>

 <fieldset disabled={readOnly} className="contents">

 {/* Paso 1: Datos Generales */}
 {step === 1 && (
 <div className="space-y-3">
 {/* Datos del Siniestro (readonly, vienen del claim) */}
 <div className="app-panel">
 <h3 className="app-section-title flex items-center justify-between gap-2">
 <span>Dirección del Siniestro</span>
 {!readOnly && (
 <SaveButton />
 )}
 </h3>
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 text-[11px]">
 <div>
 <span className="app-data-label">Dirección</span>
 <p className="font-medium">{claim?.claim_address || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Tipo</span>
 <p className="font-medium">{claim?.destination_housing?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">País</span>
 <p className="font-medium">{claim?.country?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Región</span>
 <p className="font-medium">{claim?.region?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Ciudad</span>
 <p className="font-medium">{claim?.city?.name || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Comuna</span>
 <p className="font-medium">{claim?.commune?.name || "—"}</p>
 </div>
 </div>
 </div>

 {/* Validación Geográfica */}
 <div className="app-panel">
 <h3 className="app-section-title">
 Validación Geográfica
 </h3>
 <GeoValidationBlock session={session} claim={claim} />
 </div>

 <div className="app-panel">
 <h3 className="app-section-title">
 Datos Generales de la Inspeccion
 </h3>
 <div className="modal-grid-5">
 <div className="modal-field">
 <Label className="app-field-label">Fecha Inspeccion</Label>
 <FormDatePicker control={form.control} name="inspection_date" disabled={readOnly} />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Hora Inspeccion</Label>
 <Input {...field("inspection_time")} type="time" className="app-input" disabled={readOnly} />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Nombre Entrevistado</Label>
 <Input {...field("interviewed_name")} placeholder="Gonzalo Meza" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Email Entrevistado</Label>
 <Input {...field("interviewed_email")} type="email" placeholder="Pamela@email.com" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Relacion con Asegurado</Label>
 {catalogSelect("interviewed_relationship", "interviewed_relationship", "Seleccionar...")}
 </div>
 </div>
 </div>

 <div className="app-panel">
 <h3 className="app-section-title">
 Parte Policial y Bomberos
 </h3>
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">N° Parte Policial</Label>
 <Input {...field("police_report_number")} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Nombre Denunciante</Label>
 <Input {...field("police_report_name")} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">RUT Denunciante</Label>
 <Input {...field("police_report_rut")} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Compañia Bomberos</Label>
 <Input {...field("firefighters_company")} placeholder="Nombre compañia" className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">¿Presenta otros seguros?</Label>
 <ToggleChip
 active={Boolean(watch("other_insurances"))}
 onClick={(v) => set("other_insurances", v)}
 >
 {watch("other_insurances") ? "Sí" : "No"}
 </ToggleChip>
 </div>
 {Boolean(watch("other_insurances")) && (
 <div className="modal-field">
 <Label className="app-field-label">Compañia</Label>
 <Input {...field("other_insurance_company")} className="app-input" />
 </div>
 )}
 </div>
 </div>

 <div className="app-panel">
 <h3 className="app-section-title">
 Observaciones del Inspector
 </h3>
 <div className="modal-field modal-field-full">
 <VoiceTextarea
 value={String(watch("inspector_observations") ?? "")}
 onChange={(v) => set("inspector_observations", v)}
 rows={5}
 placeholder="Observaciones finales del inspector sobre la inspeccion... (puede usar el microfono para transcribir)"
 disabled={readOnly}
 />
 </div>
 </div>
 </div>
 )}

 {/* Paso 2: Descripcion del Riesgo */}
 {step === 2 && (
 <div className="app-panel">
 <h3 className="app-section-title flex items-center justify-between gap-2">
 <span>Descripcion del Riesgo Siniestrado</span>
 {!readOnly && (
 <SaveButton />
 )}
 </h3>
 {(() => {
 const riskClass = String(watch("property_risk.risk_class") ?? "");
 const propertyType = String(watch("property_risk.property_type") ?? "");

 // ── Config dinámica desde la BD (dual-read) ──
 const { visible, labelFor, order } = resolveFieldConfig(
 riskClass,
 propertyType,
 propertyClassifications,
 housingDestinations,
 );
 // isFieldVisible no se necesita: getSortedVisibleFields ya filtra por visibilidad

 // ── Filtrar clasificaciones según destino seleccionado ──
 const filteredClassifications = filterClassificationsByDestination(
 propertyClassifications,
 housingDestinations,
 classificationDestinations,
 propertyType,
 );

 return (
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">Destino del Bien</Label>
 {tableSelect("property_risk.property_type", housingDestinations)}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Clasificacion del Bien</Label>
 {tableSelect("property_risk.risk_class", filteredClassifications)}
 </div>
 {getSortedVisibleFields(visible, order).map((key) => {
   const renderField = () => {
     switch (key) {
       case "age_years":
         return numberInputWithSuggestions("property_risk.age_years", buildingAges, "0");
       case "room_count":
         return numberSelect("property_risk.room_count", 20);
       case "bathroom_count":
         return numberSelect("property_risk.bathroom_count", 10);
       case "office_count":
         return numberSelect("property_risk.office_count", 20);
       case "warehouse_count":
         return numberSelect("property_risk.warehouse_count", 999);
       case "is_habitable":
         return (
           <ToggleChip
             active={Boolean(watch("property_risk.is_habitable"))}
             onClick={(v) => set("property_risk.is_habitable", v)}
           >
             {watch("property_risk.is_habitable") ? "Sí" : "No"}
           </ToggleChip>
         );
       case "apartment_number":
         return numberSelect("property_risk.apartment_number", 999);
       case "floor_count":
         return numberSelect("property_risk.floor_count", 99);
       case "built_surface":
         return <Input {...field("property_risk.built_surface")} type="number" placeholder="0" className="app-input" />;
       case "owner_name":
         return <Input {...field("property_risk.owner_name")} placeholder="Pamela Becerra" className="app-input" />;
       case "branch_count":
         return <Input {...field("property_risk.branch_count")} type="number" className="app-input" />;
       case "worker_resident_count":
         return <Input {...field("property_risk.worker_resident_count")} type="number" className="app-input" />;
       case "business_line":
         return <Input {...field("property_risk.business_line")} className="app-input" />;
       default:
         return null;
     }
   };
   return (
     <div key={key} className={`modal-field${key === "business_line" ? " modal-field-full" : ""}`}>
       <Label className="app-field-label">{labelFor(key)}</Label>
       {renderField()}
     </div>
   );
 })}
 </div>
 );
 })()}
 </div>
 )}

 {/* Paso 3: Materialidad */}
 {step === 3 && (
 <div className="app-panel">
 <h3 className="app-section-title flex items-center justify-between gap-2">
 <span>Materialidad del Inmueble</span>
 {!readOnly && (
 <SaveButton />
 )}
 </h3>
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">Muros</Label>
 {catalogSelect("property_materiality.walls", "materiality_walls")}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Cubierta / Techumbre</Label>
 {catalogSelect("property_materiality.roof", "materiality_roof")}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Pavimentos Interiores</Label>
 {catalogSelect("property_materiality.interior_flooring", "materiality_flooring")}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Cielos Interiores</Label>
 {catalogSelect("property_materiality.interior_ceilings", "materiality_ceiling")}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Terminaciones Interiores</Label>
 {catalogSelect("property_materiality.interior_finishes", "materiality_interior_finish")}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Terminaciones Exteriores</Label>
 {catalogSelect("property_materiality.exterior_finishes", "materiality_exterior_finish")}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Cierre Perimetral</Label>
 {catalogSelect("property_materiality.perimeter_closure", "materiality_closure")}
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Otros</Label>
 <Input {...field("property_materiality.others")} className="app-input" />
 </div>
 </div>
 </div>
 )}

 {/* Paso 4: Medidas de Seguridad */}
 {step === 4 && (
 <div className="app-panel">
 <h3 className="app-section-title flex items-center justify-between gap-2">
 <span>Medidas de Asegurabilidad</span>
 {!readOnly && (
 <SaveButton />
 )}
 </h3>
 <div className="space-y-2">
 {(
 [
 { key: "protections", label: "Protecciones Generales" },
 { key: "security_locks", label: "Chapas / Cerraduras de Seguridad" },
 { key: "security_guards", label: "Guardias de Seguridad" },
 { key: "alarms", label: "Alarmas" },
 { key: "cameras", label: "Camaras de Seguridad" },
 { key: "other_measures", label: "Otras Medidas" },
 ] as const
 ).map((item) => (
 <div key={item.key} className="flex items-start gap-3 rounded-lg border border-border p-2.5">
 <div className="pt-0.5 shrink-0">
 <ToggleChip
 active={Boolean(watch(`security_measures.${item.key}.has_it`))}
 onClick={(v) => {
 set(`security_measures.${item.key}.has_it`, v);
 // Si se desactiva el chip, limpiar el detalle
 if (!v) set(`security_measures.${item.key}.detail`, "");
 }}
 >
 {item.label}
 </ToggleChip>
 </div>
 <div className="flex-1 min-w-0">
 <Input
 name={`security_measures.${item.key}.detail`}
 value={String(watch(`security_measures.${item.key}.detail`) ?? "")}
 placeholder="Detalle..."
 className="app-input h-7 "
 onChange={(e) => {
 const val = e.target.value;
 // Si hay texto → activar automáticamente
 // Si no hay texto → desactivar automáticamente
 set(`security_measures.${item.key}.detail`, val);
 set(`security_measures.${item.key}.has_it`, val.trim().length > 0);
 }}
 />
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Paso 5: Declaracion del Asegurado */}
 {step === 5 && (
 <div className="app-panel">
 <h3 className="app-section-title flex items-center justify-between gap-2">
 <span>Declaracion del Asegurado</span>
 {!readOnly && (
 <SaveButton />
 )}
 </h3>
 <div className="modal-grid">
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Relato de los Hechos</Label>
 <VoiceTextarea
 value={String(watch("insured_statement.statement") ?? "")}
 onChange={(v) => set("insured_statement.statement", v)}
 rows={5}
 placeholder="De acuerdo a lo relatado por el Sr... (puede usar el micrófono para transcribir)"
 disabled={readOnly}
 />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Punto de Ingreso / Salida</Label>
 <Input {...field("insured_statement.entry_exit_point")} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Activacion de Alarmas</Label>
 <Input {...field("insured_statement.alarm_activation")} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Objetos Sustraidos (estimacion)</Label>
 <Input {...field("insured_statement.stolen_items_estimate")} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Uso de Vehiculos</Label>
 <Input {...field("insured_statement.vehicle_use")} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Duracion del Incidente</Label>
 <Input {...field("insured_statement.incident_duration")} className="app-input" />
 </div>
 </div>
 </div>
 )}

 {/* Paso 6: Terceros */}
 {step === 6 && (
 <div className="app-panel">
 <h3 className="app-section-title flex items-center justify-between gap-2">
 <span>Datos de Terceros</span>
 {!readOnly && (
 <SaveButton />
 )}
 </h3>
 <div className="space-y-3">
 {((watch("third_parties") as Array<Record<string, unknown>>) || []).map((_, idx) => (
 <div key={idx} className="rounded-lg border border-border p-3 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-[11px] font-medium">Tercero {idx + 1}</span>
 {!readOnly && (
 <button
 type="button"
 className="acta-save-btn"
 aria-label={`Eliminar tercero ${idx + 1}`}
 onClick={() => {
 const current = (watch("third_parties") as Array<Record<string, unknown>>) || [];
 set("third_parties", current.filter((_, i) => i !== idx));
 }}
 >
 <Trash2 size={18} strokeWidth={2} />
 </button>
 )}
 </div>
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">Tipo</Label>
 <Select
 value={String(watch(`third_parties.${idx}.party_type`) ?? "") || null}
 onValueChange={(v) => set(`third_parties.${idx}.party_type`, v)}
 >
 <SelectTrigger className="app-input">
 <SelectValue placeholder="Seleccionar..." />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="afectado">Afectado</SelectItem>
 <SelectItem value="responsable">Responsable / Culpable</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Nombre Completo</Label>
 <Input {...field(`third_parties.${idx}.full_name`)} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">RUT</Label>
 <Input {...field(`third_parties.${idx}.rut`)} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Direccion</Label>
 <Input {...field(`third_parties.${idx}.address`)} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Comuna</Label>
 <Input {...field(`third_parties.${idx}.commune`)} className="app-input" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Telefono</Label>
 <Input {...field(`third_parties.${idx}.phone`)} className="app-input" />
 </div>
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Email</Label>
 <Input {...field(`third_parties.${idx}.email`)} type="email" className="app-input" />
 </div>

 {/* Campos adicionales para RESPONSABLE/CULPABLE */}
 {String(watch(`third_parties.${idx}.party_type`)) === "responsable" && (
 <>
 <div className="modal-field">
 <Label className="app-field-label">Empresa (si aplica)</Label>
 <Input {...field(`third_parties.${idx}.company_name`)} className="app-input" placeholder="Nombre empresa" />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">¿Tiene seguro?</Label>
 <ToggleChip
 active={Boolean(watch(`third_parties.${idx}.has_insurance`))}
 onClick={(v) => set(`third_parties.${idx}.has_insurance`, v)}
 >
 {Boolean(watch(`third_parties.${idx}.has_insurance`)) ? "Sí" : "No"}
 </ToggleChip>
 </div>
 {Boolean(watch(`third_parties.${idx}.has_insurance`)) && (
 <>
 <div className="modal-field">
 <Label className="app-field-label">Compañía de Seguros</Label>
 <Input {...field(`third_parties.${idx}.insurance_company`)} className="app-input" placeholder="Ej: MetLife, BCI, etc." />
 </div>
 <div className="modal-field">
 <Label className="app-field-label">N° Siniestro (su compañía)</Label>
 <Input {...field(`third_parties.${idx}.claim_number`)} className="app-input" placeholder="N° de siniestro del tercero" />
 </div>
 </>
 )}
 {!Boolean(watch(`third_parties.${idx}.has_insurance`)) && (
 <div className="modal-field modal-field-full">
 <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-2 text-[11px] text-amber-900 dark:text-amber-100">
 Sin seguro — Se procederá con demanda particular contra el tercero responsable.
 </div>
 </div>
 )}
 </>
 )}

 {/* Notas para cualquier tipo */}
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">Notas</Label>
 <Input {...field(`third_parties.${idx}.notes`)} className="app-input" placeholder="Notas adicionales..." />
 </div>
 </div>
 </div>
 ))}
 {!readOnly && (
 <div className="flex justify-end">
 <button
 type="button"
 className="acta-save-btn"
 aria-label="Agregar tercero"
 onClick={() => {
 const current = (watch("third_parties") as Array<Record<string, unknown>>) || [];
 set("third_parties", [
 ...current,
 { party_type: "afectado", full_name: "", rut: "", address: "", commune: "", phone: "", email: "", company_name: "", has_insurance: false, insurance_company: "", claim_number: "", notes: "" },
 ]);
 }}
 >
 <Plus size={18} strokeWidth={2} />
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </fieldset>
 </form>
 );
}

// ─── Bloque de Validación Geográfica (Acta paso 1) ───────────────
function GeoValidationBlock({
 session,
 claim,
}: {
 session: SessionDetail;
 claim: {
 claim_address?: string | null;
 claim_latitude?: number | null;
 claim_longitude?: number | null;
 } | null | undefined;
}) {
 const geoStatus = session.geo_status || "pending";
 const geoLat = session.geo_latitude;
 const geoLng = session.geo_longitude;
 const geoDistance = session.geo_distance_meters;
 const claimLat = claim?.claim_latitude;
 const claimLng = claim?.claim_longitude;
 const claimAddress = claim?.claim_address;

 const statusConfig: Record<string, { icon: typeof MapPin; color: string; bg: string; label: string }> = {
 pending: { icon: MapPin, color: "text-muted-foreground", bg: "bg-muted/40", label: "Pendiente" },
 verified: { icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-500/10", label: "Ubicación Verificada" },
 out_of_range: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-500/10", label: "Fuera de rango" },
 failed: { icon: XCircle, color: "text-rose-600", bg: "bg-rose-500/10", label: "Fallida" },
 };

 const sc = statusConfig[geoStatus] || statusConfig.pending;
 const StatusIcon = sc.icon;

 return (
 <div className="space-y-3">
 {/* Estado de validación */}
 <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${sc.bg} ${sc.color}`}>
 <StatusIcon className="h-3 w-3" />
 {sc.label}
 </div>

 {/* Datos de la validación */}
 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 text-[11px]">
 <div>
 <span className="app-data-label">Dirección declarada</span>
 <p className="font-medium">{claimAddress || "—"}</p>
 </div>
 <div>
 <span className="app-data-label">Coords. siniestro</span>
 <p className="font-medium font-mono text-[11px]">
 {claimLat != null && claimLng != null
 ? `${claimLat.toFixed(6)}, ${claimLng.toFixed(6)}`
 : "—"}
 </p>
 </div>
 <div>
 <span className="app-data-label">Coords. capturadas</span>
 <p className="font-medium font-mono text-[11px]">
 {geoLat != null && geoLng != null
 ? `${geoLat.toFixed(6)}, ${geoLng.toFixed(6)}`
 : "—"}
 </p>
 </div>
 <div>
 <span className="app-data-label">Distancia</span>
 <p className="font-medium">
 {geoDistance != null ? `${geoDistance} m` : "—"}
 </p>
 </div>
 <div>
 <span className="app-data-label">Capturada en</span>
 <p className="font-medium">
 {session.geo_captured_at
 ? new Date(session.geo_captured_at).toLocaleString("es-CL", {
 timeZone: getUserTimeZone(),
 day: "2-digit",
 month: "2-digit",
 year: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 hour12: false,
 })
 : "—"}
 </p>
 </div>
 <div>
 <span className="app-data-label">Tipo inspección</span>
 <p className="font-medium">
 {session.inspection_type === "onsite" ? "Presencial" : "Remota"}
 </p>
 </div>
 </div>

 {/* Mensaje según estado */}
 {geoStatus === "verified" && (
 <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
 Ubicación verificada: a {geoDistance} m de la dirección declarada.
 </p>
 )}
 {geoStatus === "out_of_range" && (
 <p className="text-[11px] text-amber-600 dark:text-amber-400">
 La ubicación capturada está a {geoDistance} m de la dirección declarada.
 Se permite continuar pero queda registrado para auditoría.
 </p>
 )}
 {geoStatus === "pending" && (
 <p className="text-[11px] text-muted-foreground">
 La geolocalización aún no ha sido capturada.
 </p>
 )}
 {geoStatus === "failed" && (
 <p className="text-[11px] text-rose-600 dark:text-rose-400">
 No se pudo obtener la geolocalización del dispositivo.
 </p>
 )}
 </div>
 );
}
