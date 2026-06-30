"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  User,
  Users,
  MapPin,
  Briefcase,
  Save,
  X,
  Shield,
  Building,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { SelectItem } from "@/components/ui/select";
import { updateClaimFields, updateClaimParticipant, createClaimParticipant } from "@/services/claims";
import type { Claim, ClaimsParticipant } from "@/types";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Catalog {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface EditClaimFormProps {
  claim: Claim;
  participants: ClaimsParticipant[];
  catalogs: {
    claimTypes: Catalog[];
    claimCauses: Catalog[];
    insuranceCompanies: Catalog[];
    businessLines: Catalog[];
    insuranceProducts: Catalog[];
    brokers: Catalog[];
    advisors: Catalog[];
    housingDestinations: Catalog[];
    propertyClassifications: Catalog[];
    damageClassifications: Catalog[];
    constructionTypes: Catalog[];
    habitability: Catalog[];
    events: Catalog[];
    currencies: Catalog[];
    users: UserOption[];
  };
  onCancel: () => void;
  onSaved: () => void;
}

interface FormValues {
  // Tab Siniestro
  claimNumber: string;
  policyNumber: string;
  policyItem: string;
  clientReference: string;
  claimDate: string;
  reportDate: string;
  assignmentDate: string;
  claimTypeId: string;
  claimCauseId: string;
  eventId: string;
  summary: string;
  // Póliza
  currencyId: string;
  policyAmount: string;
  policyPremium: string;
  policyStartDate: string;
  policyEndDate: string;
  // Recovery
  recoveryTypeLegal: boolean;
  recoveryTypeMaterial: boolean;
  recoveryComments: string;

  // Tab Asegurado
  insuredFirstName: string;
  insuredLastName: string;
  insuredRut: string;
  insuredEmail: string;
  insuredPhone: string;
  insuredCellPhone: string;
  insuredAddress: string;
  insuredCountry: string;
  insuredRegion: string;
  insuredCity: string;
  insuredCommune: string;

  // Tab Participantes — Contractor
  contractorFullName: string;
  contractorRut: string;
  contractorEmail: string;
  contractorCellPhone: string;
  contractorPhone: string;
  contractorAddress: string;
  contractorCountry: string;
  contractorRegion: string;
  contractorCity: string;
  contractorCommune: string;

  // Tab Participantes — Beneficiary
  beneficiaryFullName: string;
  beneficiaryRut: string;
  beneficiaryEmail: string;
  beneficiaryCellPhone: string;
  beneficiaryPhone: string;
  beneficiaryAddress: string;
  beneficiaryCountry: string;
  beneficiaryRegion: string;
  beneficiaryCity: string;
  beneficiaryCommune: string;

  // Tab Incidente
  claimAddress: string;
  claimCountry: string;
  claimRegion: string;
  claimCity: string;
  claimCommune: string;
  constructionTypeId: string;
  destinationHousingId: string;
  damageClassificationId: string;
  habitabilityId: string;
  ownerSameAsInsured: boolean;

  // Tab Asignaciones
  insuranceCompanyId: string;
  businessLineId: string;
  insuranceProductId: string;
  brokerId: string;
  advisorId: string;
  inspectorId: string;
  adjusterId: string;
  auditorId: string;
  dispatcherId: string;
  assistantId: string;
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function toDateInput(date: string | null | undefined): string {
  if (!date) return "";
  return date.substring(0, 10);
}

function getParticipant(participants: ClaimsParticipant[], type: string): ClaimsParticipant | undefined {
  return participants.find((p) => p.type === type);
}

// ──────────────────────────────────────────────────────────────
// Reusable field components
// ──────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="text-muted-foreground text-[11px] uppercase tracking-wide">
      {label}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </span>
  );
}

function EditInput({
  label,
  required,
  ...props
}: { label: string; required?: boolean } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1">
      <FieldLabel label={label} required={required} />
      <Input className="app-input h-7 text-[13px]" {...props} />
    </div>
  );
}

function EditTextarea({
  label,
  required,
  ...props
}: { label: string; required?: boolean } & React.ComponentProps<"textarea">) {
  return (
    <div className="space-y-1">
      <FieldLabel label={label} required={required} />
      <Textarea className="app-input min-h-[70px] text-[13px]" {...props} />
    </div>
  );
}

function EditSelect({
  label,
  required,
  control,
  name,
  placeholder,
  clearable,
  items,
}: {
  label: string;
  required?: boolean;
  control: any;
  name: string;
  placeholder: string;
  clearable?: boolean;
  items: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <FieldLabel label={label} required={required} />
      <FormSelect
        control={control}
        name={name}
        placeholder={placeholder}
        clearable={clearable}
        className="app-input h-7 text-[13px]"
        items={items}
      >
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </FormSelect>
    </div>
  );
}

function EditCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-[13px]">
      <Checkbox checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

// ──────────────────────────────────────────────────────────────
// Tab definitions
// ──────────────────────────────────────────────────────────────

const tabs = [
  { id: "siniestro", label: "Siniestro", icon: FileText },
  { id: "asegurado", label: "Asegurado", icon: User },
  { id: "participantes", label: "Participantes", icon: Users },
  { id: "incidente", label: "Incidente", icon: MapPin },
  { id: "asignaciones", label: "Asignaciones", icon: Briefcase },
];

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export default function EditClaimForm({ claim, participants, catalogs, onCancel, onSaved }: EditClaimFormProps) {
  const [activeTab, setActiveTab] = useState("siniestro");
  const queryClient = useQueryClient();

  const insured = getParticipant(participants, "insured");
  const contractor = getParticipant(participants, "contractor");
  const beneficiary = getParticipant(participants, "beneficiary");
  const contact = getParticipant(participants, "contact");

  const form = useForm<FormValues>({
    defaultValues: {
      // Siniestro
      claimNumber: claim.claim_number || "",
      policyNumber: claim.policy_number || "",
      policyItem: claim.policy_item || "",
      clientReference: claim.client_reference || "",
      claimDate: toDateInput(claim.claim_date),
      reportDate: toDateInput(claim.report_date),
      assignmentDate: toDateInput(claim.assignment_date),
      claimTypeId: claim.claim_type_id || "",
      claimCauseId: claim.claim_cause_id || "",
      eventId: claim.event_id || "",
      summary: claim.summary || "",
      // Póliza
      currencyId: claim.currency_id || "",
      policyAmount: claim.policy_amount?.toString() || "",
      policyPremium: claim.policy_premium?.toString() || "",
      policyStartDate: toDateInput(claim.policy_start_date),
      policyEndDate: toDateInput(claim.policy_end_date),
      // Recovery
      recoveryTypeLegal: claim.recovery_type_legal ?? false,
      recoveryTypeMaterial: claim.recovery_type_material ?? false,
      recoveryComments: claim.recovery_comments || "",

      // Asegurado
      insuredFirstName: insured?.first_name || insured?.full_name || "",
      insuredLastName: insured?.last_name || "",
      insuredRut: insured?.rut || "",
      insuredEmail: insured?.email || "",
      insuredPhone: insured?.phone || "",
      insuredCellPhone: insured?.cell_phone || "",
      insuredAddress: insured?.address || "",
      insuredCountry: insured?.country || "",
      insuredRegion: insured?.region || "",
      insuredCity: insured?.city || "",
      insuredCommune: insured?.commune || "",

      // Contractor
      contractorFullName: contractor?.full_name || "",
      contractorRut: contractor?.rut || "",
      contractorEmail: contractor?.email || "",
      contractorCellPhone: contractor?.cell_phone || "",
      contractorPhone: contractor?.phone || "",
      contractorAddress: contractor?.address || "",
      contractorCountry: contractor?.country || "",
      contractorRegion: contractor?.region || "",
      contractorCity: contractor?.city || "",
      contractorCommune: contractor?.commune || "",

      // Beneficiary
      beneficiaryFullName: beneficiary?.full_name || "",
      beneficiaryRut: beneficiary?.rut || "",
      beneficiaryEmail: beneficiary?.email || "",
      beneficiaryCellPhone: beneficiary?.cell_phone || "",
      beneficiaryPhone: beneficiary?.phone || "",
      beneficiaryAddress: beneficiary?.address || "",
      beneficiaryCountry: beneficiary?.country || "",
      beneficiaryRegion: beneficiary?.region || "",
      beneficiaryCity: beneficiary?.city || "",
      beneficiaryCommune: beneficiary?.commune || "",

      // Incidente
      claimAddress: claim.claim_address || "",
      claimCountry: claim.claim_country || "",
      claimRegion: claim.claim_region || "",
      claimCity: claim.claim_city || "",
      claimCommune: claim.claim_commune || "",
      constructionTypeId: claim.construction_type_id || "",
      destinationHousingId: claim.destination_housing_id || "",
      damageClassificationId: claim.damage_classification_id || "",
      habitabilityId: claim.habitability_id || "",
      ownerSameAsInsured: claim.owner_same_as_insured ?? false,

      // Asignaciones
      insuranceCompanyId: claim.insurance_company_id || "",
      businessLineId: claim.business_line_id || "",
      insuranceProductId: claim.insurance_product_id || "",
      brokerId: claim.broker_id || "",
      advisorId: claim.advisor_id || "",
      inspectorId: claim.inspector_id || "",
      adjusterId: claim.adjuster_id || "",
      auditorId: claim.auditor_id || "",
      dispatcherId: claim.dispatcher_id || "",
      assistantId: claim.assistant_id || "",
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // 1. Actualizar campos del claim
      const claimSet: Record<string, unknown> = {
        claim_number: values.claimNumber,
        policy_number: values.policyNumber,
        policy_item: values.policyItem || null,
        client_reference: values.clientReference || null,
        claim_date: values.claimDate,
        report_date: values.reportDate || null,
        assignment_date: values.assignmentDate || null,
        claim_type_id: values.claimTypeId || null,
        claim_cause_id: values.claimCauseId || null,
        event_id: values.eventId || null,
        summary: values.summary || null,
        currency_id: values.currencyId || null,
        policy_amount: values.policyAmount ? parseFloat(values.policyAmount) : null,
        policy_premium: values.policyPremium ? parseFloat(values.policyPremium) : null,
        policy_start_date: values.policyStartDate || null,
        policy_end_date: values.policyEndDate || null,
        recovery_type_legal: values.recoveryTypeLegal,
        recovery_type_material: values.recoveryTypeMaterial,
        recovery_comments: values.recoveryComments || null,
        claim_address: values.claimAddress || null,
        claim_country: values.claimCountry || null,
        claim_region: values.claimRegion || null,
        claim_city: values.claimCity || null,
        claim_commune: values.claimCommune || null,
        construction_type_id: values.constructionTypeId || null,
        destination_housing_id: values.destinationHousingId || null,
        damage_classification_id: values.damageClassificationId || null,
        habitability_id: values.habitabilityId || null,
        owner_same_as_insured: values.ownerSameAsInsured,
        insurance_company_id: values.insuranceCompanyId || null,
        business_line_id: values.businessLineId || null,
        insurance_product_id: values.insuranceProductId || null,
        broker_id: values.brokerId || null,
        advisor_id: values.advisorId || null,
        inspector_id: values.inspectorId || null,
        adjuster_id: values.adjusterId || null,
        auditor_id: values.auditorId || null,
        dispatcher_id: values.dispatcherId || null,
        assistant_id: values.assistantId || null,
      };

      await updateClaimFields(claim.id, claimSet);

      // 2. Actualizar/crear participante insured
      const insuredData = {
        full_name: `${values.insuredFirstName} ${values.insuredLastName}`.trim(),
        first_name: values.insuredFirstName,
        last_name: values.insuredLastName || null,
        rut: values.insuredRut || null,
        email: values.insuredEmail || null,
        phone: values.insuredPhone || null,
        cell_phone: values.insuredCellPhone || null,
        address: values.insuredAddress || null,
        country: values.insuredCountry || null,
        region: values.insuredRegion || null,
        city: values.insuredCity || null,
        commune: values.insuredCommune || null,
      };
      if (insured) {
        await updateClaimParticipant(insured.id, insuredData);
      } else if (values.insuredFirstName) {
        await createClaimParticipant({ claim_id: claim.id, type: "insured", ...insuredData });
      }

      // 3. Actualizar/crear contractor
      const contractorData = {
        full_name: values.contractorFullName,
        rut: values.contractorRut || null,
        email: values.contractorEmail || null,
        phone: values.contractorPhone || null,
        cell_phone: values.contractorCellPhone || null,
        address: values.contractorAddress || null,
        country: values.contractorCountry || null,
        region: values.contractorRegion || null,
        city: values.contractorCity || null,
        commune: values.contractorCommune || null,
      };
      if (contractor) {
        if (values.contractorFullName) {
          await updateClaimParticipant(contractor.id, contractorData);
        }
      } else if (values.contractorFullName) {
        await createClaimParticipant({ claim_id: claim.id, type: "contractor", ...contractorData });
      }

      // 4. Actualizar/crear beneficiary
      const beneficiaryData = {
        full_name: values.beneficiaryFullName,
        rut: values.beneficiaryRut || null,
        email: values.beneficiaryEmail || null,
        phone: values.beneficiaryPhone || null,
        cell_phone: values.beneficiaryCellPhone || null,
        address: values.beneficiaryAddress || null,
        country: values.beneficiaryCountry || null,
        region: values.beneficiaryRegion || null,
        city: values.beneficiaryCity || null,
        commune: values.beneficiaryCommune || null,
      };
      if (beneficiary) {
        if (values.beneficiaryFullName) {
          await updateClaimParticipant(beneficiary.id, beneficiaryData);
        }
      } else if (values.beneficiaryFullName) {
        await createClaimParticipant({ claim_id: claim.id, type: "beneficiary", ...beneficiaryData });
      }
    },
    onSuccess: () => {
      toast.success("Siniestro actualizado");
      queryClient.invalidateQueries({ queryKey: ["claim", claim.id] });
      queryClient.invalidateQueries({ queryKey: ["claim-participants", claim.id] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      onSaved();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { control, register, handleSubmit, watch } = form;

  // Catálogos para selects
  const claimTypeItems = catalogs.claimTypes.map((c) => ({ value: c.id, label: c.name }));
  const claimCauseItems = catalogs.claimCauses.map((c) => ({ value: c.id, label: c.name }));
  const eventItems = catalogs.events.map((c) => ({ value: c.id, label: c.name }));
  const currencyItems = catalogs.currencies.map((c) => ({ value: c.id, label: c.name }));
  const insuranceCompanyItems = catalogs.insuranceCompanies.map((c) => ({ value: c.id, label: c.name }));
  const businessLineItems = catalogs.businessLines.map((c) => ({ value: c.id, label: c.name }));
  const insuranceProductItems = catalogs.insuranceProducts.map((c) => ({ value: c.id, label: c.name }));
  const brokerItems = catalogs.brokers.map((c) => ({ value: c.id, label: c.name }));
  const advisorItems = catalogs.advisors.map((c) => ({ value: c.id, label: c.name }));
  const housingDestItems = catalogs.housingDestinations.map((c) => ({ value: c.id, label: c.name }));
  const damageClassItems = catalogs.damageClassifications.map((c) => ({ value: c.id, label: c.name }));
  const constructionTypeItems = catalogs.constructionTypes.map((c) => ({ value: c.id, label: c.name }));
  const habitabilityItems = catalogs.habitability.map((c) => ({ value: c.id, label: c.name }));
  const userItems = catalogs.users.map((u) => ({ value: u.id, label: u.full_name || u.email || "—" }));

  const watchedOwnerSame = watch("ownerSameAsInsured");
  const watchedRecoveryLegal = watch("recoveryTypeLegal");
  const watchedRecoveryMaterial = watch("recoveryTypeMaterial");

  return (
    <div className="flex flex-col gap-6">
      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-6">
        {/* Tab content */}
        <div className="min-h-[300px]">
          {/* ═══ TAB: SINIESTRO ═══ */}
          {activeTab === "siniestro" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="app-panel">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Datos del Siniestro
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                    <EditInput label="N° Siniestro" required {...register("claimNumber")} />
                    <EditInput label="N° Póliza" required {...register("policyNumber")} />
                    <EditInput label="Item Póliza" {...register("policyItem")} />
                    <EditInput label="N° Ref. Cliente" {...register("clientReference")} />
                    <EditInput label="Fecha Siniestro" required type="date" {...register("claimDate")} />
                    <EditInput label="Fecha Denuncio" type="date" {...register("reportDate")} />
                    <EditInput label="Fecha Asignación" type="date" {...register("assignmentDate")} />
                    <EditSelect label="Tipo" required control={control} name="claimTypeId" placeholder="Seleccionar..." items={claimTypeItems} />
                    <EditSelect label="Causal" control={control} name="claimCauseId" placeholder="Seleccionar..." clearable items={claimCauseItems} />
                    <EditSelect label="Evento" control={control} name="eventId" placeholder="Seleccionar..." clearable items={eventItems} />
                  </div>
                </div>

                <div className="app-panel">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Datos de la Póliza
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-3">
                    <EditSelect label="Moneda" control={control} name="currencyId" placeholder="Seleccionar..." clearable items={currencyItems} />
                    <EditInput label="Monto Asegurado" type="number" step="0.01" {...register("policyAmount")} />
                    <EditInput label="Prima" type="number" step="0.01" {...register("policyPremium")} />
                    <EditInput label="Inicio Vigencia" type="date" {...register("policyStartDate")} />
                    <EditInput label="Término Vigencia" type="date" {...register("policyEndDate")} />
                  </div>
                </div>

                <div className="app-panel">
                  <EditTextarea label="Resumen" {...register("summary")} />
                </div>
              </div>

              <div className="space-y-6">
                <div className="app-panel">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Información de Recovery
                  </h3>
                  <div className="space-y-3">
                    <EditCheckbox
                      label="Recupero Legal"
                      checked={watchedRecoveryLegal}
                      onChange={(v) => form.setValue("recoveryTypeLegal", v)}
                    />
                    <EditCheckbox
                      label="Recupero Material"
                      checked={watchedRecoveryMaterial}
                      onChange={(v) => form.setValue("recoveryTypeMaterial", v)}
                    />
                    <EditTextarea label="Comentarios" {...register("recoveryComments")} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: ASEGURADO ═══ */}
          {activeTab === "asegurado" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Asegurado
                </h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <EditInput label="Nombre" required {...register("insuredFirstName")} />
                  <EditInput label="Apellido" {...register("insuredLastName")} />
                  <EditInput label="RUT" {...register("insuredRut")} />
                  <EditInput label="Email" type="email" {...register("insuredEmail")} />
                  <EditInput label="Teléfono" {...register("insuredPhone")} />
                  <EditInput label="Celular" {...register("insuredCellPhone")} />
                </div>
              </div>
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Dirección
                </h3>
                <div className="space-y-3">
                  <EditInput label="Dirección" {...register("insuredAddress")} />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <EditInput label="País" {...register("insuredCountry")} />
                    <EditInput label="Región" {...register("insuredRegion")} />
                    <EditInput label="Ciudad" {...register("insuredCity")} />
                    <EditInput label="Comuna" {...register("insuredCommune")} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: PARTICIPANTES ═══ */}
          {activeTab === "participantes" && (
            <div className="space-y-6">
              {/* Contractor */}
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Contratante</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                  <EditInput label="Nombre" {...register("contractorFullName")} />
                  <EditInput label="RUT" {...register("contractorRut")} />
                  <EditInput label="Email" type="email" {...register("contractorEmail")} />
                  <EditInput label="Celular" {...register("contractorCellPhone")} />
                  <EditInput label="Teléfono" {...register("contractorPhone")} />
                  <EditInput label="Dirección" {...register("contractorAddress")} />
                  <EditInput label="País" {...register("contractorCountry")} />
                  <EditInput label="Región" {...register("contractorRegion")} />
                  <EditInput label="Ciudad" {...register("contractorCity")} />
                  <EditInput label="Comuna" {...register("contractorCommune")} />
                </div>
              </div>

              {/* Beneficiary */}
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Beneficiario</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                  <EditInput label="Nombre" {...register("beneficiaryFullName")} />
                  <EditInput label="RUT" {...register("beneficiaryRut")} />
                  <EditInput label="Email" type="email" {...register("beneficiaryEmail")} />
                  <EditInput label="Celular" {...register("beneficiaryCellPhone")} />
                  <EditInput label="Teléfono" {...register("beneficiaryPhone")} />
                  <EditInput label="Dirección" {...register("beneficiaryAddress")} />
                  <EditInput label="País" {...register("beneficiaryCountry")} />
                  <EditInput label="Región" {...register("beneficiaryRegion")} />
                  <EditInput label="Ciudad" {...register("beneficiaryCity")} />
                  <EditInput label="Comuna" {...register("beneficiaryCommune")} />
                </div>
              </div>

              {contact && (
                <div className="app-panel text-center py-6">
                  <p className="text-muted-foreground text-[13px]">
                    Persona de Contacto: {contact.full_name} — {contact.email || contact.phone || "—"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">(no editable desde aquí)</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: INCIDENTE ═══ */}
          {activeTab === "incidente" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="app-panel">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ubicación del Incidente
                </h3>
                <div className="space-y-3">
                  <EditInput label="Dirección" {...register("claimAddress")} />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <EditInput label="País" {...register("claimCountry")} />
                    <EditInput label="Región" {...register("claimRegion")} />
                    <EditInput label="Ciudad" {...register("claimCity")} />
                    <EditInput label="Comuna" {...register("claimCommune")} />
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div className="app-panel">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3">Tipo de Siniestro</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <EditSelect label="Tipo Construcción" control={control} name="constructionTypeId" placeholder="Seleccionar..." clearable items={constructionTypeItems} />
                    <EditSelect label="Destino" control={control} name="destinationHousingId" placeholder="Seleccionar..." clearable items={housingDestItems} />
                    <EditSelect label="Clasif. Daño" control={control} name="damageClassificationId" placeholder="Seleccionar..." clearable items={damageClassItems} />
                    <EditSelect label="Habitabilidad" control={control} name="habitabilityId" placeholder="Seleccionar..." clearable items={habitabilityItems} />
                  </div>
                  <div className="mt-3">
                    <EditCheckbox
                      label="Dueño = Asegurado"
                      checked={watchedOwnerSame}
                      onChange={(v) => form.setValue("ownerSameAsInsured", v)}
                    />
                  </div>
                </div>
                <div className="app-panel">
                  <EditTextarea label="Resumen del Incidente" {...register("summary")} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: ASIGNACIONES ═══ */}
          {activeTab === "asignaciones" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <EditSelect label="Inspector" control={control} name="inspectorId" placeholder="Sin asignar" clearable items={userItems} />
              <EditSelect label="Ajustador" control={control} name="adjusterId" placeholder="Sin asignar" clearable items={userItems} />
              <EditSelect label="Auditor" control={control} name="auditorId" placeholder="Sin asignar" clearable items={userItems} />
              <EditSelect label="Despachador" control={control} name="dispatcherId" placeholder="Sin asignar" clearable items={userItems} />
              <EditSelect label="Asistente" control={control} name="assistantId" placeholder="Sin asignar" clearable items={userItems} />

              <div className="app-panel lg:col-span-3">
                <h3 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
                  <Building className="h-4 w-4" />
                  Compañía e Intermediarios
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-3">
                  <EditSelect label="Compañía Aseg." control={control} name="insuranceCompanyId" placeholder="Seleccionar..." clearable items={insuranceCompanyItems} />
                  <EditSelect label="Línea Negocio" control={control} name="businessLineId" placeholder="Seleccionar..." clearable items={businessLineItems} />
                  <EditSelect label="Producto" control={control} name="insuranceProductId" placeholder="Seleccionar..." clearable items={insuranceProductItems} />
                  <EditSelect label="Corredor" control={control} name="brokerId" placeholder="Seleccionar..." clearable items={brokerItems} />
                  <EditSelect label="Asesor" control={control} name="advisorId" placeholder="Seleccionar..." clearable items={advisorItems} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" className="btn-cancel btn-sm" onClick={onCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
          <Button type="submit" className="btn-save btn-sm" disabled={saveMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
