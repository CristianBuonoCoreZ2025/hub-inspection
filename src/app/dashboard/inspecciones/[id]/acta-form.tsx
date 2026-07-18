"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { actaSchema, type ActaInput } from "@/lib/validations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateInspectionSession, type SessionDetail } from "@/services/inspections";
import { toast } from "sonner";
import {
 Shield,
 Building,
 Hammer,
 FileText,
 Users,
 ClipboardList,
 CheckCircle,
 Lock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDatePicker } from "@/components/ui/form-date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { useLookupCatalogs } from "@/hooks/use-lookup-catalog";
import { getPropertyClassifications, getHousingDestinations, getBuildingAges } from "@/services/catalogs";
import { useQuery } from "@tanstack/react-query";
import type { InspectionSession } from "@/types";

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
}

export default function ActaForm({ session, readOnly = false }: ActaFormProps) {
 const queryClient = useQueryClient();
 const [step, setStep] = useState(1);

 const { catalogs } = useLookupCatalogs([
 "interviewed_relationship",
 "materiality_walls",
 "materiality_roof",
 "materiality_flooring",
 "materiality_ceiling",
 "materiality_interior_finish",
 "materiality_exterior_finish",
 "materiality_closure",
 ]);

 // Catálogos desde tablas separadas
 const { data: propertyClassifications = [] } = useQuery({
 queryKey: ["property-classifications"],
 queryFn: getPropertyClassifications,
 staleTime: 1000 * 60 * 30,
 });
 const { data: housingDestinations = [] } = useQuery({
 queryKey: ["housing-destinations"],
 queryFn: getHousingDestinations,
 staleTime: 1000 * 60 * 30,
 });
 const { data: buildingAges = [] } = useQuery({
 queryKey: ["building-ages"],
 queryFn: getBuildingAges,
 staleTime: 1000 * 60 * 30,
 });

 // Pre-llenar desde el siniestro: si el acta no tiene datos del entrevistado,
 // usar los del asegurado desde claims_participants
 const claim = session.claim as Record<string, unknown> | null | undefined;
 const participants = (claim?.claims_participants as Array<{ type: string; full_name: string | null; email: string | null }>) || [];
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
 is_habitable: false, owner_name: preInsuredName, branch_count: "",
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

 const saveMutation = useMutation({
 mutationFn: (data: ActaInput) =>
 updateInspectionSession(session.id, {
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
 } as Partial<InspectionSession>),
 onSuccess: () => {
 queryClient.invalidateQueries({ queryKey: ["inspection-session", session.id] });
 },
 onError: (err: Error) => toast.error(err.message),
 });

 const onSubmit = form.handleSubmit((data) => {
 saveMutation.mutate(data);
 toast.success("Acta guardada");
 });

 // ── Auto-guardado debounced (screen sharing) ──
 // Cuando el inspector escribe, guarda silenciosamente después de 1.5s
 // para que el cliente vea los cambios en tiempo real vía polling.
 const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
 const lastSavedDataRef = useRef<string>("");

 useEffect(() => {
 // eslint-disable-next-line react-hooks/incompatible-library
 const subscription = form.watch((formData) => {
 // Solo guardar si hay cambios reales
 const dataStr = JSON.stringify(formData);
 if (dataStr === lastSavedDataRef.current) return;

 if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
 autoSaveTimerRef.current = setTimeout(() => {
 lastSavedDataRef.current = dataStr;
 const validData = form.getValues();
 updateInspectionSession(session.id, {
 inspection_date: validData.inspection_date || null,
 inspection_time: validData.inspection_time || null,
 interviewed_name: validData.interviewed_name || null,
 interviewed_email: validData.interviewed_email || null,
 interviewed_relationship: validData.interviewed_relationship || null,
 police_report_number: validData.police_report_number || null,
 police_report_name: validData.police_report_name || null,
 police_report_rut: validData.police_report_rut || null,
 firefighters_company: validData.firefighters_company || null,
 other_insurances: validData.other_insurances,
 other_insurance_company: validData.other_insurance_company || null,
 inspector_observations: validData.inspector_observations || null,
 property_risk: validData.property_risk,
 property_materiality: validData.property_materiality,
 security_measures: validData.security_measures,
 insured_statement: validData.insured_statement,
 third_parties: validData.third_parties,
 } as Partial<InspectionSession>).catch(() => {});
 }, 1500);
 });
 return () => subscription.unsubscribe();
 }, [form, session.id]);

 // Sincronizar el step del acta con el cliente (piloto automático)
 const currentStepKey = steps.find((s) => s.id === step)?.key || "datos";
 useEffect(() => {
 updateInspectionSession(session.id, { acta_step: currentStepKey }).catch(() => {});
 }, [currentStepKey, session.id]);

 // Helpers sin tipado estricto para evitar conflictos con react-hook-form + paths anidados
 const field = (name: string) => form.register(name as never);
 const watch = (name: string) => form.watch(name as never);
 const set = (name: string, value: unknown) => form.setValue(name as never, value as never);

 const catalogSelect = (name: string, category: string, placeholder = "Seleccionar...") => {
 const items = catalogs[category] || [];
 const raw = watch(name);
 const current = raw ? String(raw) : null;
 return (
 <Select
 value={current}
 onValueChange={(v) => set(name, v ?? "")}
 >
 <SelectTrigger className="app-input h-8 w-full">
 <SelectValue placeholder={placeholder} />
 </SelectTrigger>
 <SelectContent>
 {items.length === 0 ? (
 <div className="px-2 py-1.5 text-[12px] text-muted-foreground">Sin opciones</div>
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
 <SelectTrigger className="app-input h-8 w-full">
 <SelectValue placeholder={placeholder} />
 </SelectTrigger>
 <SelectContent>
 {items.length === 0 ? (
 <div className="px-2 py-1.5 text-[12px] text-muted-foreground">Sin opciones</div>
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
 <SelectTrigger className="app-input h-8 w-full">
 <SelectValue placeholder={placeholder} />
 </SelectTrigger>
 <SelectContent>
 {Array.from({ length: max }, (_, i) => String(i + 1)).map((n) => (
 <SelectItem key={n} value={n}>{n}</SelectItem>
 ))}
 <SelectItem value="10+">10+</SelectItem>
 </SelectContent>
 </Select>
 );
 };

 return (
 <form onSubmit={onSubmit} className="app-stack">
 {/* Banner de solo lectura */}
 {readOnly && (
 <div className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
 <Lock className="h-3.5 w-3.5 shrink-0" />
 Inspección finalizada — el acta es de solo lectura
 </div>
 )}
 {/* Stepper (siempre navegable, incluso en readOnly) */}
 <div className="flex items-center gap-1 overflow-x-auto pb-2">
 {steps.map((s) => {
 const Icon = s.icon;
 const active = s.id === step;
 const completed = s.id < step;
 return (
 <button
 key={s.id}
 type="button"
 onClick={() => setStep(s.id)}
 className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium transition-colors ${
 active
 ? "bg-primary text-primary-foreground"
 : completed
 ? "bg-primary/10 text-primary"
 : "bg-muted text-muted-foreground hover:bg-muted/80"
 }`}
 >
 {completed ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
 <span className="hidden sm:inline">{s.label}</span>
 </button>
 );
 })}
 </div>

 <fieldset disabled={readOnly} className="contents">

 {/* Paso 1: Datos Generales */}
 {step === 1 && (
 <div className="space-y-3">
 <div className="app-panel">
 <h3 className="app-section-title">
 Datos Generales de la Inspeccion
 </h3>
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">Fecha Inspeccion</Label>
 <FormDatePicker control={form.control} name="inspection_date" className="w-[130px]" disabled={readOnly} />
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
 <h3 className="app-section-title">
 Descripcion del Riesgo Siniestrado
 </h3>
 {(() => {
 const riskClass = String(watch("property_risk.risk_class") ?? "");
 const propertyType = String(watch("property_risk.property_type") ?? "");

 // ── Config dinámica desde la BD (field_config) ──
 const classConfig = propertyClassifications.find((c) => c.name === riskClass)?.field_config as {
 show?: string[]; hide?: string[]; labels?: Record<string, string>;
 } | undefined;
 const destConfig = housingDestinations.find((d) => d.name === propertyType)?.field_config as {
 show?: string[]; hide?: string[]; labels?: Record<string, string>;
 } | undefined;

 // Merge: base siempre visibles + classification.show + destination.show
 const ALWAYS_VISIBLE = ["age_years", "owner_name", "worker_resident_count"];
 const visible = new Set<string>(ALWAYS_VISIBLE);
 classConfig?.show?.forEach((f) => visible.add(f));
 destConfig?.show?.forEach((f) => visible.add(f));
 // Quitar hides
 classConfig?.hide?.forEach((f) => visible.delete(f));
 destConfig?.hide?.forEach((f) => visible.delete(f));

 // Labels: classification > destination > default
 const defaultLabels: Record<string, string> = {
 age_years: "Antigüedad del Inmueble",
 owner_name: "Nombre Propietario(s)",
 worker_resident_count: "N° Habitantes",
 apartment_number: "N° Dpto / Oficina",
 floor_count: "N° Pisos",
 built_surface: "Superficie Construida (m²)",
 room_count: "Cantidad Espacios",
 bathroom_count: "Cantidad Baños",
 is_habitable: "¿Se encuentra habitable?",
 office_count: "N° Oficinas",
 warehouse_count: "N° Bodegas",
 branch_count: "Sucursales",
 business_line: "Rubro de la Empresa",
 };
 const labelFor = (key: string) =>
 classConfig?.labels?.[key] || destConfig?.labels?.[key] || defaultLabels[key] || key;

 const isFieldVisible = (key: string) => visible.has(key);

 return (
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">Clasificacion del Bien</Label>
 {tableSelect("property_risk.risk_class", propertyClassifications)}
 </div>
 <div className="modal-field">
 <Label className="app-field-label">Destino del Bien</Label>
 {tableSelect("property_risk.property_type", housingDestinations)}
 </div>
 {isFieldVisible("apartment_number") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("apartment_number")}</Label>
 <Input {...field("property_risk.apartment_number")} placeholder="606" className="app-input" />
 </div>
 )}
 {isFieldVisible("floor_count") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("floor_count")}</Label>
 <Input {...field("property_risk.floor_count")} type="number" placeholder="6" className="app-input" />
 </div>
 )}
 {isFieldVisible("age_years") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("age_years")}</Label>
 {tableSelect("property_risk.age_years", buildingAges)}
 </div>
 )}
 {isFieldVisible("built_surface") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("built_surface")}</Label>
 <Input {...field("property_risk.built_surface")} type="number" placeholder="0" className="app-input" />
 </div>
 )}
 {isFieldVisible("room_count") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("room_count")}</Label>
 {numberSelect("property_risk.room_count", 10)}
 </div>
 )}
 {isFieldVisible("bathroom_count") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("bathroom_count")}</Label>
 {numberSelect("property_risk.bathroom_count", 10)}
 </div>
 )}
 {isFieldVisible("office_count") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("office_count")}</Label>
 {numberSelect("property_risk.office_count", 10)}
 </div>
 )}
 {isFieldVisible("warehouse_count") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("warehouse_count")}</Label>
 {numberSelect("property_risk.warehouse_count", 10)}
 </div>
 )}
 {isFieldVisible("is_habitable") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("is_habitable")}</Label>
 <ToggleChip
 active={Boolean(watch("property_risk.is_habitable"))}
 onClick={(v) => set("property_risk.is_habitable", v)}
 >
 {watch("property_risk.is_habitable") ? "Sí" : "No"}
 </ToggleChip>
 </div>
 )}
 {isFieldVisible("owner_name") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("owner_name")}</Label>
 <Input {...field("property_risk.owner_name")} placeholder="Pamela Becerra" className="app-input" />
 </div>
 )}
 {isFieldVisible("branch_count") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("branch_count")}</Label>
 <Input {...field("property_risk.branch_count")} type="number" className="app-input" />
 </div>
 )}
 {isFieldVisible("worker_resident_count") && (
 <div className="modal-field">
 <Label className="app-field-label">{labelFor("worker_resident_count")}</Label>
 <Input {...field("property_risk.worker_resident_count")} type="number" className="app-input" />
 </div>
 )}
 {isFieldVisible("business_line") && (
 <div className="modal-field modal-field-full">
 <Label className="app-field-label">{labelFor("business_line")}</Label>
 <Input {...field("property_risk.business_line")} className="app-input" />
 </div>
 )}
 </div>
 );
 })()}
 </div>
 )}

 {/* Paso 3: Materialidad */}
 {step === 3 && (
 <div className="app-panel">
 <h3 className="app-section-title">
 Materialidad del Inmueble
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
 <h3 className="app-section-title">
 Medidas de Asegurabilidad
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
 {...field(`security_measures.${item.key}.detail`)}
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
 <h3 className="app-section-title">
 Declaracion del Asegurado
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
 <h3 className="app-section-title">
 Datos de Terceros
 </h3>
 <div className="space-y-3">
 {((watch("third_parties") as Array<Record<string, unknown>>) || []).map((_, idx) => (
 <div key={idx} className="rounded-lg border border-border p-3 space-y-3">
 <div className="flex items-center justify-between">
 <span className="text-[12px] font-medium">Tercero {idx + 1}</span>
 {!readOnly && (
 <Button
 type="button"
 variant="ghost"
 size="sm"
 className="h-7 text-xs pg-btn-platinum"
 onClick={() => {
 const current = (watch("third_parties") as Array<Record<string, unknown>>) || [];
 set("third_parties", current.filter((_, i) => i !== idx));
 }}
 >
 Eliminar
 </Button>
 )}
 </div>
 <div className="modal-grid-3">
 <div className="modal-field">
 <Label className="app-field-label">Tipo</Label>
 <Select
 value={String(watch(`third_parties.${idx}.party_type`) ?? "") || null}
 onValueChange={(v) => set(`third_parties.${idx}.party_type`, v)}
 >
 <SelectTrigger className="app-input h-7">
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
 <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 p-2 text-[12px] text-amber-900 dark:text-amber-100">
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
 <Button
 type="button"
 variant="outline"
 size="sm"
 className="pg-btn-platinum"
 onClick={() => {
 const current = (watch("third_parties") as Array<Record<string, unknown>>) || [];
 set("third_parties", [
 ...current,
 { party_type: "afectado", full_name: "", rut: "", address: "", commune: "", phone: "", email: "", company_name: "", has_insurance: false, insurance_company: "", claim_number: "", notes: "" },
 ]);
 }}
 >
 Agregar
 </Button>
 )}
 </div>
 </div>
 )}

 {/* Guardar (oculto en readOnly) */}
 {!readOnly && (
 <div className="flex items-center justify-end border-t border-border pt-4">
 <Button
 type="submit"
 size="sm"
 disabled={saveMutation.isPending}
 className="pg-btn-platinum"
 >
 {saveMutation.isPending ? "Guardando..." : "Guardar"}
 </Button>
 </div>
 )}
 </fieldset>
 </form>
 );
}
