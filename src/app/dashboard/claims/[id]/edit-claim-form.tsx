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
  Save,
  X,
  Shield,
  ChevronDown,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-select";
import { SelectItem } from "@/components/ui/select";
import { updateClaimFields, updateClaimStatus, updateClaimParticipant, createClaimParticipant, findParticipantByRut, type ParticipantMatch } from "@/services/claims";
import { getCountries, getRegions, getCities, getCommunes } from "@/services/catalogs";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import type { Claim, ClaimsParticipant } from "@/types";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────

interface Catalog {
  id: string;
  name: string;
  country_id?: string | null;
  business_line_id?: string | null;
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
    companies: Catalog[];
    countries: Catalog[];
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
  insuredFirstName: string;
  insuredLastName: string;
  insuredRut: string;
  insuredEmail: string;
  insuredPhones: string;
  insuredAddress: string;
  insuredCountry: string;
  insuredRegion: string;
  insuredCity: string;
  insuredCommune: string;

  // Tab Participantes — Contractor
  contractorFirstName: string;
  contractorLastName: string;
  contractorRut: string;
  contractorEmail: string;
  contractorPhones: string;
  contractorAddress: string;
  contractorCountry: string;
  contractorRegion: string;
  contractorCity: string;
  contractorCommune: string;

  // Tab Participantes — Beneficiary
  beneficiaryFirstName: string;
  beneficiaryLastName: string;
  beneficiaryRut: string;
  beneficiaryEmail: string;
  beneficiaryPhones: string;
  beneficiaryAddress: string;
  beneficiaryCountry: string;
  beneficiaryRegion: string;
  beneficiaryCity: string;
  beneficiaryCommune: string;

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
  onValueChange?: () => void;
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
  { id: "participantes", label: "Participantes", icon: Users },
  { id: "incidente", label: "Incidente", icon: MapPin },
];

// ──────────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────────

export default function EditClaimForm({ claim, participants, catalogs, onCancel, onSaved }: EditClaimFormProps) {
  const [activeTab, setActiveTab] = useState("siniestro");
  const queryClient = useQueryClient();
  const { statusCode, codeToId } = useClaimStatuses();
  const currentStatusCode = statusCode(claim.status_id) ?? "created";

  // Linking state

  const [claimAddressLinked, setClaimAddressLinked] = useState(false);
  const [contractorLinked, setContractorLinked] = useState(() => getParticipant(participants, "contractor")?.linked_to_insured ?? false);
  const [beneficiaryLinked, setBeneficiaryLinked] = useState(() => getParticipant(participants, "beneficiary")?.linked_to_insured ?? false);

  // Collapsible panels
  const [expandedPanels, setExpandedPanels] = useState<{ contractor: boolean; beneficiary: boolean }>(() => {
    const hasContractor = !!getParticipant(participants, "contractor")?.full_name;
    const hasBeneficiary = !!getParticipant(participants, "beneficiary")?.full_name;
    return { contractor: hasContractor, beneficiary: !hasContractor && hasBeneficiary };
  });

  // RUT autocomplete suggestion
  const [participantSuggestion, setParticipantSuggestion] = useState<{
    section: "insured" | "contractor" | "beneficiary";
    data: ParticipantMatch | null;
  } | null>(null);

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
      insuredFirstName: insured?.first_name || insured?.full_name || "",
      insuredLastName: insured?.last_name || "",
      insuredRut: insured?.rut || "",
      insuredEmail: insured?.email || "",
      insuredPhones: uniquePhones(insured?.phone, insured?.cell_phone),
      insuredAddress: insured?.address || "",
      insuredCountry: insured?.country || "",
      insuredRegion: insured?.region || "",
      insuredCity: insured?.city || "",
      insuredCommune: insured?.commune || "",

      // Contractor
      contractorFirstName: contractor?.first_name || "",
      contractorLastName: contractor?.last_name || "",
      contractorRut: contractor?.rut || "",
      contractorEmail: contractor?.email || "",
      contractorPhones: uniquePhones(contractor?.phone, contractor?.cell_phone),
      contractorAddress: contractor?.address || "",
      contractorCountry: contractor?.country || "",
      contractorRegion: contractor?.region || "",
      contractorCity: contractor?.city || "",
      contractorCommune: contractor?.commune || "",

      // Beneficiary
      beneficiaryFirstName: beneficiary?.first_name || "",
      beneficiaryLastName: beneficiary?.last_name || "",
      beneficiaryRut: beneficiary?.rut || "",
      beneficiaryEmail: beneficiary?.email || "",
      beneficiaryPhones: uniquePhones(beneficiary?.phone, beneficiary?.cell_phone),
      beneficiaryAddress: beneficiary?.address || "",
      beneficiaryCountry: beneficiary?.country || "",
      beneficiaryRegion: beneficiary?.region || "",
      beneficiaryCity: beneficiary?.city || "",
      beneficiaryCommune: beneficiary?.commune || "",

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

      // Si el claim estaba en "created" y ahora tiene inspector o liquidador → cambiar a "adjustment"
      if (currentStatusCode === "created" && (values.inspectorId || values.adjusterId)) {
        const adjustmentId = codeToId["adjustment"];
        if (adjustmentId) {
          await updateClaimStatus(claim.id, adjustmentId);
        }
      }

      // 2. Actualizar/crear participante insured
      const insuredData = {
        full_name: `${values.insuredFirstName} ${values.insuredLastName}`.trim(),
        first_name: values.insuredFirstName,
        last_name: values.insuredLastName || null,
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
      } else if (values.insuredFirstName) {
        await createClaimParticipant({ claim_id: claim.id, type: "insured", ...insuredData });
      }

      // 3. Actualizar/crear contractor
      const contractorData = {
        full_name: `${values.contractorFirstName} ${values.contractorLastName}`.trim(),
        first_name: values.contractorFirstName,
        last_name: values.contractorLastName || null,
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
        if (values.contractorFirstName) {
          await updateClaimParticipant(contractor.id, contractorData);
        } else {
          // Si no hay nombre, desvincular también
          await updateClaimParticipant(contractor.id, { linked_to_insured: false });
        }
      } else if (values.contractorFirstName) {
        await createClaimParticipant({ claim_id: claim.id, type: "contractor", ...contractorData });
      }

      // 4. Actualizar/crear beneficiary
      const beneficiaryData = {
        full_name: `${values.beneficiaryFirstName} ${values.beneficiaryLastName}`.trim(),
        first_name: values.beneficiaryFirstName,
        last_name: values.beneficiaryLastName || null,
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
        if (values.beneficiaryFirstName) {
          await updateClaimParticipant(beneficiary.id, beneficiaryData);
        } else {
          await updateClaimParticipant(beneficiary.id, { linked_to_insured: false });
        }
      } else if (values.beneficiaryFirstName) {
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
  const userItems = catalogs.users.map((u) => ({ value: u.id, label: u.full_name || u.email || "—" }));

  // ──────────────────────────────────────────────────────────────
  // Watched values
  // ──────────────────────────────────────────────────────────────
  // Incidente geo (FK-based, usa IDs)
  const watchedCountryId = watch("countryId");
  const watchedRegionId = watch("regionId");
  const watchedCityId = watch("cityId");

  // Participantes geo (text-based, usa nombres)
  const watchedInsuredCountry = useWatch({ control, name: "insuredCountry" });
  const watchedInsuredRegion = useWatch({ control, name: "insuredRegion" });
  const watchedInsuredCity = useWatch({ control, name: "insuredCity" });
  const watchedInsuredRut = useWatch({ control, name: "insuredRut" });

  const watchedContractorCountry = useWatch({ control, name: "contractorCountry" });
  const watchedContractorRegion = useWatch({ control, name: "contractorRegion" });
  const watchedContractorCity = useWatch({ control, name: "contractorCity" });
  const watchedContractorRut = useWatch({ control, name: "contractorRut" });

  const watchedBeneficiaryCountry = useWatch({ control, name: "beneficiaryCountry" });
  const watchedBeneficiaryRegion = useWatch({ control, name: "beneficiaryRegion" });
  const watchedBeneficiaryCity = useWatch({ control, name: "beneficiaryCity" });
  const watchedBeneficiaryRut = useWatch({ control, name: "beneficiaryRut" });

  // Cascading Tipo → Línea → Producto
  const watchedBusinessLineId = watch("businessLineId");

  // Recovery checkboxes
  const watchedRecoveryLegal = watch("recoveryTypeLegal");
  const watchedRecoveryMaterial = watch("recoveryTypeMaterial");
  const watchedOwnerSame = watch("ownerSameAsInsured");

  // ──────────────────────────────────────────────────────────────
  // Geo queries — Incidente (FK-based)
  // ──────────────────────────────────────────────────────────────
  const { data: countriesList } = useQuery({
    queryKey: ["countries"],
    queryFn: () => getCountries(),
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedCountryId]);

  // ──────────────────────────────────────────────────────────────
  // Autocomplete por RUT
  // ──────────────────────────────────────────────────────────────

  // Asegurado
  useEffect(() => {
    if (!watchedInsuredRut || watchedInsuredRut.trim().length < 3 || !watchedInsuredCountry) {
      setParticipantSuggestion((prev) => prev?.section === "insured" ? null : prev);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const found = await findParticipantByRut(watchedInsuredRut.trim(), watchedInsuredCountry);
        if (!cancelled) {
          if (found && (found.first_name || found.full_name)) {
            setParticipantSuggestion({ section: "insured", data: found });
          } else {
            setParticipantSuggestion((prev) => prev?.section === "insured" ? null : prev);
          }
        }
      } catch {
        if (!cancelled) setParticipantSuggestion((prev) => prev?.section === "insured" ? null : prev);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
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
        const found = await findParticipantByRut(watchedContractorRut.trim(), watchedContractorCountry);
        if (!cancelled) {
          if (found && (found.first_name || found.full_name)) {
            setParticipantSuggestion({ section: "contractor", data: found });
          } else {
            setParticipantSuggestion((prev) => prev?.section === "contractor" ? null : prev);
          }
        }
      } catch {
        if (!cancelled) setParticipantSuggestion((prev) => prev?.section === "contractor" ? null : prev);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
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
        const found = await findParticipantByRut(watchedBeneficiaryRut.trim(), watchedBeneficiaryCountry);
        if (!cancelled) {
          if (found && (found.first_name || found.full_name)) {
            setParticipantSuggestion({ section: "beneficiary", data: found });
          } else {
            setParticipantSuggestion((prev) => prev?.section === "beneficiary" ? null : prev);
          }
        }
      } catch {
        if (!cancelled) setParticipantSuggestion((prev) => prev?.section === "beneficiary" ? null : prev);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [watchedBeneficiaryRut, watchedBeneficiaryCountry]);

  // ──────────────────────────────────────────────────────────────
  // Copy from insured (one-time copy, fields remain editable)
  // ──────────────────────────────────────────────────────────────
  const toggleContractorLink = () => {
    if (!contractorLinked) {
      setValue("contractorFirstName", form.getValues("insuredFirstName") || "");
      setValue("contractorLastName", form.getValues("insuredLastName") || "");
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
      setValue("beneficiaryFirstName", form.getValues("insuredFirstName") || "");
      setValue("beneficiaryLastName", form.getValues("insuredLastName") || "");
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
      setValue("claimAddress", form.getValues("insuredAddress") || "");
      // Nota: el incidente usa FKs (countryId, regionId, etc.) pero el asegurado usa nombres.
      // Solo copiamos la dirección de texto. El usuario debe seleccionar los FKs manualmente.
      setClaimAddressLinked(true);
    } else {
      setClaimAddressLinked(false);
    }
  };

  // ──────────────────────────────────────────────────────────────
  // Apply RUT suggestion
  // ──────────────────────────────────────────────────────────────
  const applySuggestion = (section: "insured" | "contractor" | "beneficiary") => {
    if (!participantSuggestion) return;
    const d = participantSuggestion.data;
    if (!d) return;
    if (section === "insured") {
      setValue("insuredFirstName", d.first_name || "");
      setValue("insuredLastName", d.last_name || "");
      setValue("insuredEmail", d.email || "");
      setValue("insuredPhones", uniquePhones(d.phone, d.cell_phone));
      setValue("insuredAddress", d.address || "");
      setValue("insuredCountry", d.country || "");
      setValue("insuredRegion", d.region || "");
      setValue("insuredCity", d.city || "");
      setValue("insuredCommune", d.commune || "");
    } else if (section === "contractor") {
      setValue("contractorFirstName", d.first_name || "");
      setValue("contractorLastName", d.last_name || "");
      setValue("contractorEmail", d.email || "");
      setValue("contractorPhones", uniquePhones(d.phone, d.cell_phone));
      setValue("contractorAddress", d.address || "");
      setValue("contractorCountry", d.country || "");
      setValue("contractorRegion", d.region || "");
      setValue("contractorCity", d.city || "");
      setValue("contractorCommune", d.commune || "");
    } else if (section === "beneficiary") {
      setValue("beneficiaryFirstName", d.first_name || "");
      setValue("beneficiaryLastName", d.last_name || "");
      setValue("beneficiaryEmail", d.email || "");
      setValue("beneficiaryPhones", uniquePhones(d.phone, d.cell_phone));
      setValue("beneficiaryAddress", d.address || "");
      setValue("beneficiaryCountry", d.country || "");
      setValue("beneficiaryRegion", d.region || "");
      setValue("beneficiaryCity", d.city || "");
      setValue("beneficiaryCommune", d.commune || "");
    }
    setParticipantSuggestion(null);
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

      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} className="flex flex-col gap-2">
        {/* Tab content */}
        <div className="min-h-[300px]">
          {/* ═══ TAB: SINIESTRO ═══ */}
          {activeTab === "siniestro" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <div className="lg:col-span-2 space-y-2">
                <div className="app-panel">
                  <h3 className="app-section-title">
                    <FileText className="h-4 w-4" />
                    Datos del Siniestro
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                    <EditSelect label="País del Siniestro" control={control} name="countryId" placeholder="Seleccionar..." clearable items={countryIdItems} />
                    <EditSelect label="Empresa (Cliente)" required control={control} name="companyId" placeholder="Seleccionar..." items={companyItems} />
                    <EditSelect label="Compañía de Seguros" control={control} name="insuranceCompanyId" placeholder="Seleccionar..." clearable items={insuranceCompanyItems} />
                    <EditInput label="N° Ref. Cliente" {...register("clientReference")} />
                    <EditInput label="N° Siniestro (Cía)" required {...register("claimNumber")} />
                    <EditInput label="Fecha Siniestro" required type="date" {...register("claimDate")} />
                    <EditInput label="Fecha Denuncio" type="date" {...register("reportDate")} />
                    <EditInput label="Fecha Asignación" type="date" {...register("assignmentDate")} />
                  </div>
                </div>

                <div className="app-panel">
                  <h3 className="app-section-title">
                    <Shield className="h-4 w-4" />
                    Clasificación
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
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
                    <Briefcase className="h-4 w-4" />
                    Asignación
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
                    <EditSelect label="Inspector" control={control} name="inspectorId" placeholder="Sin asignar" clearable items={userItems} />
                    <EditSelect label="Ajustador / Liquidador" control={control} name="adjusterId" placeholder="Sin asignar" clearable items={userItems} />
                    <EditSelect label="Auditor" control={control} name="auditorId" placeholder="Sin asignar" clearable items={userItems} />
                    <EditSelect label="Despachador" control={control} name="dispatcherId" placeholder="Sin asignar" clearable items={userItems} />
                    <EditSelect label="Asistente" control={control} name="assistantId" placeholder="Sin asignar" clearable items={userItems} />
                    <EditSelect label="Asesor" control={control} name="advisorId" placeholder="Sin asignar" clearable items={advisorItems} />
                  </div>
                </div>

                <div className="app-panel">
                  <EditTextarea label="Resumen" {...register("summary")} />
                </div>
              </div>

              {/* Columna derecha: Datos de la Póliza */}
              <div className="space-y-2">
                <div className="app-panel">
                  <h3 className="app-section-title">
                    <Shield className="h-4 w-4" />
                    Datos de la Póliza
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <EditInput label="N° Póliza" required {...register("policyNumber")} />
                      <EditInput label="Item Póliza" {...register("policyItem")} />
                    </div>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                      <EditSelect label="Moneda" control={control} name="currencyId" placeholder="Seleccionar..." clearable items={currencyItems} />
                      <EditInput label="Monto Asegurado" type="number" step="0.01" {...register("policyAmount")} />
                      <EditInput label="Prima" type="number" step="0.01" {...register("policyPremium")} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <EditInput label="Inicio Vigencia" type="date" {...register("policyStartDate")} />
                      <EditInput label="Término Vigencia" type="date" {...register("policyEndDate")} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: ASEGURADO ═══ */}
          {/* ═══ TAB: PARTICIPANTES ═══ */}
          {activeTab === "participantes" && (
            <div className="space-y-2">
              {/* Asegurado (no colapsable) */}
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="w-full flex items-center p-3">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Asegurado
                  </span>
                </div>
                <div className="px-3 pb-3 space-y-3">
                  {participantSuggestion?.section === "insured" && participantSuggestion.data && (
                    <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
                      <div className="text-[11px] text-sky-800">
                        <span className="font-semibold">Persona encontrada:</span>{" "}
                        {participantSuggestion.data.first_name} {participantSuggestion.data.last_name}
                        {participantSuggestion.data.address && (
                          <span className="text-sky-600"> — {participantSuggestion.data.address}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline shrink-0"
                        onClick={() => applySuggestion("insured")}
                      >
                        Usar datos
                      </button>
                    </div>
                  )}
                  <div className="app-data-grid-4">
                    <EditInput label="Nombre" required {...register("insuredFirstName")} />
                    <EditInput label="Apellido" {...register("insuredLastName")} />
                    <EditInput label="RUT" {...register("insuredRut")} />
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

              {/* Contractor (colapsable) */}
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1"
                    onClick={() => setExpandedPanels((p) => ({ contractor: !p.contractor, beneficiary: false }))}
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground">Contratante</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPanels.contractor ? "rotate-180" : ""}`} />
                  </button>
                  {expandedPanels.contractor && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`h-6 text-[11px] w-[150px] justify-center ${contractorLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                      onClick={toggleContractorLink}
                    >
                      {contractorLinked ? "Desligar Asegurado" : "Copiar de Asegurado"}
                    </Button>
                  )}
                </div>
                {expandedPanels.contractor && (
                  <div className="px-3 pb-3 space-y-3">
                    {participantSuggestion?.section === "contractor" && !contractorLinked && participantSuggestion.data && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
                        <div className="text-[11px] text-sky-800">
                          <span className="font-semibold">Persona encontrada:</span>{" "}
                          {participantSuggestion.data.first_name} {participantSuggestion.data.last_name}
                          {participantSuggestion.data.address && (
                            <span className="text-sky-600"> — {participantSuggestion.data.address}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline shrink-0"
                          onClick={() => applySuggestion("contractor")}
                        >
                          Usar datos
                        </button>
                      </div>
                    )}
                    <div className="app-data-grid-4">
                      <EditInput label="Nombre" {...register("contractorFirstName")} disabled={contractorLinked} />
                      <EditInput label="Apellido" {...register("contractorLastName")} disabled={contractorLinked} />
                      <EditInput label="RUT" {...register("contractorRut")} disabled={contractorLinked} />
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
                )}
              </div>

              {/* Beneficiary (colapsable) */}
              <div className="rounded-lg border border-border/50 overflow-hidden">
                <div className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1"
                    onClick={() => setExpandedPanels((p) => ({ contractor: false, beneficiary: !p.beneficiary }))}
                  >
                    <span className="text-[11px] font-semibold text-muted-foreground">Beneficiario</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedPanels.beneficiary ? "rotate-180" : ""}`} />
                  </button>
                  {expandedPanels.beneficiary && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={`h-6 text-[11px] w-[150px] justify-center ${beneficiaryLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                      onClick={toggleBeneficiaryLink}
                    >
                      {beneficiaryLinked ? "Desligar Asegurado" : "Copiar de Asegurado"}
                    </Button>
                  )}
                </div>
                {expandedPanels.beneficiary && (
                  <div className="px-3 pb-3 space-y-3">
                    {participantSuggestion?.section === "beneficiary" && !beneficiaryLinked && participantSuggestion.data && (
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-2">
                        <div className="text-[11px] text-sky-800">
                          <span className="font-semibold">Persona encontrada:</span>{" "}
                          {participantSuggestion.data.first_name} {participantSuggestion.data.last_name}
                          {participantSuggestion.data.address && (
                            <span className="text-sky-600"> — {participantSuggestion.data.address}</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="text-[11px] font-semibold text-sky-700 hover:text-sky-900 underline shrink-0"
                          onClick={() => applySuggestion("beneficiary")}
                        >
                          Usar datos
                        </button>
                      </div>
                    )}
                    <div className="app-data-grid-4">
                      <EditInput label="Nombre" {...register("beneficiaryFirstName")} disabled={beneficiaryLinked} />
                      <EditInput label="Apellido" {...register("beneficiaryLastName")} disabled={beneficiaryLinked} />
                      <EditInput label="RUT" {...register("beneficiaryRut")} disabled={beneficiaryLinked} />
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
                )}
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <div className="app-panel">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[11px] font-semibold text-muted-foreground flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Ubicación del Incidente
                  </h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-6 text-[11px] w-[150px] justify-center ${claimAddressLinked ? "bg-emerald-200/80 text-emerald-800 border-emerald-300 hover:bg-emerald-200" : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                    onClick={toggleClaimAddressLink}
                  >
                    {claimAddressLinked ? "Desligar Asegurado" : "Copiar de Asegurado"}
                  </Button>
                </div>
                <div className="space-y-3">
                  <EditInput label="Dirección" {...register("claimAddress")} disabled={claimAddressLinked} />
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
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
              </div>
              <div className="space-y-2">
                <div className="app-panel">
                  <h3 className="app-section-title">Tipo de Siniestro</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <EditSelect label="Tipo Construcción" control={control} name="constructionTypeId" placeholder="Seleccionar..." clearable items={constructionTypeItems} />
                    <EditSelect label="Destino" control={control} name="destinationHousingId" placeholder="Seleccionar..." clearable items={housingDestItems} />
                    <EditSelect label="Clasif. Daño" control={control} name="damageClassificationId" placeholder="Seleccionar..." clearable items={damageClassItems} />
                    <EditSelect label="Habitabilidad" control={control} name="habitabilityId" placeholder="Seleccionar..." clearable items={habitabilityItems} />
                  </div>
                  <div className="mt-3">
                    <EditCheckbox
                      label="Dueño = Asegurado"
                      checked={watchedOwnerSame}
                      onChange={(v) => setValue("ownerSameAsInsured", v)}
                    />
                  </div>
                </div>
                <div className="app-panel">
                  <EditTextarea label="Resumen del Incidente" {...register("summary")} />
                </div>
                <div className="app-panel">
                  <h3 className="app-section-title">
                    Recupero
                  </h3>
                  <div className="space-y-3">
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
                    <EditTextarea label="Comentarios" {...register("recoveryComments")} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ TAB: ASIGNACIONES ═══ */}
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
