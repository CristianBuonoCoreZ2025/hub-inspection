"use client";

import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClaimMinimal,
  cleanStaging, insertStagingRows, getStagingRows, markStagingError, markStagingImported, markStagingValid,
  type ClaimStagingRow,
} from "@/services/claims";
import {
  getInsuranceCompanies, getClaimTypes, getClaimCauses, getBusinessLines,
  getCurrencies, getHousingDestinations, getDamageClassifications, getLookupCatalog,
  getInsuranceProducts, getEvents,
  getBrokers, getAdvisors, getPropertyClassifications,
  getCountries, getRegions, getCities, getCommunes,
} from "@/services/catalogs";
import { useAuth } from "@/hooks/use-auth";
import { getUsers } from "@/services/users";
import { getPolicies } from "@/services/policies";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2, ArrowRight, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import * as XLSX from "xlsx";
import {
  getImportFieldMappings,
  getImportValueMappings,
  saveImportFieldMappingsBatch,
  saveImportValueMappingsBatch,
} from "@/services/import-mappings";
import {
  CLAIM_FIELDS,
  REQUIRED_FIELDS,
  autoDetectMapping,
  applyMappingToRow,
  validateRowWithMapping,
  parseDate,
  type ColumnMapping,
  type ParsedRow,
  type RowError,
} from "@/lib/claim-import/schema";

interface ExcelRow {
  [key: string]: string | number | null;
}

type Step = "upload" | "review" | "staging" | "done";

export default function CargaSiniestrosPage() {
  const { canCreate } = usePermissions();
  const { profile } = useAuth();
  const tenantCompanyId = profile?.company_id || null;
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, error: 0 });
  const [isUploading, setIsUploading] = useState(false);

  // Estado del flujo de importación
  const [step, setStep] = useState<Step>("upload");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ExcelRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, ColumnMapping>>({});
  const [mapperOpen, setMapperOpen] = useState(true);
  // Mapeo manual de valores: "fieldKey::excelValue" → UUID del catálogo
  const [valueMappings, setValueMappings] = useState<Record<string, string>>({});
  // Valores fijos: fieldKey → valor en duro (no viene del Excel)
  const [fixedValues, setFixedValues] = useState<Record<string, string>>({});

  // Staging (carga temporal)
  const [stagingRows, setStagingRows] = useState<ClaimStagingRow[]>([]);
  const [confirmProgress, setConfirmProgress] = useState({ current: 0, total: 0, success: 0, error: 0 });
  const [isConfirming, setIsConfirming] = useState(false);

  // ── Cargar catálogos de referencia para resolver texto → UUID ──
  const { data: insuranceCompanies } = useQuery({
    queryKey: ["insurance-companies"],
    queryFn: getInsuranceCompanies,
    staleTime: 5 * 60 * 1000,
  });
  const { data: claimTypes } = useQuery({
    queryKey: ["claim-types"],
    queryFn: getClaimTypes,
    staleTime: 5 * 60 * 1000,
  });
  const { data: claimCauses } = useQuery({
    queryKey: ["claim-causes"],
    queryFn: getClaimCauses,
    staleTime: 5 * 60 * 1000,
  });
  const { data: businessLines } = useQuery({
    queryKey: ["business-lines"],
    queryFn: getBusinessLines,
    staleTime: 5 * 60 * 1000,
  });
  const { data: currencies } = useQuery({
    queryKey: ["currencies"],
    queryFn: getCurrencies,
    staleTime: 5 * 60 * 1000,
  });
  const { data: housingDestinations } = useQuery({
    queryKey: ["housing-destinations"],
    queryFn: getHousingDestinations,
    staleTime: 5 * 60 * 1000,
  });
  const { data: damageClassifications } = useQuery({
    queryKey: ["damage-classifications"],
    queryFn: getDamageClassifications,
    staleTime: 5 * 60 * 1000,
  });
  const { data: claimStatuses } = useQuery({
    queryKey: ["lookup-catalog", "claim_status"],
    queryFn: () => getLookupCatalog("claim_status"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: insuranceProducts } = useQuery({
    queryKey: ["insurance-products"],
    queryFn: getInsuranceProducts,
    staleTime: 5 * 60 * 1000,
  });
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: getEvents,
    staleTime: 5 * 60 * 1000,
  });
  // ── Catálogos adicionales para campos de referencia nuevos ──
  const { data: brokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: getBrokers,
    staleTime: 5 * 60 * 1000,
  });
  const { data: advisors } = useQuery({
    queryKey: ["advisors"],
    queryFn: getAdvisors,
    staleTime: 5 * 60 * 1000,
  });
  const { data: propertyClassifications } = useQuery({
    queryKey: ["property-classifications"],
    queryFn: getPropertyClassifications,
    staleTime: 5 * 60 * 1000,
  });
  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: getCountries,
    staleTime: 5 * 60 * 1000,
  });
  const { data: regions } = useQuery({
    queryKey: ["regions-all"],
    queryFn: () => getRegions(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: cities } = useQuery({
    queryKey: ["cities-all"],
    queryFn: () => getCities(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: communes } = useQuery({
    queryKey: ["communes-all"],
    queryFn: () => getCommunes(),
    staleTime: 5 * 60 * 1000,
  });
  const { data: companyProfiles } = useQuery({
    queryKey: ["company-profiles", tenantCompanyId],
    queryFn: () => getUsers(tenantCompanyId || undefined),
    enabled: !!tenantCompanyId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: companyPolicies } = useQuery({
    queryKey: ["company-policies", tenantCompanyId],
    queryFn: () => getPolicies({ companyId: tenantCompanyId || undefined }),
    enabled: !!tenantCompanyId,
    staleTime: 5 * 60 * 1000,
  });
  // ── Mappings aprendidos (campo + valor) ──
  const { data: learnedFieldMappings } = useQuery({
    queryKey: ["import-field-mappings", tenantCompanyId],
    queryFn: () => getImportFieldMappings(tenantCompanyId!),
    enabled: !!tenantCompanyId,
    staleTime: 60 * 1000, // 1 min — se recarga tras guardar
  });
  const { data: learnedValueMappings } = useQuery({
    queryKey: ["import-value-mappings", tenantCompanyId],
    queryFn: () => getImportValueMappings(tenantCompanyId!),
    enabled: !!tenantCompanyId,
    staleTime: 60 * 1000,
  });

  // Normalización simple: lowercase + sin acentos + sin espacios extra
  const normalizeName = useCallback((s: string): string => {
    return s
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  // Mapas nombre (normalizado) → UUID
  const buildMap = useCallback((items: { id: string; name: string }[] | undefined) => {
    const map = new Map<string, string>();
    for (const c of items ?? []) map.set(normalizeName(c.name), c.id);
    return map;
  }, [normalizeName]);

  const insuranceCompanyMap = useMemo(() => buildMap(insuranceCompanies), [buildMap, insuranceCompanies]);
  const claimTypeMap = useMemo(() => buildMap(claimTypes), [buildMap, claimTypes]);
  const claimCauseMap = useMemo(() => buildMap(claimCauses), [buildMap, claimCauses]);
  const businessLineMap = useMemo(() => buildMap(businessLines), [buildMap, businessLines]);
  const currencyMap = useMemo(() => buildMap(currencies), [buildMap, currencies]);
  const housingDestinationMap = useMemo(() => buildMap(housingDestinations), [buildMap, housingDestinations]);
  const damageClassificationMap = useMemo(() => buildMap(damageClassifications), [buildMap, damageClassifications]);
  const claimStatusMap = useMemo(() => buildMap(claimStatuses), [buildMap, claimStatuses]);
  const insuranceProductMap = useMemo(() => buildMap(insuranceProducts), [buildMap, insuranceProducts]);
  const eventMap = useMemo(() => buildMap(events), [buildMap, events]);
  // ── Mapas nuevos ──
  const brokerMap = useMemo(() => buildMap(brokers), [buildMap, brokers]);
  const advisorMap = useMemo(() => buildMap(advisors), [buildMap, advisors]);
  const propertyClassificationMap = useMemo(() => buildMap(propertyClassifications), [buildMap, propertyClassifications]);
  const countryMap = useMemo(() => buildMap(countries), [buildMap, countries]);
  const regionMap = useMemo(() => buildMap(regions), [buildMap, regions]);
  const cityMap = useMemo(() => buildMap(cities), [buildMap, cities]);
  const communeMap = useMemo(() => buildMap(communes), [buildMap, communes]);
  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of companyProfiles ?? []) map.set(normalizeName(p.full_name || ""), p.id);
    return map;
  }, [companyProfiles, normalizeName]);
  const policyMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of companyPolicies ?? []) {
      if (p.policy_number) map.set(normalizeName(p.policy_number), p.id);
    }
    return map;
  }, [companyPolicies, normalizeName]);

  // ── Resolver texto → UUID para campos de referencia ──
  // Orden: 1) UUID directo, 2) mapeo manual del usuario, 3) mapeo aprendido, 4) match exacto normalizado
  const learnedValueMap = useMemo(() => {
    const map = new Map<string, string>(); // "fieldKey::normalizedValue" → catalog_uuid
    for (const m of learnedValueMappings ?? []) {
      map.set(`${m.field_key}::${normalizeName(m.excel_value)}`, m.catalog_uuid);
    }
    return map;
  }, [learnedValueMappings, normalizeName]);

  const resolveRefId = useCallback(
    (fieldKey: string, value: string, catalogMap: Map<string, string>): string | null => {
      if (!value) return null;
      const trimmed = value.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        return trimmed;
      }
      const manualKey = `${fieldKey}::${trimmed}`;
      if (valueMappings[manualKey]) return valueMappings[manualKey];
      // 3) Mapeo aprendido de la empresa
      const learnedKey = `${fieldKey}::${normalizeName(trimmed)}`;
      const learned = learnedValueMap.get(learnedKey);
      if (learned) return learned;
      // 4) Match exacto normalizado en el catálogo
      return catalogMap.get(normalizeName(trimmed)) || null;
    },
    [valueMappings, learnedValueMap, normalizeName]
  );

  const resolveInsuranceCompanyId = useCallback(
    (value: string) => resolveRefId("insuranceCompany", value, insuranceCompanyMap),
    [resolveRefId, insuranceCompanyMap]
  );
  const resolveClaimTypeId = useCallback(
    (value: string) => resolveRefId("claimType", value, claimTypeMap),
    [resolveRefId, claimTypeMap]
  );
  const resolveClaimCauseId = useCallback(
    (value: string) => resolveRefId("claimCause", value, claimCauseMap),
    [resolveRefId, claimCauseMap]
  );
  const resolveBusinessLineId = useCallback(
    (value: string) => resolveRefId("businessLine", value, businessLineMap),
    [resolveRefId, businessLineMap]
  );
  const resolveCurrencyId = useCallback(
    (value: string) => resolveRefId("currency", value, currencyMap),
    [resolveRefId, currencyMap]
  );
  const resolveDestinationHousingId = useCallback(
    (value: string) => resolveRefId("destination", value, housingDestinationMap),
    [resolveRefId, housingDestinationMap]
  );
  const resolveDamageClassificationId = useCallback(
    (value: string) => resolveRefId("damageClassification", value, damageClassificationMap),
    [resolveRefId, damageClassificationMap]
  );
  const resolveStatusId = useCallback(
    (value: string) => resolveRefId("status", value, claimStatusMap),
    [resolveRefId, claimStatusMap]
  );
  const resolveInsuranceProductId = useCallback(
    (value: string) => resolveRefId("insuranceProduct", value, insuranceProductMap),
    [resolveRefId, insuranceProductMap]
  );
  const resolveEventId = useCallback(
    (value: string) => resolveRefId("event", value, eventMap),
    [resolveRefId, eventMap]
  );
  // ── Resolvers nuevos ──
  const resolveBrokerId = useCallback(
    (value: string) => resolveRefId("broker", value, brokerMap),
    [resolveRefId, brokerMap]
  );
  const resolveAdvisorId = useCallback(
    (value: string) => resolveRefId("advisor", value, advisorMap),
    [resolveRefId, advisorMap]
  );
  const resolvePropertyClassificationId = useCallback(
    (value: string) => resolveRefId("propertyClassification", value, propertyClassificationMap),
    [resolveRefId, propertyClassificationMap]
  );
  const resolveCountryId = useCallback(
    (value: string) => resolveRefId("claimCountryRef", value, countryMap),
    [resolveRefId, countryMap]
  );
  const resolveRegionId = useCallback(
    (value: string) => resolveRefId("claimRegionRef", value, regionMap),
    [resolveRefId, regionMap]
  );
  const resolveCityId = useCallback(
    (value: string) => resolveRefId("claimCityRef", value, cityMap),
    [resolveRefId, cityMap]
  );
  const resolveCommuneId = useCallback(
    (value: string) => resolveRefId("claimCommuneRef", value, communeMap),
    [resolveRefId, communeMap]
  );
  const resolveInspectorId = useCallback(
    (value: string) => resolveRefId("inspector", value, profileMap),
    [resolveRefId, profileMap]
  );
  const resolveAdjusterId = useCallback(
    (value: string) => resolveRefId("adjuster", value, profileMap),
    [resolveRefId, profileMap]
  );
  const resolveAuditorId = useCallback(
    (value: string) => resolveRefId("auditor", value, profileMap),
    [resolveRefId, profileMap]
  );
  const resolveDispatcherId = useCallback(
    (value: string) => resolveRefId("dispatcher", value, profileMap),
    [resolveRefId, profileMap]
  );
  const resolveAssistantId = useCallback(
    (value: string) => resolveRefId("assistant", value, profileMap),
    [resolveRefId, profileMap]
  );
  const resolvePolicyId = useCallback(
    (value: string) => resolveRefId("policyRef", value, policyMap),
    [resolveRefId, policyMap]
  );

  // ── Configuración de campos de referencia (para UI y validación) ──
  const refFields = useMemo(() => [
    { fieldKey: "insuranceCompany", label: "Aseguradora", dataKey: "insuranceCompany" as const, resolver: resolveInsuranceCompanyId, options: insuranceCompanies ?? [] },
    { fieldKey: "claimType", label: "Tipo de Siniestro", dataKey: "claimType" as const, resolver: resolveClaimTypeId, options: claimTypes ?? [] },
    { fieldKey: "claimCause", label: "Causal Siniestro", dataKey: "claimCause" as const, resolver: resolveClaimCauseId, options: claimCauses ?? [] },
    { fieldKey: "status", label: "Estatus", dataKey: "status" as const, resolver: resolveStatusId, options: claimStatuses ?? [] },
    { fieldKey: "businessLine", label: "Línea Negocio", dataKey: "businessLine" as const, resolver: resolveBusinessLineId, options: businessLines ?? [] },
    { fieldKey: "currency", label: "Moneda Póliza", dataKey: "currency" as const, resolver: resolveCurrencyId, options: currencies ?? [] },
    { fieldKey: "destination", label: "Destino", dataKey: "destination" as const, resolver: resolveDestinationHousingId, options: housingDestinations ?? [] },
    { fieldKey: "damageClassification", label: "Clasif. Daño", dataKey: "damageClassification" as const, resolver: resolveDamageClassificationId, options: damageClassifications ?? [] },
    { fieldKey: "insuranceProduct", label: "Ramo/Producto", dataKey: "insuranceProduct" as const, resolver: resolveInsuranceProductId, options: insuranceProducts ?? [] },
    { fieldKey: "event", label: "Evento", dataKey: "event" as const, resolver: resolveEventId, options: events ?? [] },
    // ── Campos de referencia nuevos ──
    { fieldKey: "broker", label: "Corredor", dataKey: "broker" as const, resolver: resolveBrokerId, options: brokers ?? [] },
    { fieldKey: "advisor", label: "Asesor", dataKey: "advisor" as const, resolver: resolveAdvisorId, options: advisors ?? [] },
    { fieldKey: "propertyClassification", label: "Clasificación Propiedad", dataKey: "propertyClassification" as const, resolver: resolvePropertyClassificationId, options: propertyClassifications ?? [] },
    { fieldKey: "claimCountryRef", label: "País Siniestro (catálogo)", dataKey: "claimCountryRef" as const, resolver: resolveCountryId, options: countries ?? [] },
    { fieldKey: "claimRegionRef", label: "Región Siniestro (catálogo)", dataKey: "claimRegionRef" as const, resolver: resolveRegionId, options: regions ?? [] },
    { fieldKey: "claimCityRef", label: "Ciudad Siniestro (catálogo)", dataKey: "claimCityRef" as const, resolver: resolveCityId, options: cities ?? [] },
    { fieldKey: "claimCommuneRef", label: "Comuna Siniestro (catálogo)", dataKey: "claimCommuneRef" as const, resolver: resolveCommuneId, options: communes ?? [] },
    { fieldKey: "inspector", label: "Inspector", dataKey: "inspector" as const, resolver: resolveInspectorId, options: (companyProfiles ?? []).map(p => ({ id: p.id, name: p.full_name || "" })) },
    { fieldKey: "adjuster", label: "Liquidador/Ajustador", dataKey: "adjuster" as const, resolver: resolveAdjusterId, options: (companyProfiles ?? []).map(p => ({ id: p.id, name: p.full_name || "" })) },
    { fieldKey: "auditor", label: "Auditor", dataKey: "auditor" as const, resolver: resolveAuditorId, options: (companyProfiles ?? []).map(p => ({ id: p.id, name: p.full_name || "" })) },
    { fieldKey: "dispatcher", label: "Despachador", dataKey: "dispatcher" as const, resolver: resolveDispatcherId, options: (companyProfiles ?? []).map(p => ({ id: p.id, name: p.full_name || "" })) },
    { fieldKey: "assistant", label: "Asistente", dataKey: "assistant" as const, resolver: resolveAssistantId, options: (companyProfiles ?? []).map(p => ({ id: p.id, name: p.full_name || "" })) },
    { fieldKey: "policyRef", label: "Póliza (referencia)", dataKey: "policyRef" as const, resolver: resolvePolicyId, options: (companyPolicies ?? []).map(p => ({ id: p.id, name: p.policy_number || "" })) },
  ], [
    resolveInsuranceCompanyId, resolveClaimTypeId, resolveClaimCauseId, resolveStatusId,
    resolveBusinessLineId, resolveCurrencyId, resolveDestinationHousingId, resolveDamageClassificationId,
    resolveInsuranceProductId, resolveEventId,
    resolveBrokerId, resolveAdvisorId, resolvePropertyClassificationId,
    resolveCountryId, resolveRegionId, resolveCityId, resolveCommuneId,
    resolveInspectorId, resolveAdjusterId, resolveAuditorId, resolveDispatcherId, resolveAssistantId, resolvePolicyId,
    insuranceCompanies, claimTypes, claimCauses, claimStatuses, businessLines, currencies,
    housingDestinations, damageClassifications, insuranceProducts, events,
    brokers, advisors, propertyClassifications, countries, regions, cities, communes,
    companyProfiles, companyPolicies,
  ]);

  // ── Valores distinct del Excel por campo de referencia ──
  const distinctRefValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const ref of refFields) {
      const values = new Set<string>();
      for (const row of rawRows) {
        const data = applyMappingToRow(row, mapping);
        const v = String(data[ref.dataKey] || "").trim();
        if (v) values.add(v);
      }
      result[ref.fieldKey] = [...values].sort();
    }
    return result;
  }, [rawRows, mapping, refFields]);

  // ── Valores sin resolver por campo (que necesitan mapeo manual) ──
  const unmappedRefValues = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const ref of refFields) {
      result[ref.fieldKey] = (distinctRefValues[ref.fieldKey] || []).filter(
        (v) => !ref.resolver(v)
      );
    }
    return result;
  }, [distinctRefValues, refFields]);

  const totalUnmappedCount = useMemo(() => {
    return Object.values(unmappedRefValues).reduce((sum, arr) => sum + arr.length, 0);
  }, [unmappedRefValues]);

  // ── Parsed rows: estado derivado de mapping + rawRows + valueMappings + fixedValues ──
  const parsedRows = useMemo<ParsedRow[]>(() => {
    if (rawRows.length === 0) return [];
    return rawRows.map((raw, idx) => {
      const data = applyMappingToRow(raw, mapping);
      // Inyectar valores fijos SOLO si el campo no viene del Excel (no tiene valor)
      // Si el Excel ya trae un valor para ese campo, el valor fijo NO se aplica
      for (const [fieldKey, value] of Object.entries(fixedValues)) {
        if (!value) continue;
        const currentValue = data[fieldKey];
        if (currentValue === undefined || currentValue === null || currentValue === "") {
          data[fieldKey] = value;
        }
      }
      const { valid, errors } = validateRowWithMapping(data, mapping);

      // Validación: resolver cada campo de referencia → UUID
      for (const ref of refFields) {
        const value = String(data[ref.dataKey] || "").trim();
        if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          const resolved = ref.resolver(value);
          if (!resolved) {
            errors.push({
              fieldKey: ref.fieldKey,
              fieldLabel: ref.label,
              kind: "invalid_value",
              message: `${ref.label} "${value}" no reconocida. Mapea este valor en el panel de mapeo de valores.`,
            });
          }
        }
      }

      return { rowNum: idx + 2, data, valid: valid && errors.length === 0, errors };
    });
  }, [rawRows, mapping, refFields, fixedValues]);

  // ── Cargar y parsear el Excel ──
  const parseFile = useCallback((f: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(firstSheet, { header: 0, defval: "" });

        if (jsonData.length === 0) {
          toast.error("El archivo está vacío o no tiene datos");
          return;
        }

        const headers = Object.keys(jsonData[0]);
        // Autodetectar mapeo usando primero los mapeos aprendidos de la empresa
        const autoMapping = autoDetectMapping(
          headers,
          (learnedFieldMappings ?? []).map((m) => ({
            excel_header: m.excel_header,
            field_key: m.field_key,
            times_used: m.times_used,
          }))
        );

        setExcelHeaders(headers);
        setRawRows(jsonData);
        setMapping(autoMapping);

        // Verificar si hay campos requeridos sin mapear
        const missingRequired = REQUIRED_FIELDS.filter(
          (field) => !autoMapping[field.key]?.fieldKey
        );

        // Siempre ir a review — mapeo + preview juntos
        setStep("review");
        // Abrir el mapper si faltan requeridos, colapsarlo si todo está OK
        setMapperOpen(missingRequired.length > 0);

        if (missingRequired.length > 0) {
          toast.info(
            `Detectamos ${missingRequired.length} campo(s) requerido(s) sin mapear. Ajusta el mapeo de columnas arriba.`
          );
        } else {
          toast.success(`${jsonData.length} filas parseadas`);
        }
      } catch (err) {
        toast.error("Error al leer el archivo Excel");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(f);
  }, [learnedFieldMappings]);

  // ── Cambiar el mapeo: desde una columna del Excel a un campo del sistema ──
  // excelHeader = columna del Excel que se está mapeando
  // fieldKey = campo del sistema al que se mapea (o null para desmapear)
  const handleExcelHeaderMapping = (excelHeader: string, fieldKey: string | null) => {
    setMapping((prev) => {
      const next = { ...prev };

      // 1) Qitar este excelHeader de cualquier campo que lo tenga asignado
      for (const [k, m] of Object.entries(next)) {
        if (m?.excelHeader === excelHeader) {
          next[k] = { ...m, fieldKey: null, excelHeader: "", autoDetected: false, confidence: 0 };
        }
      }

      // 2) Si se está asignando a un fieldKey, quitar el excelHeader que tenía ese fieldKey antes
      if (fieldKey) {
        next[fieldKey] = {
          fieldKey,
          excelHeader,
          autoDetected: false,
          confidence: 1,
        };
      }

      return next;
    });
  };

  // ── Fase 1: Cargar a staging (claims_staging) ──
  // Inserta todas las filas válidas en la tabla temporal claims_staging
  // con raw_data = datos parseados. No toca claims todavía.
  const loadMutation = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      if (!tenantCompanyId) {
        throw new Error("No se pudo determinar la empresa (tenant) del usuario. Vuelve a iniciar sesión.");
      }
      setIsUploading(true);
      setProgress({ current: 0, total: rows.length, success: 0, error: 0 });
      const validRows = rows.filter((r) => r.valid);

      // 1) Limpiar staging de la empresa
      await cleanStaging(tenantCompanyId);

      // 2) Preparar raw_data para cada fila válida
      //    Incluye los datos parseados + los UUIDs resueltos de catálogos
      const payload: Record<string, unknown>[] = [];
      for (const row of validRows) {
        const d = row.data;
        const str = (v: unknown) => (v ? String(v) : "");
        const date = (v: unknown): string | null => {
          const s = str(v).trim();
          if (!s) return null;
          return parseDate(s);
        };
        const num = (v: unknown) => {
          const s = str(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".");
          const n = parseFloat(s);
          return isNaN(n) ? null : n;
        };
        const bool = (v: unknown) => {
          const s = str(v).toLowerCase().trim();
          return s === "si" || s === "sí" || s === "true" || s === "1" || s === "yes"
            ? true
            : s === "no" || s === "false" || s === "0" || s === ""
            ? false
            : null;
        };

        // Resolver UUIDs de catálogos
        const insuranceCompanyId = str(d.insuranceCompany) ? resolveInsuranceCompanyId(str(d.insuranceCompany)) : null;
        const claimTypeId = str(d.claimType) ? resolveClaimTypeId(str(d.claimType)) : null;
        const claimCauseId = str(d.claimCause) ? resolveClaimCauseId(str(d.claimCause)) : null;
        const statusId = str(d.status) ? resolveStatusId(str(d.status)) : null;
        const businessLineId = str(d.businessLine) ? resolveBusinessLineId(str(d.businessLine)) : null;
        const currencyId = str(d.currency) ? resolveCurrencyId(str(d.currency)) : null;
        const destinationHousingId = str(d.destination) ? resolveDestinationHousingId(str(d.destination)) : null;
        const damageClassificationId = str(d.damageClassification) ? resolveDamageClassificationId(str(d.damageClassification)) : null;
        const insuranceProductId = str(d.insuranceProduct) ? resolveInsuranceProductId(str(d.insuranceProduct)) : null;
        const eventId = str(d.event) ? resolveEventId(str(d.event)) : null;
        // ── UUIDs nuevos ──
        const brokerId = str(d.broker) ? resolveBrokerId(str(d.broker)) : null;
        const advisorId = str(d.advisor) ? resolveAdvisorId(str(d.advisor)) : null;
        const propertyClassificationId = str(d.propertyClassification) ? resolvePropertyClassificationId(str(d.propertyClassification)) : null;
        const countryId = str(d.claimCountryRef) ? resolveCountryId(str(d.claimCountryRef)) : null;
        const regionId = str(d.claimRegionRef) ? resolveRegionId(str(d.claimRegionRef)) : null;
        const cityId = str(d.claimCityRef) ? resolveCityId(str(d.claimCityRef)) : null;
        const communeId = str(d.claimCommuneRef) ? resolveCommuneId(str(d.claimCommuneRef)) : null;
        const inspectorId = str(d.inspector) ? resolveInspectorId(str(d.inspector)) : null;
        const adjusterId = str(d.adjuster) ? resolveAdjusterId(str(d.adjuster)) : null;
        const auditorId = str(d.auditor) ? resolveAuditorId(str(d.auditor)) : null;
        const dispatcherId = str(d.dispatcher) ? resolveDispatcherId(str(d.dispatcher)) : null;
        const assistantId = str(d.assistant) ? resolveAssistantId(str(d.assistant)) : null;
        const policyId = str(d.policyRef) ? resolvePolicyId(str(d.policyRef)) : null;

        // Construir raw_data con todos los campos normalizados + UUIDs resueltos
        const rawData: Record<string, unknown> = {
          // Campos básicos
          claimNumber: str(d.claimNumber),
          policyNumber: str(d.policyNumber),
          claimDate: date(d.claimDate),
          summary: str(d.summary) || null,
          reportDate: date(d.reportDate),
          assignmentDate: date(d.assignmentDate),
          companyReportNumber: str(d.companyReportNumber) || null,
          createdAt: date(d.createdAt),
          internalNumber: str(d.internalNumber) || null,
          // UUIDs resueltos
          insuranceCompanyId,
          claimTypeId,
          claimCauseId,
          statusId,
          businessLineId,
          currencyId,
          destinationHousingId,
          damageClassificationId,
          insuranceProductId,
          eventId,
          // UUIDs nuevos
          brokerId,
          advisorId,
          propertyClassificationId,
          countryId,
          regionId,
          cityId,
          communeId,
          inspectorId,
          adjusterId,
          auditorId,
          dispatcherId,
          assistantId,
          policyId,
          // Campos adicionales de claims (texto/boolean/numero)
          clientReference: str(d.clientReference) || null,
          recoveryTypeLegal: bool(d.recoveryTypeLegal),
          recoveryTypeMaterial: bool(d.recoveryTypeMaterial),
          recoveryComments: str(d.recoveryComments) || null,
          claimLatitude: num(d.claimLatitude),
          claimLongitude: num(d.claimLongitude),
          notes: str(d.notes) || null,
          // ── Contratante (va a claims_participants tipo "contractor") ──
          contractorName: str(d.contractorName) || null,
          contractorLastName: str(d.contractorLastName) || null,
          contractorRut: str(d.contractorRut) || null,
          contractorEmail: str(d.contractorEmail) || null,
          contractorPhone: str(d.contractorPhone) || null,
          contractorCellPhone: str(d.contractorCellPhone) || null,
          contractorAddress: str(d.contractorAddress) || null,
          contractorCountry: str(d.contractorCountry) || null,
          contractorRegion: str(d.contractorRegion) || null,
          contractorCity: str(d.contractorCity) || null,
          contractorCommune: str(d.contractorCommune) || null,
          // Valores originales (para mostrar en preview)
          insuranceCompanyName: str(d.insuranceCompany),
          claimTypeName: str(d.claimType),
          claimCauseName: str(d.claimCause),
          statusName: str(d.status),
          businessLineName: str(d.businessLine),
          currencyName: str(d.currency),
          destinationName: str(d.destination),
          damageClassificationName: str(d.damageClassification),
          insuranceProductName: str(d.insuranceProduct),
          eventName: str(d.event),
          // Campos de póliza
          policyItem: str(d.policyItem) || null,
          policyStartDate: date(d.policyStartDate),
          policyEndDate: date(d.policyEndDate),
          policyAmount: num(d.policyAmount),
          policyPremium: num(d.policyPremium),
          isSpecialClaim: bool(d.isSpecialClaim),
          brokerExecutive: str(d.brokerExecutive) || null,
          ownerSameAsInsured: bool(d.ownerSameAsInsured),
          // Contratante/Asegurado
          insuredName: str(d.insuredName),
          lastName: str(d.lastName) || null,
          rut: str(d.rut) || null,
          insuredEmail: str(d.insuredEmail) || null,
          insuredPhone: str(d.insuredPhone) || null,
          cellPhone: str(d.cellPhone || d.insuredPhone),
          insuredAddress: str(d.address) || null,
          insuredCountry: str(d.country) || null,
          insuredRegion: str(d.region) || null,
          insuredCity: str(d.city) || null,
          insuredCommune: str(d.commune) || null,
          // Dirección del siniestro (solo texto, país/región/ciudad/comuna van por catálogo)
          claimAddress: str(d.claimAddress) || str(d.address),
          // Beneficiario
          beneficiaryName: str(d.beneficiaryName) || null,
          beneficiaryLastName: str(d.beneficiaryLastName) || null,
          beneficiaryRut: str(d.beneficiaryRut) || null,
          beneficiaryEmail: str(d.beneficiaryEmail) || null,
          beneficiaryPhone: str(d.beneficiaryPhone) || null,
          beneficiaryCellPhone: str(d.beneficiaryCellPhone) || null,
          beneficiaryAddress: str(d.beneficiaryAddress) || null,
          beneficiaryCountry: str(d.beneficiaryCountry) || null,
          beneficiaryRegion: str(d.beneficiaryRegion) || null,
          beneficiaryCity: str(d.beneficiaryCity) || null,
          beneficiaryCommune: str(d.beneficiaryCommune) || null,
          // Contacto
          contactName: str(d.contactName) || null,
          contactRole: str(d.contactRole) || null,
          contactEmail: str(d.contactEmail) || null,
          contactPhone: str(d.contactPhone) || null,
          // Metadata
          rowNum: row.rowNum,
        };
        payload.push(rawData);
      }

      // 3) Insertar en staging
      const inserted = await insertStagingRows(tenantCompanyId, payload);
      setProgress({ current: payload.length, total: rows.length, success: payload.length, error: rows.length - payload.length });

      // 4) Validar cada row: marcar error si hay UUIDs no resueltos
      for (const sr of inserted) {
        const rd = sr.raw_data;
        const errors: string[] = [];
        if (rd.insuranceCompanyName && !rd.insuranceCompanyId) {
          errors.push(`Aseguradora "${rd.insuranceCompanyName}" no encontrada en catálogo`);
        }
        if (rd.claimTypeName && !rd.claimTypeId) {
          errors.push(`Tipo siniestro "${rd.claimTypeName}" no encontrado en catálogo`);
        }
        if (rd.claimCauseName && !rd.claimCauseId) {
          errors.push(`Causal "${rd.claimCauseName}" no encontrada en catálogo`);
        }
        if (rd.statusName && !rd.statusId) {
          errors.push(`Estatus "${rd.statusName}" no encontrado en catálogo`);
        }
        if (rd.businessLineName && !rd.businessLineId) {
          errors.push(`Línea negocio "${rd.businessLineName}" no encontrada en catálogo`);
        }
        if (rd.currencyName && !rd.currencyId) {
          errors.push(`Moneda "${rd.currencyName}" no encontrada en catálogo`);
        }
        if (rd.destinationName && !rd.destinationHousingId) {
          errors.push(`Destino "${rd.destinationName}" no encontrado en catálogo`);
        }
        if (rd.damageClassificationName && !rd.damageClassificationId) {
          errors.push(`Clasif. daño "${rd.damageClassificationName}" no encontrada en catálogo`);
        }
        if (rd.insuranceProductName && !rd.insuranceProductId) {
          errors.push(`Ramo/Producto "${rd.insuranceProductName}" no encontrado en catálogo`);
        }
        if (rd.eventName && !rd.eventId) {
          errors.push(`Evento "${rd.eventName}" no encontrado en catálogo`);
        }
        if (!rd.claimNumber) errors.push("Falta N° Siniestro");
        if (!rd.policyNumber) errors.push("Falta N° Póliza");
        if (!rd.claimDate) errors.push("Falta Fecha Siniestro");
        if (!rd.insuredName) errors.push("Falta Nombre Asegurado");

        if (errors.length > 0) {
          await markStagingError(sr.id, errors.join("; "));
        } else {
          await markStagingValid(sr.id);
        }
      }

      // 5) Recargar staging rows con estado actualizado
      const finalRows = await getStagingRows(tenantCompanyId);
      setStagingRows(finalRows);

      setIsUploading(false);
      return { inserted: payload.length, skipped: rows.length - payload.length, total: rows.length };
    },
    onSuccess: (result) => {
      toast.success(`Staging cargado: ${result.inserted} filas listas para revisión`);
      setStep("staging");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Fase 2: Confirmar — mover staging a claims ──
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!tenantCompanyId) {
        throw new Error("No se pudo determinar la empresa (tenant) del usuario.");
      }
      const validStaging = stagingRows.filter((r) => r.status === "valid");
      setIsConfirming(true);
      setConfirmProgress({ current: 0, total: validStaging.length, success: 0, error: 0 });
      let success = 0;
      let error = 0;

      for (let i = 0; i < validStaging.length; i++) {
        const sr = validStaging[i];
        const d = sr.raw_data;
        try {
          const claim = await createClaimMinimal(
            {
              claimNumber: String(d.claimNumber || ""),
              policyNumber: String(d.policyNumber || ""),
              claimDate: String(d.claimDate || ""),
              summary: (d.summary as string) || null,
              reportDate: (d.reportDate as string) || null,
              assignmentDate: (d.assignmentDate as string) || null,
              company_id: tenantCompanyId,
              insuranceCompanyId: (d.insuranceCompanyId as string) || null,
              claimTypeId: (d.claimTypeId as string) || null,
              claimCauseId: (d.claimCauseId as string) || null,
              statusId: (d.statusId as string) || null,
              businessLineId: (d.businessLineId as string) || null,
              currencyId: (d.currencyId as string) || null,
              destinationHousingId: (d.destinationHousingId as string) || null,
              damageClassificationId: (d.damageClassificationId as string) || null,
              insuranceProductId: (d.insuranceProductId as string) || null,
              eventId: (d.eventId as string) || null,
              ownerSameAsInsured: (d.ownerSameAsInsured as boolean | null) ?? null,
              policyItem: (d.policyItem as string) || null,
              policyStartDate: (d.policyStartDate as string) || null,
              policyEndDate: (d.policyEndDate as string) || null,
              policyAmount: (d.policyAmount as number | null) ?? null,
              policyPremium: (d.policyPremium as number | null) ?? null,
              isSpecialClaim: (d.isSpecialClaim as boolean | null) ?? null,
              brokerExecutive: (d.brokerExecutive as string) || null,
              companyReportNumber: (d.companyReportNumber as string) || null,
              createdAt: (d.createdAt as string) || null,
              internalNumber: (d.internalNumber as string) || null,
              // ── Campos adicionales ──
              clientReference: (d.clientReference as string) || null,
              recoveryTypeLegal: (d.recoveryTypeLegal as boolean | null) ?? null,
              recoveryTypeMaterial: (d.recoveryTypeMaterial as boolean | null) ?? null,
              recoveryComments: (d.recoveryComments as string) || null,
              claimLatitude: (d.claimLatitude as number | null) ?? null,
              claimLongitude: (d.claimLongitude as number | null) ?? null,
              regionId: (d.regionId as string) || null,
              cityId: (d.cityId as string) || null,
              communeId: (d.communeId as string) || null,
              brokerId: (d.brokerId as string) || null,
              advisorId: (d.advisorId as string) || null,
              propertyClassificationId: (d.propertyClassificationId as string) || null,
              policyId: (d.policyId as string) || null,
              typeId: null,
              inspectorId: (d.inspectorId as string) || null,
              adjusterId: (d.adjusterId as string) || null,
              auditorId: (d.auditorId as string) || null,
              dispatcherId: (d.dispatcherId as string) || null,
              assistantId: (d.assistantId as string) || null,
              notes: (d.notes as string) || null,
            },
            {
              insuredName: String(d.insuredName || ""),
              lastName: (d.lastName as string) || null,
              rut: (d.rut as string) || null,
              insuredEmail: (d.insuredEmail as string) || null,
              insuredPhone: (d.insuredPhone as string) || null,
              cellPhone: String(d.cellPhone || d.insuredPhone || ""),
              insuredAddress: (d.insuredAddress as string) || null,
              insuredCountry: (d.insuredCountry as string) || null,
              insuredRegion: (d.insuredRegion as string) || null,
              insuredCity: (d.insuredCity as string) || null,
              insuredCommune: (d.insuredCommune as string) || null,
            },
            {
              claimAddress: String(d.claimAddress || ""),
            },
            // Contractor (si tiene nombre)
            (d.contractorName as string) ? {
              contractorName: String(d.contractorName),
              contractorLastName: (d.contractorLastName as string) || null,
              contractorRut: (d.contractorRut as string) || null,
              contractorEmail: (d.contractorEmail as string) || null,
              contractorPhone: (d.contractorPhone as string) || null,
              contractorCellPhone: (d.contractorCellPhone as string) || null,
              contractorAddress: (d.contractorAddress as string) || null,
              contractorCountry: (d.contractorCountry as string) || null,
              contractorRegion: (d.contractorRegion as string) || null,
              contractorCity: (d.contractorCity as string) || null,
              contractorCommune: (d.contractorCommune as string) || null,
            } : null,
            (d.beneficiaryName as string) ? {
              beneficiaryName: String(d.beneficiaryName),
              beneficiaryLastName: (d.beneficiaryLastName as string) || null,
              beneficiaryRut: (d.beneficiaryRut as string) || null,
              beneficiaryEmail: (d.beneficiaryEmail as string) || null,
              beneficiaryPhone: (d.beneficiaryPhone as string) || null,
              beneficiaryCellPhone: (d.beneficiaryCellPhone as string) || null,
              beneficiaryAddress: (d.beneficiaryAddress as string) || null,
              beneficiaryCountry: (d.beneficiaryCountry as string) || null,
              beneficiaryRegion: (d.beneficiaryRegion as string) || null,
              beneficiaryCity: (d.beneficiaryCity as string) || null,
              beneficiaryCommune: (d.beneficiaryCommune as string) || null,
            } : null,
            ((d.contactName as string) || (d.contactEmail as string) || (d.contactPhone as string)) ? {
              contactName: (d.contactName as string) || null,
              contactRole: (d.contactRole as string) || null,
              contactEmail: (d.contactEmail as string) || null,
              contactPhone: (d.contactPhone as string) || null,
            } : null
          );
          await markStagingImported(sr.id, claim.id);
          success++;
        } catch (err) {
          error++;
          const msg = err instanceof Error ? err.message : String(err);
          await markStagingError(sr.id, msg);
          console.error(`Staging ${sr.id}:`, err);
        }
        setConfirmProgress({ current: i + 1, total: validStaging.length, success, error });
      }

      // Recargar staging para mostrar estado final
      // (los importados se borran, los con error quedan para revisión)
      if (error === 0) {
        // Todo OK → borrar todo el staging
        await cleanStaging(tenantCompanyId);
        setStagingRows([]);
      } else {
        // Hay errores → borrar solo los importados, dejar los con error
        const finalRows = await getStagingRows(tenantCompanyId);
        const remaining = finalRows.filter((r) => r.status !== "imported");
        setStagingRows(remaining);
      }

      // ── APRENDIZAJE: guardar mapeos para futuras importaciones ──
      try {
        // 1. Guardar mapeo de campos (excel_header → field_key)
        const fieldMappingsToSave: Array<{ excelHeader: string; fieldKey: string }> = [];
        for (const [fieldKey, m] of Object.entries(mapping)) {
          if (m?.fieldKey && m?.excelHeader) {
            fieldMappingsToSave.push({ excelHeader: m.excelHeader, fieldKey });
          }
        }
        if (fieldMappingsToSave.length > 0) {
          await saveImportFieldMappingsBatch(tenantCompanyId, fieldMappingsToSave);
        }

        // 2. Guardar mapeo de valores (excel_value → catalog_uuid)
        const valueMappingsToSave: Array<{ fieldKey: string; excelValue: string; catalogUuid: string }> = [];
        for (const [key, uuid] of Object.entries(valueMappings)) {
          // key = "fieldKey::excelValue"
          const [fieldKey, ...rest] = key.split("::");
          const excelValue = rest.join("::");
          if (fieldKey && excelValue && uuid) {
            valueMappingsToSave.push({ fieldKey, excelValue, catalogUuid: uuid });
          }
        }
        if (valueMappingsToSave.length > 0) {
          await saveImportValueMappingsBatch(tenantCompanyId, valueMappingsToSave);
        }

        // Invalidar queries para recargar en próxima importación
        queryClient.invalidateQueries({ queryKey: ["import-field-mappings", tenantCompanyId] });
        queryClient.invalidateQueries({ queryKey: ["import-value-mappings", tenantCompanyId] });
      } catch (learnErr) {
        console.error("Error guardando mappings aprendidos:", learnErr);
        // No fallar la importación por esto
      }

      setIsConfirming(false);
      return { success, error, total: validStaging.length };
    },
    onSuccess: (result) => {
      if (result.error === 0) {
        toast.success(`${result.success} registros importados`);
      } else {
        toast.warning(`${result.success} importados, ${result.error} errores`);
      }
      setStep("done");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith(".xlsx") || droppedFile.name.endsWith(".xls"))) {
      setFile(droppedFile);
      parseFile(droppedFile);
    } else {
      toast.error("Solo archivos Excel (.xlsx, .xls)");
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      parseFile(selected);
    }
  };

  // ── Mapear un valor del Excel a un UUID del catálogo ──
  const handleValueMappingChange = (fieldKey: string, excelValue: string, uuid: string | null) => {
    const id = uuid || "__none__";
    const key = `${fieldKey}::${excelValue}`;
    setValueMappings((prev) => {
      const next = { ...prev };
      if (id === "__none__") {
        delete next[key];
      } else {
        next[key] = id;
      }
      return next;
    });
  };

  const handleReset = () => {
    setFile(null);
    setRawRows([]);
    setExcelHeaders([]);
    setMapping({});
    setValueMappings({});
    setFixedValues({});
    setStagingRows([]);
    setStep("upload");
    setMapperOpen(true);
  };

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  // Headers ya asignados a algún campo (para mostrar como "usados" en el mapper)
  const usedHeaders = useMemo(() => {
    const used = new Map<string, string>(); // excelHeader → fieldKey que lo usa
    for (const [k, m] of Object.entries(mapping)) {
      if (m?.excelHeader) used.set(m.excelHeader, k);
    }
    return used;
  }, [mapping]);

  const missingRequiredCount = REQUIRED_FIELDS.filter(
    (field) => !mapping[field.key]?.fieldKey || !mapping[field.key]?.excelHeader
  ).length;

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-blue-500 to-cyan-500">
            <FileSpreadsheet />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Carga Masiva de Siniestros</h1>
            {file && (
              <span className="text-xs text-muted-foreground">
                {file.name} · {rawRows.length} filas
              </span>
            )}
          </div>
        </div>
        {step !== "upload" && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="mr-1.5 h-3.5 w-3.5" /> Reiniciar
          </Button>
        )}
      </div>

      {/* Drop Zone — solo visible en step upload */}
      {step === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-4 sm:p-8 text-center transition-colors ${
            isDragging ? "border-primary bg-primary/5" : "border-border bg-card"
          }`}
        >
          <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">Arrastra tu archivo Excel aquí</p>
          <p className="mt-1 text-xs text-muted-foreground">.xlsx o .xls</p>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
            id="excel-upload"
          />
          <label htmlFor="excel-upload" className="mt-4 inline-flex cursor-pointer">
            <span className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-[13px] font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
              <Upload className="mr-2 h-3.5 w-3.5" /> Seleccionar archivo
            </span>
          </label>
          {file && <p className="mt-2 text-xs text-muted-foreground">{file.name}</p>}
        </div>
      )}

      {/* ── Step Review: mapeo + preview juntos en la misma pantalla ── */}
      {step === "review" && (
        <div className="space-y-3">
          {/* Barra de estado + acciones principales */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                {validCount} válidos
              </span>
              <span className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-500" />
                {invalidCount} con errores
              </span>
              {missingRequiredCount > 0 && (
                <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  {missingRequiredCount} requerido(s) sin mapear
                </span>
              )}
            </div>
            {canCreate("operaciones") && (
              <Button
                onClick={() => loadMutation.mutate(parsedRows)}
                disabled={isUploading || validCount === 0 || missingRequiredCount > 0 || totalUnmappedCount > 0}
                className="pg-btn-platinum-icon"
              >
                {isUploading ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Cargando</>
                ) : (
                  <><Upload className="mr-2 h-3.5 w-3.5" /> Cargar</>
                )}
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {isUploading && (
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span>Progreso: {progress.current} / {progress.total}</span>
                <span className="text-emerald-600">{progress.success} ok</span>
                <span className="text-red-600">{progress.error} err</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Panel de mapeo (colapsable) ── */}
          <div className="bulk-mapper-panel">
            <button
              type="button"
              onClick={() => setMapperOpen((v) => !v)}
              className="bulk-mapper-toggle"
            >
              <div className="bulk-mapper-toggle-left">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="bulk-mapper-title">Mapeo de columnas</h2>
                  <p className="bulk-mapper-subtitle">
                    {missingRequiredCount > 0
                      ? `${missingRequiredCount} campo(s) requerido(s) sin mapear — ajusta abajo.`
                      : "Todos los campos requeridos están mapeados. Puedes ajustar opcionalmente."}
                  </p>
                </div>
              </div>
              <div className="bulk-mapper-toggle-right">
                {missingRequiredCount > 0 ? (
                  <span className="bulk-mapper-status-warn">
                    <AlertCircle className="h-4 w-4" />
                    {missingRequiredCount} sin mapear
                  </span>
                ) : (
                  <span className="bulk-mapper-status-ok">
                    <CheckCircle className="h-4 w-4" />
                    Mapeo OK
                  </span>
                )}
                {mapperOpen
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {mapperOpen && (
              <>
                {/* Columnas detectadas en el Excel */}
                <div className="bulk-mapper-detected">
                  <p className="bulk-mapper-detected-label">
                    Columnas detectadas en tu Excel ({excelHeaders.length}):
                  </p>
                  <div className="bulk-mapper-detected-chips">
                    {excelHeaders.map((h) => {
                      const usedBy = usedHeaders.get(h);
                      const field = usedBy ? CLAIM_FIELDS.find((f) => f.key === usedBy) : null;
                      return (
                        <span
                          key={h}
                          className={`bulk-detected-chip ${field ? "bulk-detected-chip-used" : ""}`}
                          title={field ? `Asignada a: ${field.label}` : "Sin asignar"}
                        >
                          {h}
                          {field && <em>→ {field.label}</em>}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Tabla de mapeo INVERTIDA: filas = columnas del Excel, dropdown = campos del sistema */}
                <div className="bulk-mapper-table-wrap">
                  <table className="bulk-mapper-table">
                    <thead>
                      <tr>
                        <th className="bulk-mapper-th-column">Columna del Excel</th>
                        <th className="bulk-mapper-th-arrow"></th>
                        <th className="bulk-mapper-th-field">Campo del sistema</th>
                        <th className="bulk-mapper-th-status">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excelHeaders.map((header) => {
                        const fieldKey = usedHeaders.get(header);
                        const field = fieldKey ? CLAIM_FIELDS.find((f) => f.key === fieldKey) : null;
                        const isMapped = !!field;
                        const m = fieldKey ? mapping[fieldKey] : null;
                        const confidence = m?.confidence ?? 0;
                        const isLowConfidence = isMapped && confidence < 1 && m?.autoDetected;

                        return (
                          <tr key={header} className={field?.required ? "bulk-mapper-row-required" : ""}>
                            <td className="bulk-mapper-td-column">
                              <span className="bulk-mapper-field-label">{header}</span>
                            </td>
                            <td className="bulk-mapper-td-arrow">
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </td>
                            <td className="bulk-mapper-td-field">
                              <Select
                                value={fieldKey || "__none__"}
                                onValueChange={(val) => handleExcelHeaderMapping(header, val === "__none__" ? null : val)}
                              >
                                <SelectTrigger className="bulk-mapper-select">
                                  <SelectValue placeholder="— Sin mapear —" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Sin mapear —</SelectItem>
                                  {CLAIM_FIELDS
                                    .filter((f) => {
                                      // Filtrar campos ya asignados a OTRA columna del Excel
                                      const currentHeaderForField = mapping[f.key]?.excelHeader;
                                      return !currentHeaderForField || currentHeaderForField === header;
                                    })
                                    .map((f) => (
                                      <SelectItem key={f.key} value={f.key}>
                                        {f.label}
                                        {f.required && " *"}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="bulk-mapper-td-status">
                              {!isMapped && (
                                <span className="bulk-mapper-status-pill bulk-mapper-status-pill-neutral">
                                  Sin mapear
                                </span>
                              )}
                              {isMapped && isLowConfidence && (
                                <span className="bulk-mapper-status-pill bulk-mapper-status-pill-warn">
                                  Sugerencia ({Math.round(confidence * 100)}%)
                                </span>
                              )}
                              {isMapped && !isLowConfidence && (
                                <span className="bulk-mapper-status-pill bulk-mapper-status-pill-ok">
                                  <CheckCircle className="h-3 w-3" /> Mapeado
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Resumen de campos requeridos sin mapear */}
                {missingRequiredCount > 0 && (
                  <div className="bulk-mapper-required-warning">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    <span>
                      {missingRequiredCount} campo(s) requerido(s) sin mapear:{" "}
                      {REQUIRED_FIELDS.filter((f) => !mapping[f.key]?.fieldKey || !mapping[f.key]?.excelHeader)
                        .map((f) => f.label).join(", ")}
                    </span>
                  </div>
                )}

                {/* ── Valores fijos: campos del sistema sin columna en el Excel ── */}
                <div className="bulk-fixed-values-section">
                  <div className="bulk-fixed-values-header">
                    <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span className="bulk-fixed-values-title">Valores fijos</span>
                    <span className="bulk-fixed-values-desc">
                      Asigna un valor en duro a campos del sistema que no tienen columna en el Excel
                    </span>
                  </div>
                  <div className="bulk-fixed-values-list">
                    {Object.entries(fixedValues).length > 0 && (
                      <div className="bulk-fixed-values-existing">
                        {Object.entries(fixedValues).map(([fk, val]) => {
                          const f = CLAIM_FIELDS.find((cf) => cf.key === fk);
                          return (
                            <div key={fk} className="bulk-fixed-value-item">
                              <span className="bulk-fixed-value-field">{f?.label || fk}</span>
                              <span className="bulk-fixed-value-arrow">=</span>
                              <span className="bulk-fixed-value-val">{val}</span>
                              <button
                                className="bulk-fixed-value-remove"
                                onClick={() => setFixedValues((prev) => {
                                  const next = { ...prev };
                                  delete next[fk];
                                  return next;
                                })}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="bulk-fixed-values-add">
                      <Select
                        value=""
                        onValueChange={(fk) => {
                          if (!fk || fk === "__none__") return;
                          // Abrir input para escribir el valor
                          const val = window.prompt(`Valor fijo para: ${CLAIM_FIELDS.find(f => f.key === fk)?.label || fk}`);
                          if (val !== null && val.trim()) {
                            setFixedValues((prev) => ({ ...prev, [fk]: val.trim() }));
                          }
                        }}
                      >
                        <SelectTrigger className="bulk-fixed-values-select">
                          <SelectValue placeholder="+ Agregar valor fijo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Seleccionar campo —</SelectItem>
                          {CLAIM_FIELDS
                            .filter((f) => {
                              // No mostrar si ya está mapeado desde el Excel O ya tiene valor fijo
                              const isMappedFromExcel = !!(mapping[f.key]?.fieldKey && mapping[f.key]?.excelHeader);
                              const hasFixedValue = f.key in fixedValues;
                              return !isMappedFromExcel && !hasFixedValue;
                            })
                            .map((f) => (
                              <SelectItem key={f.key} value={f.key}>
                                {f.label}
                                {f.required && " *"}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ── Panel de mapeo de valores: catálogos no reconocidos ── */}
          {step === "review" && totalUnmappedCount > 0 && (
            <div className="bulk-value-mapper-panel">
              <div className="bulk-value-mapper-header">
                <SlidersHorizontal className="h-5 w-5 text-amber-500" />
                <div>
                  <h2 className="bulk-mapper-title">Mapeo de valores</h2>
                  <p className="bulk-mapper-subtitle">
                    Estos valores del Excel no coinciden exactamente con los catálogos del sistema.
                    Mapea cada valor al registro correcto para que las filas se validen.
                  </p>
                </div>
                <span className="bulk-mapper-status-warn">
                  <AlertCircle className="h-4 w-4" />
                  {totalUnmappedCount} sin mapear
                </span>
              </div>

              {refFields.map((ref) => {
                const unmapped = unmappedRefValues[ref.fieldKey] || [];
                if (unmapped.length === 0) return null;
                return (
                  <div key={ref.fieldKey} className="bulk-value-mapper-section">
                    <p className="bulk-value-mapper-section-title">{ref.label} ({unmapped.length})</p>
                    <div className="bulk-value-mapper-table-wrap">
                      <table className="bulk-mapper-table">
                        <thead>
                          <tr>
                            <th className="bulk-mapper-th-field">Valor en tu Excel</th>
                            <th className="bulk-mapper-th-arrow"></th>
                            <th className="bulk-mapper-th-column">{ref.label} del sistema</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unmapped.map((excelValue) => {
                            const mapKey = `${ref.fieldKey}::${excelValue}`;
                            return (
                              <tr key={excelValue}>
                                <td className="bulk-mapper-td-field">
                                  <span className="bulk-mapper-field-label">{excelValue}</span>
                                </td>
                                <td className="bulk-mapper-td-arrow">
                                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                                </td>
                                <td className="bulk-mapper-td-column">
                                  <Select
                                    value={valueMappings[mapKey] || "__none__"}
                                    onValueChange={(val) => handleValueMappingChange(ref.fieldKey, excelValue, val)}
                                  >
                                    <SelectTrigger className="bulk-mapper-select">
                                      <SelectValue placeholder={`— Selecciona ${ref.label.toLowerCase()} —`} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="__none__">— Sin mapear —</SelectItem>
                                      {ref.options.map((c) => (
                                        <SelectItem key={c.id} value={c.id}>
                                          {c.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resumen de errores por tipo (si hay inválidas) */}
          {invalidCount > 0 && (
            <ErrorSummary parsedRows={parsedRows} />
          )}

          {/* Table preview — se revalida en vivo al cambiar el mapeo */}
          <div className="app-data-table-wrap max-h-125 overflow-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th className="w-8">Estado</th>
                  <th>N° Siniestro</th>
                  <th>N° Póliza</th>
                  <th>Asegurado</th>
                  <th>Dirección</th>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Aseguradora</th>
                  <th className="bulk-error-col">Errores</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row) => (
                  <tr key={row.rowNum} className={row.valid ? "" : "bg-red-50/50 dark:bg-red-950/20"}>
                    <td className="text-muted-foreground">{row.rowNum}</td>
                    <td>
                      {row.valid ? (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <X className="h-4 w-4 text-red-500" />
                      )}
                    </td>
                    <td className="font-medium">{String(row.data.claimNumber || "—")}</td>
                    <td>{String(row.data.policyNumber || "—")}</td>
                    <td>{String(row.data.insuredName || "—")}</td>
                    <td className="bulk-cell-narrow">{String(row.data.address || "—")}</td>
                    <td>{String(row.data.claimDate || "—")}</td>
                    <td>{String(row.data.claimType || "—")}</td>
                    <td className="bulk-cell-medium">{String(row.data.insuranceCompany || "—")}</td>
                    <td>
                      {row.errors.length > 0 ? (
                        <div className="bulk-error-list">
                          {row.errors.map((err: RowError, i) => (
                            <span
                              key={i}
                              className={`bulk-error-badge bulk-error-badge-${err.kind}`}
                              title={err.message}
                            >
                              {err.message}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-emerald-600 text-xs">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Step Staging: revisión de carga temporal ── */}
      {step === "staging" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className="app-data-label">{stagingRows.filter((r) => r.status === "valid").length} registros</span>
              </span>
              <span className="flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="app-data-label">{stagingRows.filter((r) => r.status === "error").length} errores</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5" />
                <span className="app-data-label">{stagingRows.filter((r) => r.status === "imported").length} importados</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("review")}
                disabled={isConfirming}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Volver
              </Button>
              {canCreate("operaciones") && (
                <Button
                  onClick={() => confirmMutation.mutate()}
                  disabled={isConfirming || stagingRows.filter((r) => r.status === "valid").length === 0}
                  className="pg-btn-platinum-icon"
                >
                  {isConfirming ? (
                    <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Confirmando</>
                  ) : (
                    <><CheckCircle className="mr-2 h-3.5 w-3.5" /> Confirmar</>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Progress bar de confirmación */}
          {isConfirming && (
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between text-xs mb-2">
                <span>Confirmando: {confirmProgress.current} / {confirmProgress.total}</span>
                <span className="text-emerald-600">{confirmProgress.success} ok</span>
                <span className="text-red-600">{confirmProgress.error} err</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${confirmProgress.total > 0 ? (confirmProgress.current / confirmProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Aviso de errores bloqueantes */}
          {stagingRows.filter((r) => r.status === "error").length > 0 && (
            <div className="staging-warning-banner">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>
                {stagingRows.filter((r) => r.status === "error").length} fila(s) tienen errores y no se importarán.
                Las filas válidas se pueden confirmar. Las con errores quedan en staging para revisión.
              </span>
            </div>
          )}

          {/* Tabla de staging */}
          <div className="app-data-table-wrap max-h-125 overflow-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th className="w-8">Estado</th>
                  <th>N° Siniestro</th>
                  <th>N° Póliza</th>
                  <th>Asegurado</th>
                  <th>Dirección Siniestro</th>
                  <th>Fecha</th>
                  <th>Aseguradora</th>
                  <th>Liquidación</th>
                  <th className="bulk-error-col">Errores</th>
                </tr>
              </thead>
              <tbody>
                {stagingRows.map((sr, idx) => {
                  const d = sr.raw_data;
                  const isError = sr.status === "error";
                  const isImported = sr.status === "imported";
                  return (
                    <tr
                      key={sr.id}
                      className={isError ? "bg-red-50/50 dark:bg-red-950/20" : isImported ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}
                    >
                      <td className="text-muted-foreground">{idx + 1}</td>
                      <td>
                        {isImported ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : isError ? (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        )}
                      </td>
                      <td className="font-medium">{String(d.claimNumber || "—")}</td>
                      <td>{String(d.policyNumber || "—")}</td>
                      <td>{String(d.insuredName || "—")}</td>
                      <td className="bulk-cell-narrow">{String(d.claimAddress || "—")}</td>
                      <td>{String(d.claimDate || "—")}</td>
                      <td className="bulk-cell-medium">{String(d.insuranceCompanyName || "—")}</td>
                      <td className="text-muted-foreground">{isImported ? "Importado" : "—"}</td>
                      <td>
                        {sr.error_message ? (
                          <div className="bulk-error-list">
                            <span className="bulk-error-badge bulk-error-badge-invalid_value" title={sr.error_message}>
                              {sr.error_message}
                            </span>
                          </div>
                        ) : isImported ? (
                          <span className="text-emerald-600 text-xs">Importado OK</span>
                        ) : (
                          <span className="text-emerald-600 text-xs">Listo para importar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Step Done: resultado final ── */}
      {step === "done" && (
        <div className="space-y-3">
          <div className="staging-done-banner">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <h2 className="app-section-title">Carga completada</h2>
              <p className="text-sm text-muted-foreground">
                <span className="app-data-label">{confirmProgress.success} registros importados</span>
                {confirmProgress.error > 0 && (
                  <span className="app-data-label text-red-500"> · {confirmProgress.error} errores</span>
                )}
              </p>
            </div>
          </div>

          {/* Tabla final de staging con estado */}
          <div className="app-data-table-wrap max-h-125 overflow-auto">
            <table className="app-data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th className="w-8">Estado</th>
                  <th>N° Siniestro</th>
                  <th>N° Póliza</th>
                  <th>Asegurado</th>
                  <th>Aseguradora</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {stagingRows.map((sr, idx) => {
                  const d = sr.raw_data;
                  const isImported = sr.status === "imported";
                  const isError = sr.status === "error";
                  return (
                    <tr
                      key={sr.id}
                      className={isImported ? "bg-emerald-50/50 dark:bg-emerald-950/20" : isError ? "bg-red-50/50 dark:bg-red-950/20" : ""}
                    >
                      <td className="text-muted-foreground">{idx + 1}</td>
                      <td>
                        {isImported ? (
                          <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                      </td>
                      <td className="font-medium">{String(d.claimNumber || "—")}</td>
                      <td>{String(d.policyNumber || "—")}</td>
                      <td>{String(d.insuredName || "—")}</td>
                      <td>{String(d.insuranceCompanyName || "—")}</td>
                      <td>
                        {isImported ? (
                          <span className="text-emerald-600 text-xs">Importado OK</span>
                        ) : (
                          <span className="text-red-600 text-xs">{sr.error_message || "Error desconocido"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleReset} className="pg-btn-platinum-icon">
              <Upload className="mr-2 h-3.5 w-3.5" /> Cargar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Resumen de errores agregado por tipo
// ═══════════════════════════════════════════════════════════════

function ErrorSummary({ parsedRows }: { parsedRows: ParsedRow[] }) {
  const byField = useMemo(() => {
    const counts = new Map<string, { label: string; count: number; kind: RowError["kind"] }>();
    for (const row of parsedRows) {
      if (row.valid) continue;
      for (const err of row.errors) {
        const existing = counts.get(err.fieldKey);
        if (existing) {
          existing.count++;
        } else {
          counts.set(err.fieldKey, { label: err.fieldLabel, count: 1, kind: err.kind });
        }
      }
    }
    return [...counts.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [parsedRows]);

  if (byField.length === 0) return null;

  return (
    <div className="bulk-error-summary">
      <p className="bulk-error-summary-title">
        <AlertCircle className="h-4 w-4" />
        Resumen de errores ({byField.length} campo{byField.length !== 1 ? "s" : ""} con problemas):
      </p>
      <div className="bulk-error-summary-chips">
        {byField.map(([key, info]) => (
          <span
            key={key}
            className={`bulk-error-summary-chip bulk-error-summary-chip-${info.kind}`}
          >
            <strong>{info.label}</strong> · {info.count} fila{info.count !== 1 ? "s" : ""}
            <em>
              {info.kind === "missing_column" && "sin columna mapeada"}
              {info.kind === "empty_value" && "con celda vacía"}
              {info.kind === "invalid_value" && "con valor inválido"}
            </em>
          </span>
        ))}
      </div>
    </div>
  );
}
