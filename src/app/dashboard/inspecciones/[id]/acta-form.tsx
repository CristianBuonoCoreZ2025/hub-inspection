"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { actaSchema, type ActaInput } from "@/lib/validations";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateInspectionSession } from "@/services/inspections";
import { toast } from "sonner";
import {
  ChevronRight,
  ChevronLeft,
  Save,
  Shield,
  Building,
  Hammer,
  FileText,
  Users,
  ClipboardList,
  CheckCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { InspectionSession } from "@/types";

const steps = [
  { id: 1, label: "Datos Generales", icon: ClipboardList },
  { id: 2, label: "Riesgo Siniestrado", icon: Building },
  { id: 3, label: "Materialidad", icon: Hammer },
  { id: 4, label: "Seguridad", icon: Shield },
  { id: 5, label: "Declaracion", icon: FileText },
  { id: 6, label: "Terceros", icon: Users },
];

interface ActaFormProps {
  session: InspectionSession;
}

export default function ActaForm({ session }: ActaFormProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  const form = useForm<ActaInput>({
    resolver: standardSchemaResolver(actaSchema),
    defaultValues: {
      inspection_date: session.inspection_date || "",
      inspection_time: session.inspection_time || "",
      interviewed_name: session.interviewed_name || "",
      interviewed_email: session.interviewed_email || "",
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
        is_habitable: false, owner_name: "", branch_count: "",
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
      toast.success("Acta guardada");
      queryClient.invalidateQueries({ queryKey: ["inspection-session", session.id] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = form.handleSubmit((data) => saveMutation.mutate(data));

  const goNext = () => setStep((s) => Math.min(s + 1, steps.length));
  const goPrev = () => setStep((s) => Math.max(s - 1, 1));

  // Helpers sin tipado estricto para evitar conflictos con react-hook-form + paths anidados
  const field = (name: string) => form.register(name as never);
  const watch = (name: string) => form.watch(name as never);
  const set = (name: string, value: unknown) => form.setValue(name as never, value as never);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Stepper */}
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

      {/* Paso 1: Datos Generales */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Datos Generales de la Inspeccion
          </h3>
          <div className="modal-grid-3">
            <div className="modal-field">
              <Label className="app-field-label">Fecha Inspeccion</Label>
              <Input {...field("inspection_date")} type="date" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Hora Inspeccion</Label>
              <Input {...field("inspection_time")} type="time" className="app-input" />
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
              <Input {...field("interviewed_relationship")} placeholder="Arrendatario" className="app-input" />
            </div>
          </div>

          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground pt-2">
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
          </div>

          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground pt-2">
            Otros Seguros y Observaciones
          </h3>
          <div className="modal-grid">
            <div className="modal-field flex items-center gap-2 pt-4">
              <Checkbox
                checked={Boolean(watch("other_insurances"))}
                onChange={(e) => set("other_insurances", e.target.checked)}
              />
              <Label className="text-[13px] font-medium cursor-pointer">¿Presenta otros seguros?</Label>
            </div>
            {Boolean(watch("other_insurances")) && (
              <div className="modal-field">
                <Label className="app-field-label">Compañia</Label>
                <Input {...field("other_insurance_company")} className="app-input" />
              </div>
            )}
            <div className="modal-field modal-field-full">
              <Label className="app-field-label">Observaciones del Inspector</Label>
              <textarea
                {...field("inspector_observations")}
                rows={4}
                className="app-input resize-none"
                placeholder="Observaciones finales del inspector sobre la inspeccion..."
              />
            </div>
          </div>
        </div>
      )}

      {/* Paso 2: Descripcion del Riesgo */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Descripcion del Riesgo Siniestrado
          </h3>
          <div className="modal-grid-3">
            <div className="modal-field">
              <Label className="app-field-label">Tipo de Riesgo</Label>
              <Input {...field("property_risk.risk_type")} placeholder="Habitacional" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Clase de Riesgo</Label>
              <Input {...field("property_risk.risk_class")} className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Tipo de Inmueble</Label>
              <Input {...field("property_risk.property_type")} placeholder="Departamento" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">N° Dpto / Oficina</Label>
              <Input {...field("property_risk.apartment_number")} placeholder="606" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">N° Pisos</Label>
              <Input {...field("property_risk.floor_count")} placeholder="6" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Antiguedad (años)</Label>
              <Input {...field("property_risk.age_years")} placeholder="10" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Superficie Construida (m²)</Label>
              <Input {...field("property_risk.built_surface")} placeholder="0" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Cantidad Espacios</Label>
              <Input {...field("property_risk.room_count")} placeholder="Dormitorios, baños, oficinas..." className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Cantidad Baños</Label>
              <Input {...field("property_risk.bathroom_count")} className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Oficinas</Label>
              <Input {...field("property_risk.office_count")} className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Bodegas</Label>
              <Input {...field("property_risk.warehouse_count")} className="app-input" />
            </div>
            <div className="modal-field flex items-center gap-2 pt-4">
              <Checkbox
                checked={Boolean(watch("property_risk.is_habitable"))}
                onChange={(e) => set("property_risk.is_habitable", e.target.checked)}
              />
              <Label className="text-[13px] font-medium cursor-pointer">¿Se encuentra habitado?</Label>
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Nombre Propietario(s)</Label>
              <Input {...field("property_risk.owner_name")} placeholder="Pamela Becerra" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Sucursales</Label>
              <Input {...field("property_risk.branch_count")} className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Trabajadores / Habitantes</Label>
              <Input {...field("property_risk.worker_resident_count")} className="app-input" />
            </div>
            <div className="modal-field modal-field-full">
              <Label className="app-field-label">Rubro de la Empresa</Label>
              <Input {...field("property_risk.business_line")} className="app-input" />
            </div>
          </div>
        </div>
      )}

      {/* Paso 3: Materialidad */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Materialidad del Inmueble
          </h3>
          <div className="modal-grid-3">
            <div className="modal-field">
              <Label className="app-field-label">Muros</Label>
              <Input {...field("property_materiality.walls")} placeholder="Hormigon" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Cubierta / Techumbre</Label>
              <Input {...field("property_materiality.roof")} placeholder="Zinc" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Pavimentos Interiores</Label>
              <Input {...field("property_materiality.interior_flooring")} placeholder="Laminado flotante" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Cielos Interiores</Label>
              <Input {...field("property_materiality.interior_ceilings")} placeholder="Losa concreto" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Terminaciones Interiores</Label>
              <Input {...field("property_materiality.interior_finishes")} placeholder="Pintura" className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Terminaciones Exteriores</Label>
              <Input {...field("property_materiality.exterior_finishes")} className="app-input" />
            </div>
            <div className="modal-field">
              <Label className="app-field-label">Cierre Perimetral</Label>
              <Input {...field("property_materiality.perimeter_closure")} className="app-input" />
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
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Medidas de Asegurabilidad
          </h3>
          <div className="space-y-3">
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
              <div key={item.key} className="flex items-start gap-4 rounded-lg border border-border p-3">
                <div className="flex items-center gap-2 pt-1 shrink-0">
                  <Checkbox
                    checked={Boolean(watch(`security_measures.${item.key}.has_it`))}
                    onChange={(e) =>
                      set(`security_measures.${item.key}.has_it`, e.target.checked)
                    }
                  />
                  <Label className="text-[13px] font-medium cursor-pointer whitespace-nowrap">{item.label}</Label>
                </div>
                <div className="flex-1 min-w-0">
                  <Input
                    {...field(`security_measures.${item.key}.detail`)}
                    placeholder="Detalle..."
                    className="app-input h-8 text-[13px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Paso 5: Declaracion del Asegurado */}
      {step === 5 && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Declaracion del Asegurado
          </h3>
          <div className="modal-grid">
            <div className="modal-field modal-field-full">
              <Label className="app-field-label">Relato de los Hechos</Label>
              <textarea
                {...field("insured_statement.statement")}
                rows={5}
                className="app-input resize-none"
                placeholder="De acuerdo a lo relatado por el Sr..."
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
        <div className="space-y-4">
          <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
            Datos de Terceros
          </h3>
          <div className="space-y-3">
            {((watch("third_parties") as Array<Record<string, unknown>>) || []).map((_, idx) => (
              <div key={idx} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium">Tercero {idx + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs btn-danger"
                    onClick={() => {
                      const current = (watch("third_parties") as Array<Record<string, unknown>>) || [];
                      set("third_parties", current.filter((_, i) => i !== idx));
                    }}
                  >
                    Eliminar
                  </Button>
                </div>
                <div className="modal-grid-3">
                  <div className="modal-field">
                    <Label className="app-field-label">Tipo</Label>
                    <select
                      {...field(`third_parties.${idx}.party_type`)}
                      className="app-input h-10"
                    >
                      <option value="afectado">Afectado</option>
                      <option value="responsable">Responsable</option>
                    </select>
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
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="btn-create btn-sm"
              onClick={() => {
                const current = (watch("third_parties") as Array<Record<string, unknown>>) || [];
                set("third_parties", [
                  ...current,
                  { party_type: "afectado", full_name: "", rut: "", address: "", commune: "", phone: "", email: "" },
                ]);
              }}
            >
              <Users className="mr-2 h-3.5 w-3.5" />
              Agregar Tercero
            </Button>
          </div>
        </div>
      )}

      {/* Navegacion y Guardar */}
      <div className="flex items-center justify-between border-t border-border pt-4">
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button type="button" variant="outline" size="sm" onClick={goPrev} className="btn-cancel btn-sm">
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />
              Anterior
            </Button>
          )}
          {step < steps.length && (
            <Button type="button" size="sm" onClick={goNext} className="btn-create btn-sm">
              Siguiente
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={saveMutation.isPending}
          className="btn-save btn-sm"
        >
          {saveMutation.isPending ? (
            "Guardando..."
          ) : (
            <>
              <Save className="mr-2 h-3.5 w-3.5" />
              Guardar
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
