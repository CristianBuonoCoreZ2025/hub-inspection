"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, useWatch, type Control, type FieldValues } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FileText,
  User,
  Users,
  MapPin,
  Briefcase,
  Shield,
  Plus,
  FileCheck,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormDatePicker } from "@/components/ui/form-date-picker";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { FormSelect } from "@/components/ui/form-select";
import { SelectItem } from "@/components/ui/select";
import { updateClaimFields, updateClaimStatus, updateClaimParticipant, createClaimParticipant } from "@/services/claims";
import { findPerson, upsertPerson, addPersonAddress, type PersonWithAddresses } from "@/services/persons";
import { formatRut, guessPersonType } from "@/lib/validations/rut";
import { getCountries, getRegions, getCities, getCommunes } from "@/services/catalogs";
import { getPolicies, createPolicy } from "@/services/policies";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import { useAuth } from "@/hooks/use-auth";
import { getUsersByRoleForCompany } from "@/services/users";
import type { Claim, ClaimsParticipant, UserOption as UserOptionType } from "@/types";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Catalog {
  id: string;
  name: string;
  country_id?: string | null;
  business_line_id?: string | null;
}

type UserOption = UserOptionType;

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
    companies: Catalog[];
    countries: Catalog[];
  };
  onCancel: (tab: string) => void;
  onSaved: (tab: string) => void;
  initialTab?: string;
}

interface FormValues {
  // Tab Siniestro
  claimNumber: string;
  policyId: string;
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
  companyId: string;
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
  insuredPersonType: string;
  insuredFirstName: string;
  insuredLastName: string;
  insuredBusinessName: string;
  insuredRut: string;
  insuredEmail: string;
  insuredPhones: string;
  insuredAddress: string;
  insuredCountry: string;
  insuredRegion: string;
  insuredCity: string;
  insuredCommune: string;

  // Tab Participantes — Contractor
  contractorPersonType: string;
  contractorFirstName: string;
  contractorLastName: string;
  contractorBusinessName: string;
  contractorRut: string;
  contractorEmail: string;
  contractorPhones: string;
  contractorAddress: string;
  contractorCountry: string;
  contractorRegion: string;
  contractorCity: string;
  contractorCommune: string;

  // Tab Participantes — Beneficiary
  beneficiaryPersonType: string;
  beneficiaryFirstName: string;
  beneficiaryLastName: string;
  beneficiaryBusinessName: string;
  beneficiaryRut: string;
  beneficiaryEmail: string;
  beneficiaryPhones: string;
  beneficiaryAddress: string;
  beneficiaryCountry: string;
  beneficiaryRegion: string;
  beneficiaryCity: string;
  beneficiaryCommune: string;

  // Tab Incidente — Persona de Contacto
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhones: string;

  // Tab Incidente
  claimAddress: string;
  countryId: string;
  regionId: string;
  cityId: string;
  communeId: string;
  constructionTypeId: string;
  destinationHousingId: string;
  damageClassificationId: string;
  habitabilityId: string;
  ownerSameAsInsured: string;

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

// Deduplicate phone numbers: normalize for comparison (strip spaces, +, -, parens)
// but keep the first occurrence's original formatting.
function uniquePhones(...values: (string | null | undefined)[]): string {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const v of values) {
    if (!v) continue;
    // Split by comma in case a value already contains multiple phones
    for (const raw of v.split(",")) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const normalized = trimmed.replace(/[\s+\-()]/g, "").toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(trimmed);
      }
    }
  }
  return result.join(", ");
}

function getParticipant(participants: ClaimsParticipant[], type: string): ClaimsParticipant | undefined {
  return participants.find((p) => p.type === type);
}

// ──────────────────────────────────────────────────────────────
// Reusable field components
// ──────────────────────────────────────────────────────────────

function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <span className="app-data-label">
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
      <Input className="app-input h-7 text-[12px]" {...props} />
    </div>
  );
}

// Input especial para RUT: formatea a mayúsculas + puntos + guión al perder foco
function EditRutInput({
  label,
  required,
  value,
  onChange,
  ...props
}: { label: string; required?: boolean } & React.ComponentProps<"input">) {
  return (
    <div className="space-y-1">
      <FieldLabel label={label} required={required} />
      <Input
        className="app-input h-7 text-[12px] uppercase"
        value={value}
        onChange={onChange}
        onBlur={(e) => {
          // Formatear al perder foco: mayúsculas + formato chileno
          const formatted = formatRut(e.target.value);
          // Disparar onChange con el valor formateado
          onChange?.({ ...e, target: { ...e.target, value: formatted } });
        }}
        {...props}
      />
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
      <Textarea className="app-input min-h-[70px] text-[12px]" {...props} />
    </div>
  );
}

function EditSelect<T extends FieldValues = FieldValues>({
  label,
  required,
  control,
  name,
  placeholder,
  clearable,
  items,
  disabled,
  onValueChange,
}: {
  label: string;
  required?: boolean;
  control: Control<T>;
  name: string;
  placeholder: string;
  clearable?: boolean;
  items: { value: string; label: string }[];
  disabled?: boolean;
  onValueChange?: (value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <FieldLabel label={label} required={required} />
      <FormSelect
        control={control}
        name={name}
        placeholder={placeholder}
        clearable={clearable}
        disabled={disabled}
        onValueChange={onValueChange}
        className="app-input h-7 text-[12px]"
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
    <ToggleChip active={checked} onClick={onChange}>
      {label}
    </ToggleChip>
  );
}

// ──────────────────────────────────────────────────────────────
// Tab definitions
// ──────────────────────────────────────────────────────────────

const tabs = [
  { id: "siniestro", label: "Siniestro", icon: FileText },
  { id: "participantes", label: "Participantes", icon: Users },
  { id: "incidente", label: "Incidente", icon: MapPin },
];

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export default function EditClaimForm({ claim, participants, catalogs, onCancel, onSaved, initialTab = "siniestro" }: EditClaimFormProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const queryClient = useQueryClient();
  const { statusCode, codeToId } = useClaimStatuses();
  const currentStatusCode = statusCode(claim.status_id) ?? "created";
  const { profile } = useAuth();

  // Linking state

  const [claimAddressLinked, setClaimAddressLinked] = useState(() => {
    // Si la dirección del incidente coincide con la del asegurado, iniciar ligado
    const insuredAddr = getParticipant(participants, "insured")?.address;
    return !!insuredAddr && !!claim.claim_address && insuredAddr === claim.claim_address;
  });
  const [contractorLinked, setContractorLinked] = useState(() => getParticipant(participants, "contractor")?.linked_to_insured ?? false);
  const [beneficiaryLinked, setBeneficiaryLinked] = useState(() => getParticipant(participants, "beneficiary")?.linked_to_insured ?? false);

  // RUT autocomplete suggestion — busca en master de personas
  const [participantSuggestion, setParticipantSuggestion] = useState<{
    section: "insured" | "contractor" | "beneficiary";
    person: PersonWithAddresses | null;
  } | null>(null);

  // Dirección seleccionada de las existentes (por sección)
  const [selectedAddressIdx, setSelectedAddressIdx] = useState<{
    insured: number | null;
    contractor: number | null;
    beneficiary: number | null;
  }>({ insured: null, contractor: null, beneficiary: null });

  const insured = getParticipant(participants, "insured");
  const contractor = getParticipant(participants, "contractor");
  const beneficiary = getParticipant(participants, "beneficiary");
  const contact = getParticipant(participants, "contact");

  const form = useForm<FormValues>({
    defaultValues: {
      // Siniestro
      claimNumber: claim.claim_number || "",
      policyId: claim.policy_id || "",
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
      companyId: claim.company_id || "",
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
      insuredPersonType: (!insured?.last_name && insured?.first_name) ? "legal" : "natural",
      insuredFirstName: insured?.first_name || insured?.full_name || "",
      insuredLastName: insured?.last_name || "",
      insuredBusinessName: (!insured?.last_name && insured?.first_name) ? (insured?.first_name || insured?.full_name || "") : "",
      insuredRut: insured?.rut || "",
      insuredEmail: insured?.email || "",
      insuredPhones: uniquePhones(insured?.phone, insured?.cell_phone),
      insuredAddress: insured?.address || "",
      insuredCountry: insured?.country || "",
      insuredRegion: insured?.region || "",
      insuredCity: insured?.city || "",
      insuredCommune: insured?.commune || "",

      // Contractor
      contractorPersonType: (!contractor?.last_name && contractor?.first_name) ? "legal" : "natural",
      contractorFirstName: contractor?.first_name || "",
      contractorLastName: contractor?.last_name || "",
      contractorBusinessName: (!contractor?.last_name && contractor?.first_name) ? (contractor?.first_name || "") : "",
      contractorRut: contractor?.rut || "",
      contractorEmail: contractor?.email || "",
      contractorPhones: uniquePhones(contractor?.phone, contractor?.cell_phone),
      contractorAddress: contractor?.address || "",
      contractorCountry: contractor?.country || "",
      contractorRegion: contractor?.region || "",
      contractorCity: contractor?.city || "",
      contractorCommune: contractor?.commune || "",

      // Beneficiary
      beneficiaryPersonType: (!beneficiary?.last_name && beneficiary?.first_name) ? "legal" : "natural",
      beneficiaryFirstName: beneficiary?.first_name || "",
      beneficiaryLastName: beneficiary?.last_name || "",
      beneficiaryBusinessName: (!beneficiary?.last_name && beneficiary?.first_name) ? (beneficiary?.first_name || "") : "",
      beneficiaryRut: beneficiary?.rut || "",
      beneficiaryEmail: beneficiary?.email || "",
      beneficiaryPhones: uniquePhones(beneficiary?.phone, beneficiary?.cell_phone),
      beneficiaryAddress: beneficiary?.address || "",
      beneficiaryCountry: beneficiary?.country || "",
      beneficiaryRegion: beneficiary?.region || "",
      beneficiaryCity: beneficiary?.city || "",
      beneficiaryCommune: beneficiary?.commune || "",

      // Persona de Contacto
      contactFirstName: contact?.first_name || contact?.full_name || "",
      contactLastName: contact?.last_name || "",
      contactEmail: contact?.email || "",
      contactPhones: uniquePhones(contact?.phone, contact?.cell_phone),

      // Incidente
      claimAddress: claim.claim_address || "",
      countryId: claim.country_id || "",
      regionId: claim.region_id || "",
      cityId: claim.city_id || "",
      communeId: claim.commune_id || "",
      constructionTypeId: claim.construction_type_id || "",
      destinationHousingId: claim.destination_housing_id || "",
      damageClassificationId: claim.damage_classification_id || "",
      habitabilityId: claim.habitability_id || "",
      ownerSameAsInsured: claim.owner_same_as_insured ? "true" : "false",

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
        policy_id: (values.policyId && !values.policyId.startsWith("__")) ? values.policyId : null,
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
        company_id: values.companyId || null,
        currency_id: values.currencyId || null,
        policy_amount: values.policyAmount ? parseFloat(values.policyAmount) : null,
        policy_premium: values.policyPremium ? parseFloat(values.policyPremium) : null,
        policy_start_date: values.policyStartDate || null,
        policy_end_date: values.policyEndDate || null,
        recovery_type_legal: values.recoveryTypeLegal,
        recovery_type_material: values.recoveryTypeMaterial,
        recovery_comments: values.recoveryComments || null,
        claim_address: values.claimAddress || null,
        country_id: values.countryId || null,
        region_id: values.regionId || null,
        city_id: values.cityId || null,
        commune_id: values.communeId || null,
        construction_type_id: values.constructionTypeId || null,
        destination_housing_id: values.destinationHousingId || null,
        damage_classification_id: values.damageClassificationId || null,
        habitability_id: values.habitabilityId || null,
        owner_same_as_insured: values.ownerSameAsInsured === "true",
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

      await updateClaimFields(claim.id, claimSet, profile?.id);

      // Si el claim estaba en "created" y ahora tiene inspector o liquidador → cambiar a "adjustment"
      if (currentStatusCode === "created" && (values.inspectorId || values.adjusterId)) {
        const adjustmentId = codeToId["adjustment"];
        if (adjustmentId) {
          await updateClaimStatus(claim.id, adjustmentId, profile?.id);
        }
      }

      // 2. Actualizar/crear participante insured
      const insuredIsLegal = values.insuredPersonType === "legal";
      const insuredName = insuredIsLegal ? values.insuredBusinessName : values.insuredFirstName;
      const insuredData = {
        full_name: insuredIsLegal ? (values.insuredBusinessName || "") : `${values.insuredFirstName} ${values.insuredLastName}`.trim(),
        first_name: insuredName,
        last_name: insuredIsLegal ? null : (values.insuredLastName || null),
        rut: values.insuredRut || null,
        email: values.insuredEmail || null,
        phone: values.insuredPhones || null,
        cell_phone: null,
        address: values.insuredAddress || null,
        country: values.insuredCountry || null,
        region: values.insuredRegion || null,
        city: values.insuredCity || null,
        commune: values.insuredCommune || null,
      };
      if (insured) {
        await updateClaimParticipant(insured.id, insuredData);
      } else if (insuredName) {
        await createClaimParticipant({ claim_id: claim.id, type: "insured", ...insuredData });
      }

      // 3. Actualizar/crear contractor
      const contractorIsLegal = values.contractorPersonType === "legal";
      const contractorName = contractorIsLegal ? values.contractorBusinessName : values.contractorFirstName;
      const contractorData = {
        full_name: contractorIsLegal ? (values.contractorBusinessName || "") : `${values.contractorFirstName} ${values.contractorLastName}`.trim(),
        first_name: contractorName,
        last_name: contractorIsLegal ? null : (values.contractorLastName || null),
        rut: values.contractorRut || null,
        email: values.contractorEmail || null,
        phone: values.contractorPhones || null,
        cell_phone: null,
        address: values.contractorAddress || null,
        country: values.contractorCountry || null,
        region: values.contractorRegion || null,
        city: values.contractorCity || null,
        commune: values.contractorCommune || null,
        linked_to_insured: contractorLinked,
      };
      if (contractor) {
        if (contractorName) {
          await updateClaimParticipant(contractor.id, contractorData);
        } else {
          // Si no hay nombre, desvincular también
          await updateClaimParticipant(contractor.id, { linked_to_insured: false });
        }
      } else if (contractorName) {
        await createClaimParticipant({ claim_id: claim.id, type: "contractor", ...contractorData });
      }

      // 4. Actualizar/crear beneficiary
      const beneficiaryIsLegal = values.beneficiaryPersonType === "legal";
      const beneficiaryName = beneficiaryIsLegal ? values.beneficiaryBusinessName : values.beneficiaryFirstName;
      const beneficiaryData = {
        full_name: beneficiaryIsLegal ? (values.beneficiaryBusinessName || "") : `${values.beneficiaryFirstName} ${values.beneficiaryLastName}`.trim(),
        first_name: beneficiaryName,
        last_name: beneficiaryIsLegal ? null : (values.beneficiaryLastName || null),
        rut: values.beneficiaryRut || null,
        email: values.beneficiaryEmail || null,
        phone: values.beneficiaryPhones || null,
        cell_phone: null,
        address: values.beneficiaryAddress || null,
        country: values.beneficiaryCountry || null,
        region: values.beneficiaryRegion || null,
        city: values.beneficiaryCity || null,
        commune: values.beneficiaryCommune || null,
        linked_to_insured: beneficiaryLinked,
      };
      if (beneficiary) {
        if (beneficiaryName) {
          await updateClaimParticipant(beneficiary.id, beneficiaryData);
        } else {
          await updateClaimParticipant(beneficiary.id, { linked_to_insured: false });
        }
      } else if (beneficiaryName) {
        await createClaimParticipant({ claim_id: claim.id, type: "beneficiary", ...beneficiaryData });
      }

      // 5. Actualizar/crear persona de contacto
      const contactData = {
        full_name: `${values.contactFirstName} ${values.contactLastName}`.trim(),
        first_name: values.contactFirstName,
        last_name: values.contactLastName || null,
        email: values.contactEmail || null,
        phone: values.contactPhones || null,
        cell_phone: null,
      };
      if (contact) {
        if (values.contactFirstName) {
          await updateClaimParticipant(contact.id, contactData);
        }
      } else if (values.contactFirstName) {
        await createClaimParticipant({ claim_id: claim.id, type: "contact", ...contactData });
      }

      // 6. Upsert personas en master (asegurado, contratante, beneficiario)
      const countryNameForPerson = values.insuredCountry || "";
      const countryForPerson = countriesList?.find((c) => c.name === countryNameForPerson);

      if (countryForPerson && values.insuredRut && insuredName) {
        const person = await upsertPerson({
          country_id: countryForPerson.id,
          tax_id: values.insuredRut,
          person_type: insuredIsLegal ? "legal" : "natural",
          first_name: insuredName,
          last_name: insuredIsLegal ? null : (values.insuredLastName || null),
          business_name: insuredIsLegal ? values.insuredBusinessName : null,
        });
        // Guardar dirección del asegurado
        if (values.insuredAddress || values.insuredCity) {
          await addPersonAddress({
            person_id: person.id,
            address: values.insuredAddress || null,
            country: values.insuredCountry || null,
            region: values.insuredRegion || null,
            city: values.insuredCity || null,
            commune: values.insuredCommune || null,
            source_claim_id: claim.id,
          });
        }
      }

      // Contratante (si tiene RUT propio y no está ligado)
      if (!contractorLinked && countryForPerson && values.contractorRut && contractorName) {
        const person = await upsertPerson({
          country_id: countryForPerson.id,
          tax_id: values.contractorRut,
          person_type: contractorIsLegal ? "legal" : "natural",
          first_name: contractorName,
          last_name: contractorIsLegal ? null : (values.contractorLastName || null),
          business_name: contractorIsLegal ? values.contractorBusinessName : null,
        });
        if (values.contractorAddress || values.contractorCity) {
          await addPersonAddress({
            person_id: person.id,
            address: values.contractorAddress || null,
            country: values.contractorCountry || null,
            region: values.contractorRegion || null,
            city: values.contractorCity || null,
            commune: values.contractorCommune || null,
            source_claim_id: claim.id,
          });
        }
      }

      // Beneficiario (si tiene RUT propio y no está ligado)
      if (!beneficiaryLinked && countryForPerson && values.beneficiaryRut && beneficiaryName) {
        const person = await upsertPerson({
          country_id: countryForPerson.id,
          tax_id: values.beneficiaryRut,
          person_type: beneficiaryIsLegal ? "legal" : "natural",
          first_name: beneficiaryName,
          last_name: beneficiaryIsLegal ? null : (values.beneficiaryLastName || null),
          business_name: beneficiaryIsLegal ? values.beneficiaryBusinessName : null,
        });
        if (values.beneficiaryAddress || values.beneficiaryCity) {
          await addPersonAddress({
            person_id: person.id,
            address: values.beneficiaryAddress || null,
            country: values.beneficiaryCountry || null,
            region: values.beneficiaryRegion || null,
            city: values.beneficiaryCity || null,
            commune: values.beneficiaryCommune || null,
            source_claim_id: claim.id,
          });
        }
      }
    },
    onSuccess: () => {
      toast.success("Siniestro actualizado");
      queryClient.invalidateQueries({ queryKey: ["claim", claim.id] });
      queryClient.invalidateQueries({ queryKey: ["claim-participants", claim.id] });
      queryClient.invalidateQueries({ queryKey: ["claims"] });
      onSaved(activeTab);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { control, register, handleSubmit, watch, setValue } = form;

  // ──────────────────────────────────────────────────────────────
  // Catálogos para selects
  // ──────────────────────────────────────────────────────────────
  const claimTypeItems = catalogs.claimTypes.map((c) => ({ value: c.id, label: c.name }));
  const companyItems = catalogs.companies.map((c) => ({ value: c.id, label: c.name }));
  const countryIdItems = catalogs.countries.map((c) => ({ value: c.id, label: c.name }));
  const eventItems = catalogs.events.map((c) => ({ value: c.id, label: c.name }));
  const currencyItems = catalogs.currencies.map((c) => ({ value: c.id, label: c.name }));
  const housingDestItems = catalogs.housingDestinations.map((c) => ({ value: c.id, label: c.name }));
  const damageClassItems = catalogs.damageClassifications.map((c) => ({ value: c.id, label: c.name }));
  const constructionTypeItems = catalogs.constructionTypes.map((c) => ({ value: c.id, label: c.name }));
  const habitabilityItems = catalogs.habitability.map((c) => ({ value: c.id, label: c.name }));

  // ── Usuarios por rol (perfil principal + secundarios) ──
  const claimCompanyId = claim.company_id;
  const { data: inspectorUsers } = useQuery({
    queryKey: ["users-by-role", "inspector", claimCompanyId],
    queryFn: () => getUsersByRoleForCompany("inspector", claimCompanyId),
  });
  const { data: adjusterUsers } = useQuery({
    queryKey: ["users-by-role", "adjuster", claimCompanyId],
    queryFn: () => getUsersByRoleForCompany("adjuster", claimCompanyId),
  });
  const { data: assistantUsers } = useQuery({
    queryKey: ["users-by-role", "assistant", claimCompanyId],
    queryFn: () => getUsersByRoleForCompany("assistant", claimCompanyId),
  });
  const { data: auditorUsers } = useQuery({
    queryKey: ["users-by-role", "auditor", claimCompanyId],
    queryFn: () => getUsersByRoleForCompany("auditor", claimCompanyId),
  });
  const { data: dispatcherUsers } = useQuery({
    queryKey: ["users-by-role", "dispatcher", claimCompanyId],
    queryFn: () => getUsersByRoleForCompany("dispatcher", claimCompanyId),
  });

  const toItems = (users?: { id: string; full_name: string; email: string }[]) =>
    (users || []).map((u) => ({ value: u.id, label: u.full_name || u.email || "—" }));

  // ──────────────────────────────────────────────────────────────
  // Watched values
  // ──────────────────────────────────────────────────────────────
  // Incidente geo (FK-based, usa IDs)
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedCountryId = watch("countryId");
  const watchedRegionId = watch("regionId");
  const watchedCityId = watch("cityId");

  // Participantes geo (text-based, usa nombres)
  const watchedInsuredCountry = useWatch({ control, name: "insuredCountry" });
  const watchedInsuredRegion = useWatch({ control, name: "insuredRegion" });
  const watchedInsuredCity = useWatch({ control, name: "insuredCity" });
  const watchedInsuredRut = useWatch({ control, name: "insuredRut" });
  const watchedInsuredPersonType = useWatch({ control, name: "insuredPersonType" });

  const watchedContractorCountry = useWatch({ control, name: "contractorCountry" });
  const watchedContractorRegion = useWatch({ control, name: "contractorRegion" });
  const watchedContractorCity = useWatch({ control, name: "contractorCity" });
  const watchedContractorRut = useWatch({ control, name: "contractorRut" });
  const watchedContractorPersonType = useWatch({ control, name: "contractorPersonType" });

  const watchedBeneficiaryCountry = useWatch({ control, name: "beneficiaryCountry" });
  const watchedBeneficiaryRegion = useWatch({ control, name: "beneficiaryRegion" });
  const watchedBeneficiaryCity = useWatch({ control, name: "beneficiaryCity" });
  const watchedBeneficiaryRut = useWatch({ control, name: "beneficiaryRut" });
  const watchedBeneficiaryPersonType = useWatch({ control, name: "beneficiaryPersonType" });

  // Cascading Tipo → Línea → Producto
  const watchedBusinessLineId = watch("businessLineId");

  // Recovery checkboxes
  const watchedRecoveryLegal = watch("recoveryTypeLegal");
  const watchedRecoveryMaterial = watch("recoveryTypeMaterial");

  // ──────────────────────────────────────────────────────────────
  // Geo queries — Incidente (FK-based)
  // ──────────────────────────────────────────────────────────────
  const { data: countriesList } = useQuery({
    queryKey: ["countries"],
    queryFn: () => getCountries(),
  });

  const { data: policiesList } = useQuery({
    queryKey: ["policies"],
    queryFn: () => getPolicies({ companyId: claim.company_id }),
  });

  const policyItems = [
    // Opciones especiales (siempre presentes, independientes de compañía/país)
    { value: "__no_policy", label: "Sin Póliza" },
    { value: "__emision", label: "En Emisión de Número" },
    // Pólizas reales
    ...(policiesList || []).map((p) => ({
      value: p.id,
      label: p.policy_number ? `${p.policy_number} — ${p.policy_name}` : `${p.policy_name} (sin número)`,
    })),
  ];

  // ── Modal de creación de póliza ──
  const [openPolicyModal, setOpenPolicyModal] = useState(false);
  const [policyMode, setPolicyMode] = useState<"pending" | "generic">("pending");
  const [newPolicy, setNewPolicy] = useState({
    policy_number: "",
    policy_name: "",
    insurance_company_id: "",
    business_line_id: "",
    currency: "CLP",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  });

  const createPolicyMut = useMutation({
    mutationFn: () => {
      const baseInput = {
        policy_name: policyMode === "pending"
          ? `PÓLIZA PENDIENTE - ${claim.claim_number}`
          : newPolicy.policy_name || `PÓLIZA GENÉRICA - ${newPolicy.insurance_company_id}`,
        policy_number: policyMode === "pending" ? null : (newPolicy.policy_number || null),
        policy_type: "individual" as const,
        insurance_company_id: newPolicy.insurance_company_id || claim.insurance_company_id || null,
        business_line_id: newPolicy.business_line_id || claim.business_line_id || null,
        currency: newPolicy.currency,
        start_date: newPolicy.start_date,
        end_date: newPolicy.end_date,
        status: policyMode === "pending" ? "draft" : "active",
        company_id: claim.company_id,
      };
      return createPolicy(baseInput);
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setValue("policyId", created.id);
      setValue("policyNumber", created.policy_number || "");
      setValue("policyStartDate", created.start_date);
      setValue("policyEndDate", created.end_date);
      setOpenPolicyModal(false);
      setNewPolicy({
        policy_number: "",
        policy_name: "",
        insurance_company_id: "",
        business_line_id: "",
        currency: "CLP",
        start_date: new Date().toISOString().slice(0, 10),
        end_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      });
      toast.success(policyMode === "pending" ? "Póliza pendiente creada" : "Póliza creada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: regionsList } = useQuery({
    queryKey: ["regions", watchedCountryId],
    queryFn: () => getRegions(watchedCountryId),
    enabled: !!watchedCountryId,
  });
  const { data: citiesList } = useQuery({
    queryKey: ["cities", watchedRegionId],
    queryFn: () => getCities(watchedRegionId),
    enabled: !!watchedRegionId,
  });
  const { data: communesList } = useQuery({
    queryKey: ["communes", watchedCityId],
    queryFn: () => getCommunes(watchedCityId),
    enabled: !!watchedCityId,
  });

  const countryItems = (countriesList ?? []).map((c) => ({ value: c.id, label: c.name }));
  const regionItems = (regionsList ?? []).map((r) => ({ value: r.id, label: r.name }));
  const cityItems = (citiesList ?? []).map((c) => ({ value: c.id, label: c.name }));
  const communeItems = (communesList ?? []).map((c) => ({ value: c.id, label: c.name }));

  // ──────────────────────────────────────────────────────────────
  // Geo queries — Participantes (text-based, usa nombres)
  // ──────────────────────────────────────────────────────────────

  // Asegurado
  const { data: insuredRegions } = useQuery({
    queryKey: ["regions", "insured", watchedInsuredCountry],
    queryFn: () => {
      const country = countriesList?.find((c) => c.name === watchedInsuredCountry);
      return getRegions(country?.id);
    },
    enabled: !!watchedInsuredCountry && !!countriesList,
  });
  const { data: insuredCities } = useQuery({
    queryKey: ["cities", "insured", watchedInsuredRegion],
    queryFn: () => {
      const region = insuredRegions?.find((r) => r.name === watchedInsuredRegion);
      return getCities(region?.id);
    },
    enabled: !!watchedInsuredRegion && !!insuredRegions,
  });
  const { data: insuredCommunes } = useQuery({
    queryKey: ["communes", "insured", watchedInsuredCity],
    queryFn: () => {
      const city = insuredCities?.find((c) => c.name === watchedInsuredCity);
      return getCommunes(city?.id);
    },
    enabled: !!watchedInsuredCity && !!insuredCities,
  });

  // Contratante
  const { data: contractorRegions } = useQuery({
    queryKey: ["regions", "contractor", watchedContractorCountry],
    queryFn: () => {
      const country = countriesList?.find((c) => c.name === watchedContractorCountry);
      return getRegions(country?.id);
    },
    enabled: !!watchedContractorCountry && !!countriesList,
  });
  const { data: contractorCities } = useQuery({
    queryKey: ["cities", "contractor", watchedContractorRegion],
    queryFn: () => {
      const region = contractorRegions?.find((r) => r.name === watchedContractorRegion);
      return getCities(region?.id);
    },
    enabled: !!watchedContractorRegion && !!contractorRegions,
  });
  const { data: contractorCommunes } = useQuery({
    queryKey: ["communes", "contractor", watchedContractorCity],
    queryFn: () => {
      const city = contractorCities?.find((c) => c.name === watchedContractorCity);
      return getCommunes(city?.id);
    },
    enabled: !!watchedContractorCity && !!contractorCities,
  });

  // Beneficiario
  const { data: beneficiaryRegions } = useQuery({
    queryKey: ["regions", "beneficiary", watchedBeneficiaryCountry],
    queryFn: () => {
      const country = countriesList?.find((c) => c.name === watchedBeneficiaryCountry);
      return getRegions(country?.id);
    },
    enabled: !!watchedBeneficiaryCountry && !!countriesList,
  });
  const { data: beneficiaryCities } = useQuery({
    queryKey: ["cities", "beneficiary", watchedBeneficiaryRegion],
    queryFn: () => {
      const region = beneficiaryRegions?.find((r) => r.name === watchedBeneficiaryRegion);
      return getCities(region?.id);
    },
    enabled: !!watchedBeneficiaryRegion && !!beneficiaryRegions,
  });
  const { data: beneficiaryCommunes } = useQuery({
    queryKey: ["communes", "beneficiary", watchedBeneficiaryCity],
    queryFn: () => {
      const city = beneficiaryCities?.find((c) => c.name === watchedBeneficiaryCity);
      return getCommunes(city?.id);
    },
    enabled: !!watchedBeneficiaryCity && !!beneficiaryCities,
  });

  // Visibilidad de campos geo para participantes
  const hasInsuredRegions = !!insuredRegions && insuredRegions.length > 0;
  const hasInsuredCities = !!insuredCities && insuredCities.length > 0;
  const hasInsuredCommunes = !!insuredCommunes && insuredCommunes.length > 0;
  const hasContractorRegions = !!contractorRegions && contractorRegions.length > 0;
  const hasContractorCities = !!contractorCities && contractorCities.length > 0;
  const hasContractorCommunes = !!contractorCommunes && contractorCommunes.length > 0;
  const hasBeneficiaryRegions = !!beneficiaryRegions && beneficiaryRegions.length > 0;
  const hasBeneficiaryCities = !!beneficiaryCities && beneficiaryCities.length > 0;
  const hasBeneficiaryCommunes = !!beneficiaryCommunes && beneficiaryCommunes.length > 0;

  // ──────────────────────────────────────────────────────────────
  // Filtrado por país (catálogos del tab Asignaciones)
  // ──────────────────────────────────────────────────────────────
  const filteredInsuranceCompanies = catalogs.insuranceCompanies.filter(
    (c) => !watchedCountryId || c.country_id === watchedCountryId
  );
  const filteredBrokers = catalogs.brokers.filter(
    (b) => !watchedCountryId || b.country_id === watchedCountryId
  );
  const filteredAdvisors = catalogs.advisors.filter(
    (a) => !watchedCountryId || a.country_id === watchedCountryId
  );
  const filteredBusinessLines = catalogs.businessLines.filter(
    (b) => !watchedCountryId || b.country_id === watchedCountryId
  );
  const filteredClaimCauses = catalogs.claimCauses.filter(
    (c) => !watchedCountryId || c.country_id === watchedCountryId
  );
  const filteredInsuranceProducts = catalogs.insuranceProducts.filter(
    (p) => !watchedBusinessLineId || p.business_line_id === watchedBusinessLineId
  );

  const insuranceCompanyItems = filteredInsuranceCompanies.map((c) => ({ value: c.id, label: c.name }));
  const businessLineItems = filteredBusinessLines.map((c) => ({ value: c.id, label: c.name }));
  const insuranceProductItems = filteredInsuranceProducts.map((c) => ({ value: c.id, label: c.name }));
  const brokerItems = filteredBrokers.map((c) => ({ value: c.id, label: c.name }));
  const advisorItems = filteredAdvisors.map((c) => ({ value: c.id, label: c.name }));
  const claimCauseItems = filteredClaimCauses.map((c) => ({ value: c.id, label: c.name }));

  // Reset dependent fields when incident country changes (skip initial load)
  const prevCountryId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevCountryId.current === undefined) {
      // First render: just record the value, don't reset
      prevCountryId.current = watchedCountryId;
      return;
    }
    if (prevCountryId.current !== watchedCountryId) {
      prevCountryId.current = watchedCountryId;
      setValue("insuranceCompanyId", "");
      setValue("advisorId", "");
      setValue("brokerId", "");
      setValue("businessLineId", "");
      setValue("insuranceProductId", "");
      setValue("claimCauseId", "");
      // Sincronizar país del siniestro con país del asegurado
      const countryName = countriesList?.find((c) => c.id === watchedCountryId)?.name;
      if (countryName) {
        setValue("insuredCountry", countryName);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCountryId]);

  // ──────────────────────────────────────────────────────────────
  // Autocomplete por RUT — busca en master de personas
  // ──────────────────────────────────────────────────────────────

  // Función helper: buscar persona por RUT + país
  const lookupPerson = async (rut: string, countryName: string): Promise<PersonWithAddresses | null> => {
    if (!rut || rut.trim().length < 3 || !countryName) return null;
    const country = countriesList?.find((c) => c.name === countryName);
    if (!country) return null;
    return findPerson(country.id, rut.trim());
  };

  // Auto-detectar tipo de persona (natural/legal) según RUT en Chile
  useEffect(() => {
    if (!watchedInsuredRut || watchedInsuredRut.trim().length < 3 || !watchedInsuredCountry) return;
    const guessed = guessPersonType(watchedInsuredRut, watchedInsuredCountry);
    if (guessed && guessed !== watchedInsuredPersonType) {
      setValue("insuredPersonType", guessed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedInsuredRut, watchedInsuredCountry]);

  useEffect(() => {
    if (!watchedContractorRut || watchedContractorRut.trim().length < 3 || !watchedContractorCountry) return;
    const guessed = guessPersonType(watchedContractorRut, watchedContractorCountry);
    if (guessed && guessed !== watchedContractorPersonType) {
      setValue("contractorPersonType", guessed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedContractorRut, watchedContractorCountry]);

  useEffect(() => {
    if (!watchedBeneficiaryRut || watchedBeneficiaryRut.trim().length < 3 || !watchedBeneficiaryCountry) return;
    const guessed = guessPersonType(watchedBeneficiaryRut, watchedBeneficiaryCountry);
    if (guessed && guessed !== watchedBeneficiaryPersonType) {
      setValue("beneficiaryPersonType", guessed);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedBeneficiaryRut, watchedBeneficiaryCountry]);

  // Asegurado
  useEffect(() => {
    if (!watchedInsuredRut || watchedInsuredRut.trim().length < 3 || !watchedInsuredCountry) {
      setParticipantSuggestion((prev) => prev?.section === "insured" ? null : prev);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const person = await lookupPerson(watchedInsuredRut, watchedInsuredCountry);
        if (!cancelled) {
          if (person) {
            setParticipantSuggestion({ section: "insured", person });
          } else {
            setParticipantSuggestion((prev) => prev?.section === "insured" ? null : prev);
          }
        }
      } catch {
        if (!cancelled) setParticipantSuggestion((prev) => prev?.section === "insured" ? null : prev);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedInsuredRut, watchedInsuredCountry]);

  // Contratante
  useEffect(() => {
    if (!watchedContractorRut || watchedContractorRut.trim().length < 3 || !watchedContractorCountry) {
      setParticipantSuggestion((prev) => prev?.section === "contractor" ? null : prev);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const person = await lookupPerson(watchedContractorRut, watchedContractorCountry);
        if (!cancelled) {
          if (person) {
            setParticipantSuggestion({ section: "contractor", person });
          } else {
            setParticipantSuggestion((prev) => prev?.section === "contractor" ? null : prev);
          }
        }
      } catch {
        if (!cancelled) setParticipantSuggestion((prev) => prev?.section === "contractor" ? null : prev);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedContractorRut, watchedContractorCountry]);

  // Beneficiario
  useEffect(() => {
    if (!watchedBeneficiaryRut || watchedBeneficiaryRut.trim().length < 3 || !watchedBeneficiaryCountry) {
      setParticipantSuggestion((prev) => prev?.section === "beneficiary" ? null : prev);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const person = await lookupPerson(watchedBeneficiaryRut, watchedBeneficiaryCountry);
        if (!cancelled) {
          if (person) {
            setParticipantSuggestion({ section: "beneficiary", person });
          } else {
            setParticipantSuggestion((prev) => prev?.section === "beneficiary" ? null : prev);
          }
        }
      } catch {
        if (!cancelled) setParticipantSuggestion((prev) => prev?.section === "beneficiary" ? null : prev);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedBeneficiaryRut, watchedBeneficiaryCountry]);

  // ──────────────────────────────────────────────────────────────
  // Copy from insured (one-time copy, fields remain editable)
  // ──────────────────────────────────────────────────────────────
  const toggleContractorLink = () => {
    if (!contractorLinked) {
      setValue("contractorPersonType", form.getValues("insuredPersonType") || "natural");
      setValue("contractorFirstName", form.getValues("insuredFirstName") || "");
      setValue("contractorLastName", form.getValues("insuredLastName") || "");
      setValue("contractorBusinessName", form.getValues("insuredBusinessName") || "");
      setValue("contractorRut", form.getValues("insuredRut") || "");
      setValue("contractorEmail", form.getValues("insuredEmail") || "");
      setValue("contractorPhones", form.getValues("insuredPhones") || "");
      setValue("contractorAddress", form.getValues("insuredAddress") || "");
      setValue("contractorCountry", form.getValues("insuredCountry") || "");
      setValue("contractorRegion", form.getValues("insuredRegion") || "");
      setValue("contractorCity", form.getValues("insuredCity") || "");
      setValue("contractorCommune", form.getValues("insuredCommune") || "");
      setContractorLinked(true);
    } else {
      setContractorLinked(false);
    }
  };

  const toggleBeneficiaryLink = () => {
    if (!beneficiaryLinked) {
      setValue("beneficiaryPersonType", form.getValues("insuredPersonType") || "natural");
      setValue("beneficiaryFirstName", form.getValues("insuredFirstName") || "");
      setValue("beneficiaryLastName", form.getValues("insuredLastName") || "");
      setValue("beneficiaryBusinessName", form.getValues("insuredBusinessName") || "");
      setValue("beneficiaryRut", form.getValues("insuredRut") || "");
      setValue("beneficiaryEmail", form.getValues("insuredEmail") || "");
      setValue("beneficiaryPhones", form.getValues("insuredPhones") || "");
      setValue("beneficiaryAddress", form.getValues("insuredAddress") || "");
      setValue("beneficiaryCountry", form.getValues("insuredCountry") || "");
      setValue("beneficiaryRegion", form.getValues("insuredRegion") || "");
      setValue("beneficiaryCity", form.getValues("insuredCity") || "");
      setValue("beneficiaryCommune", form.getValues("insuredCommune") || "");
      setBeneficiaryLinked(true);
    } else {
      setBeneficiaryLinked(false);
    }
  };

  const toggleClaimAddressLink = () => {
    if (!claimAddressLinked) {
      // Copiar dirección
      setValue("claimAddress", form.getValues("insuredAddress") || "");
      // Mapear país (nombre → ID)
      const insuredCountryName = form.getValues("insuredCountry") || "";
      const country = countriesList?.find((c) => c.name === insuredCountryName);
      setValue("countryId", country?.id || "");
      // Las regiones/ciudades/comunas se mapean en el useEffect cuando los datos carguen
      setClaimAddressLinked(true);
    } else {
      setClaimAddressLinked(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Cascada: cuando claimAddressLinked, mapear nombres del asegurado a IDs del incidente
  // ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!claimAddressLinked) return;
    // Mapear región (nombre → ID) cuando las regiones del incidente carguen
    const insuredRegionName = form.getValues("insuredRegion") || "";
    if (insuredRegionName && regionsList) {
      const region = regionsList.find((r) => r.name === insuredRegionName);
      if (region && form.getValues("regionId") !== region.id) {
        setValue("regionId", region.id);
      }
    }
  }, [claimAddressLinked, regionsList, setValue, form]);

  useEffect(() => {
    if (!claimAddressLinked) return;
    const insuredCityName = form.getValues("insuredCity") || "";
    if (insuredCityName && citiesList) {
      const city = citiesList.find((c) => c.name === insuredCityName);
      if (city && form.getValues("cityId") !== city.id) {
        setValue("cityId", city.id);
      }
    }
  }, [claimAddressLinked, citiesList, setValue, form]);

  useEffect(() => {
    if (!claimAddressLinked) return;
    const insuredCommuneName = form.getValues("insuredCommune") || "";
    if (insuredCommuneName && communesList) {
      const commune = communesList.find((c) => c.name === insuredCommuneName);
      if (commune && form.getValues("communeId") !== commune.id) {
        setValue("communeId", commune.id);
      }
    }
  }, [claimAddressLinked, communesList, setValue, form]);

  // ──────────────────────────────────────────────────────────────
  // Apply person suggestion — pre-llenar nombres desde el master
  // ──────────────────────────────────────────────────────────────
  const applySuggestion = (section: "insured" | "contractor" | "beneficiary") => {
    if (!participantSuggestion) return;
    const p = participantSuggestion.person;
    if (!p) return;

    const isLegal = p.person_type === "legal";
    const firstName = isLegal ? (p.business_name || "") : (p.first_name || "");
    const lastName = isLegal ? "" : (p.last_name || "");
    const businessName = isLegal ? (p.business_name || "") : "";

    if (section === "insured") {
      setValue("insuredPersonType", isLegal ? "legal" : "natural");
      setValue("insuredFirstName", firstName);
      setValue("insuredLastName", lastName);
      setValue("insuredBusinessName", businessName);
      if (p.person_addresses.length > 0) {
        const addr = p.person_addresses[0];
        setValue("insuredAddress", addr.address || "");
        setValue("insuredCountry", addr.country || "");
        setValue("insuredRegion", addr.region || "");
        setValue("insuredCity", addr.city || "");
        setValue("insuredCommune", addr.commune || "");
        setSelectedAddressIdx((prev) => ({ ...prev, insured: 0 }));
      }
    } else if (section === "contractor") {
      setValue("contractorPersonType", isLegal ? "legal" : "natural");
      setValue("contractorFirstName", firstName);
      setValue("contractorLastName", lastName);
      setValue("contractorBusinessName", businessName);
      if (p.person_addresses.length > 0) {
        const addr = p.person_addresses[0];
        setValue("contractorAddress", addr.address || "");
        setValue("contractorCountry", addr.country || "");
        setValue("contractorRegion", addr.region || "");
        setValue("contractorCity", addr.city || "");
        setValue("contractorCommune", addr.commune || "");
        setSelectedAddressIdx((prev) => ({ ...prev, contractor: 0 }));
      }
    } else if (section === "beneficiary") {
      setValue("beneficiaryPersonType", isLegal ? "legal" : "natural");
      setValue("beneficiaryFirstName", firstName);
      setValue("beneficiaryLastName", lastName);
      setValue("beneficiaryBusinessName", businessName);
      if (p.person_addresses.length > 0) {
        const addr = p.person_addresses[0];
        setValue("beneficiaryAddress", addr.address || "");
        setValue("beneficiaryCountry", addr.country || "");
        setValue("beneficiaryRegion", addr.region || "");
        setValue("beneficiaryCity", addr.city || "");
        setValue("beneficiaryCommune", addr.commune || "");
        setSelectedAddressIdx((prev) => ({ ...prev, beneficiary: 0 }));
      }
    }
    setParticipantSuggestion(null);
  };

  // Helper: nombre para mostrar de una persona
  const personDisplayName = (p: PersonWithAddresses) =>
    p.person_type === "legal"
      ? (p.business_name || "")
      : [p.first_name, p.last_name].filter(Boolean).join(" ");

  // Seleccionar una dirección existente de la persona
  const selectAddress = (section: "insured" | "contractor" | "beneficiary", idx: number) => {
    if (!participantSuggestion?.person) return;
    const addr = participantSuggestion.person.person_addresses[idx];
    if (!addr) return;

    if (section === "insured") {
      setValue("insuredAddress", addr.address || "");
      setValue("insuredCountry", addr.country || "");
      setValue("insuredRegion", addr.region || "");
      setValue("insuredCity", addr.city || "");
      setValue("insuredCommune", addr.commune || "");
    } else if (section === "contractor") {
      setValue("contractorAddress", addr.address || "");
      setValue("contractorCountry", addr.country || "");
      setValue("contractorRegion", addr.region || "");
      setValue("contractorCity", addr.city || "");
      setValue("contractorCommune", addr.commune || "");
    } else if (section === "beneficiary") {
      setValue("beneficiaryAddress", addr.address || "");
      setValue("beneficiaryCountry", addr.country || "");
      setValue("beneficiaryRegion", addr.region || "");
      setValue("beneficiaryCity", addr.city || "");
      setValue("beneficiaryCommune", addr.commune || "");
    }
    setSelectedAddressIdx((prev) => ({ ...prev, [section]: idx }));
  };

  // ──────────────────────────────────────────────────────────────
  // Geo items para participantes (usa nombres como value)
  // ──────────────────────────────────────────────────────────────
  const participantCountryItems = (countriesList ?? []).map((c) => ({ value: c.name, label: c.name }));
  const insuredRegionItems = (insuredRegions ?? []).map((r) => ({ value: r.name, label: r.name }));
  const insuredCityItems = (insuredCities ?? []).map((c) => ({ value: c.name, label: c.name }));
  const insuredCommuneItems = (insuredCommunes ?? []).map((c) => ({ value: c.name, label: c.name }));
  const contractorRegionItems = (contractorRegions ?? []).map((r) => ({ value: r.name, label: r.name }));
  const contractorCityItems = (contractorCities ?? []).map((c) => ({ value: c.name, label: c.name }));
  const contractorCommuneItems = (contractorCommunes ?? []).map((c) => ({ value: c.name, label: c.name }));
  const beneficiaryRegionItems = (beneficiaryRegions ?? []).map((r) => ({ value: r.name, label: r.name }));
  const beneficiaryCityItems = (beneficiaryCities ?? []).map((c) => ({ value: c.name, label: c.name }));
  const beneficiaryCommuneItems = (beneficiaryCommunes ?? []).map((c) => ({ value: c.name, label: c.name }));

  // ──────────────────────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-2">
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
                className={`flex items-center gap-2 px-4 py-2.5 text-[12px] font-medium border-b-2 transition-colors whitespace-nowrap ${
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

      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-2">
        {/* Tab content */}
        <div className="min-h-[300px]">
          {/* ═══ TAB: SINIESTRO ═══ */}
          {activeTab === "siniestro" && (
            <div className="space-y-2">
              <div className="app-panel">
                <h3 className="app-section-title">
                  <FileText className="h-4 w-4" />
                  Datos del Siniestro
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1">
                  <EditSelect label="País del Siniestro" control={control} name="countryId" placeholder="Seleccionar..." clearable items={countryIdItems} />
                  <EditSelect label="Empresa (Cliente)" required control={control} name="companyId" placeholder="Seleccionar..." items={companyItems} />
                  <EditSelect label="Compañía de Seguros" control={control} name="insuranceCompanyId" placeholder="Seleccionar..." clearable items={insuranceCompanyItems} />
                  <EditInput label="N° Ref. Cliente" {...register("clientReference")} />
                  <EditInput label="N° Siniestro (Cía)" required {...register("claimNumber")} />
                  <div className="space-y-1">
                    <FieldLabel label="Fecha Siniestro" required />
                    <FormDatePicker control={control} name="claimDate" className="w-[130px]" />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel label="Fecha Denuncio" />
                    <FormDatePicker control={control} name="reportDate" className="w-[130px]" />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel label="Fecha Asignación" />
                    <FormDatePicker control={control} name="assignmentDate" className="w-[130px]" />
                  </div>
                </div>
              </div>

              <div className="app-panel">
                <h3 className="app-section-title">
                  <Shield className="h-4 w-4" />
                  Clasificación
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1">
                  <EditSelect
                    label="Tipo de Siniestro"
                    required
                    control={control}
                    name="claimTypeId"
                    placeholder="Seleccionar..."
                    items={claimTypeItems}
                    onValueChange={() => {
                      setValue("businessLineId", "");
                      setValue("insuranceProductId", "");
                    }}
                  />
                  <EditSelect
                    label="Línea de Negocios"
                    control={control}
                    name="businessLineId"
                    placeholder="Seleccionar..."
                    clearable
                    items={businessLineItems}
                    onValueChange={() => setValue("insuranceProductId", "")}
                  />
                  <EditSelect
                    label="Ramo/Producto"
                    control={control}
                    name="insuranceProductId"
                    placeholder="Seleccionar..."
                    clearable
                    items={insuranceProductItems}
                    disabled={!watchedBusinessLineId}
                  />
                  <EditSelect label="Causal" control={control} name="claimCauseId" placeholder="Seleccionar..." clearable items={claimCauseItems} />
                  <EditSelect label="Evento" control={control} name="eventId" placeholder="Seleccionar..." clearable items={eventItems} />
                  <EditSelect label="Corredor" control={control} name="brokerId" placeholder="Seleccionar..." clearable items={brokerItems} />
                </div>
              </div>

              <div className="app-panel">
                <h3 className="app-section-title">
                  <Shield className="h-4 w-4" />
                  Datos de la Póliza
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <FieldLabel label="Póliza" />
                      <button
                        type="button"
                        onClick={() => setOpenPolicyModal(true)}
                        className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
                        title="Crear nueva póliza"
                      >
                        <Plus className="h-3 w-3" />
                        Crear
                      </button>
                    </div>
                    <FormSelect
                      control={control}
                      name="policyId"
                      placeholder="Seleccionar póliza..."
                      clearable
                      className="app-input h-7 text-[12px]"
                      items={policyItems}
                      onValueChange={(value) => {
                        if (value === "__no_policy") {
                          setValue("policyId", "" as never);
                          setValue("policyNumber", "");
                          setValue("policyStartDate", null as never);
                          setValue("policyEndDate", null as never);
                          setValue("policyAmount", "");
                          setValue("policyPremium", "");
                        } else if (value === "__emision") {
                          // Crear póliza pendiente automáticamente si no existe
                          const existingPending = policiesList?.find(
                            (p) => !p.policy_number && p.status === "draft"
                          );
                          if (existingPending) {
                            setValue("policyId", existingPending.id as never);
                            setValue("policyNumber", "");
                            setValue("policyStartDate", existingPending.start_date as never);
                            setValue("policyEndDate", existingPending.end_date as never);
                          } else {
                            // Disparar creación de póliza pendiente
                            createPolicyMut.mutate();
                          }
                        } else {
                          const selected = policiesList?.find((p) => p.id === value);
                          if (selected) {
                            setValue("policyNumber", selected.policy_number || "");
                            setValue("policyStartDate", selected.start_date);
                            setValue("policyEndDate", selected.end_date);
                            setValue("policyAmount", selected.insured_amount?.toString() || "");
                            setValue("policyPremium", selected.premium_amount?.toString() || "");
                          } else {
                            setValue("policyNumber", "");
                          }
                        }
                      }}
                    >
                      {policyItems.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                  <EditInput label="N° Póliza" {...register("policyNumber")} />
                  <EditInput label="Item Póliza" {...register("policyItem")} />
                  <EditSelect label="Moneda" control={control} name="currencyId" placeholder="Seleccionar..." clearable items={currencyItems} />
                  <EditInput label="Monto Asegurado" type="number" step="0.01" {...register("policyAmount")} />
                  <EditInput label="Prima" type="number" step="0.01" {...register("policyPremium")} />
                  <div className="space-y-1">
                    <FieldLabel label="Inicio Vigencia" />
                    <FormDatePicker control={control} name="policyStartDate" className="w-[130px]" />
                  </div>
                  <div className="space-y-1">
                    <FieldLabel label="Término Vigencia" />
                    <FormDatePicker control={control} name="policyEndDate" className="w-[130px]" />
                  </div>
                </div>
              </div>

              <div className="app-panel">
                <h3 className="app-section-title">
                  <Briefcase className="h-4 w-4" />
                  Asignación
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1">
                  <EditSelect label="Inspector" control={control} name="inspectorId" placeholder="Sin asignar" clearable items={toItems(inspectorUsers)} />
                  <EditSelect label="Ajustador / Liquidador" control={control} name="adjusterId" placeholder="Sin asignar" clearable items={toItems(adjusterUsers)} />
                  <EditSelect label="Auditor" control={control} name="auditorId" placeholder="Sin asignar" clearable items={toItems(auditorUsers)} />
                  <EditSelect label="Despachador" control={control} name="dispatcherId" placeholder="Sin asignar" clearable items={toItems(dispatcherUsers)} />
                  <EditSelect label="Asistente" control={control} name="assistantId" placeholder="Sin asignar" clearable items={toItems(assistantUsers)} />
                  <EditSelect label="Asesor" control={control} name="advisorId" placeholder="Sin asignar" clearable items={advisorItems} />
                </div>
              </div>

              <div className="app-panel">
                <EditTextarea label="Resumen" {...register("summary")} />
              </div>
            </div>
          )}

          {/* ═══ TAB: ASEGURADO ═══ */}
          {/* ═══ TAB: PARTICIPANTES ═══ */}
          {activeTab === "participantes" && (
            <div className="space-y-2">
              {/* Asegurado (no colapsable) */}
              <div className="app-panel">
                <div className="w-full flex items-center pb-2">
                  <span className="app-section-title text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Asegurado
                  </span>
                </div>
                <div className="space-y-3 pt-2">
                  {participantSuggestion?.section === "insured" && participantSuggestion.person && (
                    <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-sky-800">
                          <span className="font-semibold">Persona encontrada:</span>{" "}
                          {personDisplayName(participantSuggestion.person)}
                        </div>
                        <button
                          type="button"
                          className="btn-link-sm"
                          onClick={() => applySuggestion("insured")}
                        >
                          Usar datos
                        </button>
                      </div>
                      {participantSuggestion.person.person_addresses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] text-sky-600">Direcciones previas:</span>
                          {participantSuggestion.person.person_addresses.map((addr, idx) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => selectAddress("insured", idx)}
                              className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${
                                selectedAddressIdx.insured === idx
                                  ? "bg-sky-600 text-white border-sky-600"
                                  : "bg-white text-sky-700 border-sky-300 hover:bg-sky-100"
                              }`}
                            >
                              {addr.address || "Sin dirección"}{addr.commune ? `, ${addr.commune}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="app-data-grid-4">
                    <EditRutInput label="RUT" {...register("insuredRut")} />
                    <EditSelect
                      label="Tipo"
                      control={control}
                      name="insuredPersonType"
                      placeholder="Seleccionar..."
                      items={[
                        { value: "natural", label: "Persona Natural" },
                        { value: "legal", label: "Persona Jurídica" },
                      ]}
                    />
                    {watchedInsuredPersonType === "legal" ? (
                      <EditInput label="Razón Social" required {...register("insuredBusinessName")} />
                    ) : (
                      <>
                        <EditInput label="Nombre" required {...register("insuredFirstName")} />
                        <EditInput label="Apellido" {...register("insuredLastName")} />
                      </>
                    )}
                    <EditInput label="Email" type="email" {...register("insuredEmail")} />
                    <EditInput label="Teléfono" {...register("insuredPhones")} placeholder="+56 9 1234 5678, +56 2 2345 6789" />
                    <EditInput label="Dirección" {...register("insuredAddress")} />
                    <EditSelect
                      label="País"
                      control={control}
                      name="insuredCountry"
                      placeholder="Seleccionar..."
                      clearable
                      items={participantCountryItems}
                      onValueChange={() => {
                        setValue("insuredRegion", "");
                        setValue("insuredCity", "");
                        setValue("insuredCommune", "");
                      }}
                    />
                    {hasInsuredRegions && (
                      <EditSelect
                        label="Región"
                        control={control}
                        name="insuredRegion"
                        placeholder="Seleccionar..."
                        clearable
                        items={insuredRegionItems}
                        disabled={!watchedInsuredCountry}
                        onValueChange={() => {
                          setValue("insuredCity", "");
                          setValue("insuredCommune", "");
                        }}
                      />
                    )}
                    {hasInsuredCities && (
                      <EditSelect
                        label="Ciudad"
                        control={control}
                        name="insuredCity"
                        placeholder="Seleccionar..."
                        clearable
                        items={insuredCityItems}
                        disabled={!watchedInsuredRegion}
                        onValueChange={() => setValue("insuredCommune", "")}
                      />
                    )}
                    {hasInsuredCommunes && (
                      <EditSelect
                        label="Comuna"
                        control={control}
                        name="insuredCommune"
                        placeholder="Seleccionar..."
                        clearable
                        items={insuredCommuneItems}
                        disabled={!watchedInsuredCity}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Contractor */}
              <div className="app-panel">
                <div className="w-full flex items-center justify-between pb-2">
                  <span className="app-section-title text-[11px] font-semibold text-muted-foreground">Contratante</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[11px] w-[150px] justify-center ${contractorLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                    onClick={toggleContractorLink}
                  >
                    {contractorLinked ? "Desligar" : "Copiar"}
                  </Button>
                </div>
                <div className="space-y-3 pt-2">
                  {participantSuggestion?.section === "contractor" && !contractorLinked && participantSuggestion.person && (
                    <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-sky-800">
                          <span className="font-semibold">Persona encontrada:</span>{" "}
                          {personDisplayName(participantSuggestion.person)}
                        </div>
                        <button
                          type="button"
                          className="btn-link-sm"
                          onClick={() => applySuggestion("contractor")}
                        >
                          Usar datos
                        </button>
                      </div>
                      {participantSuggestion.person.person_addresses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] text-sky-600">Direcciones previas:</span>
                          {participantSuggestion.person.person_addresses.map((addr, idx) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => selectAddress("contractor", idx)}
                              className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${
                                selectedAddressIdx.contractor === idx
                                  ? "bg-sky-600 text-white border-sky-600"
                                  : "bg-white text-sky-700 border-sky-300 hover:bg-sky-100"
                              }`}
                            >
                              {addr.address || "Sin dirección"}{addr.commune ? `, ${addr.commune}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="app-data-grid-4">
                    <EditRutInput label="RUT" {...register("contractorRut")} disabled={contractorLinked} />
                    <EditSelect
                      label="Tipo"
                      control={control}
                      name="contractorPersonType"
                      placeholder="Seleccionar..."
                      disabled={contractorLinked}
                      items={[
                        { value: "natural", label: "Persona Natural" },
                        { value: "legal", label: "Persona Jurídica" },
                      ]}
                    />
                    {watchedContractorPersonType === "legal" ? (
                      <EditInput label="Razón Social" {...register("contractorBusinessName")} disabled={contractorLinked} />
                    ) : (
                      <>
                        <EditInput label="Nombre" {...register("contractorFirstName")} disabled={contractorLinked} />
                        <EditInput label="Apellido" {...register("contractorLastName")} disabled={contractorLinked} />
                      </>
                    )}
                    <EditInput label="Email" type="email" {...register("contractorEmail")} disabled={contractorLinked} />
                    <EditInput label="Teléfono" {...register("contractorPhones")} placeholder="+56 9 1234 5678, +56 2 2345 6789" disabled={contractorLinked} />
                    <EditInput label="Dirección" {...register("contractorAddress")} disabled={contractorLinked} />
                    <EditSelect
                      label="País"
                      control={control}
                      name="contractorCountry"
                      placeholder="Seleccionar..."
                      clearable
                      items={participantCountryItems}
                      disabled={contractorLinked}
                      onValueChange={() => {
                        setValue("contractorRegion", "");
                        setValue("contractorCity", "");
                        setValue("contractorCommune", "");
                      }}
                    />
                    {hasContractorRegions && (
                      <EditSelect
                        label="Región"
                        control={control}
                        name="contractorRegion"
                        placeholder="Seleccionar..."
                        clearable
                        items={contractorRegionItems}
                        disabled={!watchedContractorCountry || contractorLinked}
                        onValueChange={() => {
                          setValue("contractorCity", "");
                          setValue("contractorCommune", "");
                        }}
                      />
                    )}
                    {hasContractorCities && (
                      <EditSelect
                        label="Ciudad"
                        control={control}
                        name="contractorCity"
                        placeholder="Seleccionar..."
                        clearable
                        items={contractorCityItems}
                        disabled={!watchedContractorRegion || contractorLinked}
                        onValueChange={() => setValue("contractorCommune", "")}
                      />
                    )}
                    {hasContractorCommunes && (
                      <EditSelect
                        label="Comuna"
                        control={control}
                        name="contractorCommune"
                        placeholder="Seleccionar..."
                        clearable
                        items={contractorCommuneItems}
                        disabled={!watchedContractorCity || contractorLinked}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Beneficiary */}
              <div className="app-panel">
                <div className="w-full flex items-center justify-between pb-2">
                  <span className="app-section-title text-[11px] font-semibold text-muted-foreground">Beneficiario</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[11px] w-[150px] justify-center ${beneficiaryLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                    onClick={toggleBeneficiaryLink}
                  >
                    {beneficiaryLinked ? "Desligar" : "Copiar"}
                  </Button>
                </div>
                <div className="space-y-3 pt-2">
                  {participantSuggestion?.section === "beneficiary" && !beneficiaryLinked && participantSuggestion.person && (
                    <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-sky-800">
                          <span className="font-semibold">Persona encontrada:</span>{" "}
                          {personDisplayName(participantSuggestion.person)}
                        </div>
                        <button
                          type="button"
                          className="btn-link-sm"
                          onClick={() => applySuggestion("beneficiary")}
                        >
                          Usar datos
                        </button>
                      </div>
                      {participantSuggestion.person.person_addresses.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[10px] text-sky-600">Direcciones previas:</span>
                          {participantSuggestion.person.person_addresses.map((addr, idx) => (
                            <button
                              key={addr.id}
                              type="button"
                              onClick={() => selectAddress("beneficiary", idx)}
                              className={`text-[10px] rounded px-1.5 py-0.5 border transition-colors ${
                                selectedAddressIdx.beneficiary === idx
                                  ? "bg-sky-600 text-white border-sky-600"
                                  : "bg-white text-sky-700 border-sky-300 hover:bg-sky-100"
                              }`}
                            >
                              {addr.address || "Sin dirección"}{addr.commune ? `, ${addr.commune}` : ""}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="app-data-grid-4">
                    <EditRutInput label="RUT" {...register("beneficiaryRut")} disabled={beneficiaryLinked} />
                    <EditSelect
                      label="Tipo"
                      control={control}
                      name="beneficiaryPersonType"
                      placeholder="Seleccionar..."
                      disabled={beneficiaryLinked}
                      items={[
                        { value: "natural", label: "Persona Natural" },
                        { value: "legal", label: "Persona Jurídica" },
                      ]}
                    />
                    {watchedBeneficiaryPersonType === "legal" ? (
                      <EditInput label="Razón Social" {...register("beneficiaryBusinessName")} disabled={beneficiaryLinked} />
                    ) : (
                      <>
                        <EditInput label="Nombre" {...register("beneficiaryFirstName")} disabled={beneficiaryLinked} />
                        <EditInput label="Apellido" {...register("beneficiaryLastName")} disabled={beneficiaryLinked} />
                      </>
                    )}
                    <EditInput label="Email" type="email" {...register("beneficiaryEmail")} disabled={beneficiaryLinked} />
                    <EditInput label="Teléfono" {...register("beneficiaryPhones")} placeholder="+56 9 1234 5678, +56 2 2345 6789" disabled={beneficiaryLinked} />
                    <EditInput label="Dirección" {...register("beneficiaryAddress")} disabled={beneficiaryLinked} />
                    <EditSelect
                      label="País"
                      control={control}
                      name="beneficiaryCountry"
                      placeholder="Seleccionar..."
                      clearable
                      items={participantCountryItems}
                      disabled={beneficiaryLinked}
                      onValueChange={() => {
                        setValue("beneficiaryRegion", "");
                        setValue("beneficiaryCity", "");
                        setValue("beneficiaryCommune", "");
                      }}
                    />
                    {hasBeneficiaryRegions && (
                      <EditSelect
                        label="Región"
                        control={control}
                        name="beneficiaryRegion"
                        placeholder="Seleccionar..."
                        clearable
                        items={beneficiaryRegionItems}
                        disabled={!watchedBeneficiaryCountry || beneficiaryLinked}
                        onValueChange={() => {
                          setValue("beneficiaryCity", "");
                          setValue("beneficiaryCommune", "");
                        }}
                      />
                    )}
                    {hasBeneficiaryCities && (
                      <EditSelect
                        label="Ciudad"
                        control={control}
                        name="beneficiaryCity"
                        placeholder="Seleccionar..."
                        clearable
                        items={beneficiaryCityItems}
                        disabled={!watchedBeneficiaryRegion || beneficiaryLinked}
                        onValueChange={() => setValue("beneficiaryCommune", "")}
                      />
                    )}
                    {hasBeneficiaryCommunes && (
                      <EditSelect
                        label="Comuna"
                        control={control}
                        name="beneficiaryCommune"
                        placeholder="Seleccionar..."
                        clearable
                        items={beneficiaryCommuneItems}
                        disabled={!watchedBeneficiaryCity || beneficiaryLinked}
                      />
                    )}
                  </div>
                </div>
              </div>

              {contact && !insured && !contractor && !beneficiary && (
                <div className="app-panel text-center py-6">
                  <p className="text-muted-foreground text-[12px]">
                    Persona de Contacto: {contact.full_name} — {contact.email || contact.phone || "—"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-1">(editable en tab Incidente)</p>
                </div>
              )}
            </div>
          )}

          {/* ═══ TAB: INCIDENTE ═══ */}
          {activeTab === "incidente" && (
            <div className="space-y-2">
              {/* Dirección del Incidente */}
              <div className="app-panel">
                <div className="flex items-center justify-between pb-2">
                  <h3 className="app-section-title text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Dirección del Incidente
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[11px] w-[150px] justify-center ${claimAddressLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                    onClick={toggleClaimAddressLink}
                  >
                    {claimAddressLinked ? "Desligar" : "Copiar"}
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1 pt-2">
                  <EditInput label="Dirección" {...register("claimAddress")} disabled={claimAddressLinked} />
                  <EditSelect
                    label="País"
                    control={control}
                    name="countryId"
                    placeholder="Seleccionar..."
                    clearable
                    items={countryItems}
                    disabled={claimAddressLinked}
                    onValueChange={() => {
                      setValue("regionId", "");
                      setValue("cityId", "");
                      setValue("communeId", "");
                    }}
                  />
                  <EditSelect
                    label="Región"
                    control={control}
                    name="regionId"
                    placeholder="Seleccionar..."
                    clearable
                    items={regionItems}
                    disabled={!watchedCountryId || claimAddressLinked}
                    onValueChange={() => {
                      setValue("cityId", "");
                      setValue("communeId", "");
                    }}
                  />
                  <EditSelect
                    label="Ciudad"
                    control={control}
                    name="cityId"
                    placeholder="Seleccionar..."
                    clearable
                    items={cityItems}
                    disabled={!watchedRegionId || claimAddressLinked}
                    onValueChange={() => setValue("communeId", "")}
                  />
                  <EditSelect
                    label="Comuna"
                    control={control}
                    name="communeId"
                    placeholder="Seleccionar..."
                    clearable
                    items={communeItems}
                    disabled={!watchedCityId || claimAddressLinked}
                  />
                </div>
              </div>

              {/* Persona de Contacto */}
              <div className="app-panel">
                <h3 className="app-section-title">
                  <User className="h-4 w-4" />
                  Persona de Contacto
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1">
                  <EditInput label="Nombre" {...register("contactFirstName")} />
                  <EditInput label="Apellido" {...register("contactLastName")} />
                  <EditInput label="Email" type="email" {...register("contactEmail")} />
                  <EditInput label="Teléfono" {...register("contactPhones")} placeholder="+56 9 1234 5678" />
                </div>
              </div>

              {/* Incidente */}
              <div className="app-panel">
                <h3 className="app-section-title">
                  <FileText className="h-4 w-4" />
                  Incidente
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1">
                  <EditSelect label="Tipo Construcción" control={control} name="constructionTypeId" placeholder="Seleccionar..." clearable items={constructionTypeItems} />
                  <EditSelect label="Destino" control={control} name="destinationHousingId" placeholder="Seleccionar..." clearable items={housingDestItems} />
                  <EditSelect label="Clasif. Daño" control={control} name="damageClassificationId" placeholder="Seleccionar..." clearable items={damageClassItems} />
                  <EditSelect label="Habitabilidad" control={control} name="habitabilityId" placeholder="Seleccionar..." clearable items={habitabilityItems} />
                  <EditSelect
                    label="Calidad del Asegurado"
                    control={control}
                    name="ownerSameAsInsured"
                    placeholder="Seleccionar..."
                    items={[
                      { value: "true", label: "Propietario" },
                      { value: "false", label: "Arrendatario" },
                    ]}
                  />
                </div>
                <div className="mt-3">
                  <EditTextarea label="Resumen del Incidente" {...register("summary")} />
                </div>
              </div>

              {/* Recupero */}
              <div className="app-panel">
                <h3 className="app-section-title">
                  <Briefcase className="h-4 w-4" />
                  Recupero
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-x-4 gap-y-1">
                  <EditCheckbox
                    label="Recupero Legal"
                    checked={watchedRecoveryLegal}
                    onChange={(v) => setValue("recoveryTypeLegal", v)}
                  />
                  <EditCheckbox
                    label="Recupero Material"
                    checked={watchedRecoveryMaterial}
                    onChange={(v) => setValue("recoveryTypeMaterial", v)}
                  />
                </div>
                <div className="mt-3">
                  <EditTextarea label="Comentarios" {...register("recoveryComments")} />
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: ASIGNACIONES ═══ */}
        </div>

        {/* Footer buttons */}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" className="pg-btn-platinum" onClick={() => onCancel(activeTab)}>
            Cancelar
          </Button>
          <Button type="submit" className="pg-btn-platinum" disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </form>

      {/* ═══ MODAL: Crear Póliza ═══ */}
      <Dialog open={openPolicyModal} onOpenChange={setOpenPolicyModal}>
        <DialogContent className="modal-md" showCloseButton>
          <div className="modal-header">
            <DialogTitle className="modal-title flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-[#0095DA] to-[#005BBB] text-white shadow-sm">
                <FileCheck className="h-4 w-4" />
              </div>
              Crear Póliza
            </DialogTitle>
            <DialogDescription className="modal-subtitle">
              Crea una póliza para asociarla al siniestro #{claim.claim_number}
            </DialogDescription>
          </div>

          <div className="modal-body space-y-4">
            {/* Selector de tipo de creación */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPolicyMode("pending")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  policyMode === "pending"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="text-[12px] font-semibold">Pendiente</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Póliza sin número. El siniestro queda detenido hasta asignar el número correcto.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setPolicyMode("generic")}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  policyMode === "generic"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <div className="text-[12px] font-semibold">N° Pendiente</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Póliza genérica para la compañía. Permite cargar cualquier cobertura.
                </div>
              </button>
            </div>

            {/* Campos de la póliza */}
            <div className="grid grid-cols-2 gap-3">
              {policyMode === "generic" && (
                <>
                  <div>
                    <FieldLabel label="N° Póliza" />
                    <Input
                      className="app-input h-7 text-[12px]"
                      value={newPolicy.policy_number}
                      onChange={(e) => setNewPolicy({ ...newPolicy, policy_number: e.target.value })}
                      placeholder="Número de póliza..."
                    />
                  </div>
                  <div>
                    <FieldLabel label="Nombre" />
                    <Input
                      className="app-input h-7 text-[12px]"
                      value={newPolicy.policy_name}
                      onChange={(e) => setNewPolicy({ ...newPolicy, policy_name: e.target.value })}
                      placeholder="Nombre de la póliza..."
                    />
                  </div>
                </>
              )}
              <div>
                <FieldLabel label="Compañía" />
                <select
                  className="app-input h-7 text-[12px] w-full"
                  value={newPolicy.insurance_company_id}
                  onChange={(e) => setNewPolicy({ ...newPolicy, insurance_company_id: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {catalogs.insuranceCompanies?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel label="Línea de Negocio" />
                <select
                  className="app-input h-7 text-[12px] w-full"
                  value={newPolicy.business_line_id}
                  onChange={(e) => setNewPolicy({ ...newPolicy, business_line_id: e.target.value })}
                >
                  <option value="">Seleccionar...</option>
                  {catalogs.businessLines?.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel label="Moneda" />
                <select
                  className="app-input h-7 text-[12px] w-full"
                  value={newPolicy.currency}
                  onChange={(e) => setNewPolicy({ ...newPolicy, currency: e.target.value })}
                >
                  <option value="CLP">CLP</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="UF">UF</option>
                </select>
              </div>
              <div>
                <FieldLabel label="Inicio Vigencia" />
                <DatePicker
                  value={newPolicy.start_date}
                  onChange={(value) => setNewPolicy({ ...newPolicy, start_date: value })}
                  className="w-[130px]"
                />
              </div>
              <div>
                <FieldLabel label="Término Vigencia" />
                <DatePicker
                  value={newPolicy.end_date}
                  onChange={(value) => setNewPolicy({ ...newPolicy, end_date: value })}
                  className="w-[130px]"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <Button type="button" className="pg-btn-platinum" onClick={() => setOpenPolicyModal(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="pg-btn-platinum"
              disabled={createPolicyMut.isPending}
              onClick={() => createPolicyMut.mutate()}
            >
              {createPolicyMut.isPending ? "Creando..." : "Crear"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
