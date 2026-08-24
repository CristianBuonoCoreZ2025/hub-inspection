"use client";

import { useState, useMemo, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createClaimFromAloClaim,
  cleanStaging,
  insertStagingRows,
  getStagingRows,
  markStagingError,
  markStagingImported,
  checkAloClaimDuplicates,
  type ClaimStagingRow,
  type DuplicateCheckResult,
} from "@/services/claims";
import {
  getInsuranceCompanies,
  getClaimTypes,
  getClaimCauses,
  getBusinessLines,
  getCurrencies,
  getEvents,
  getBrokers,
  getInsuranceProducts,
  getHousingDestinations,
} from "@/services/catalogs";
import { getUsersByRoleForCompany } from "@/services/users";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { rutBodyNumber } from "@/lib/validations/rut";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2, ArrowRight, Copy, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  ALOCLAIM_FIELDS,
  autoDetectAloClaimMapping,
  applyAloClaimMapping,
  validateAloClaimRow,
  type ColumnMapping,
  type LearnedAloClaimFieldMapping,
} from "@/lib/claim-import/schema-aloclaim";
import {
  getImportFieldMappings,
  saveImportFieldMappingsBatch,
  createImportLog,
  getImportFixedValues,
  saveImportFixedValuesBatch,
} from "@/services/import-mappings";
import * as XLSX from "xlsx";

interface ExcelRow {
  [key: string]: string | number | null;
}

type Step = "upload" | "preview" | "staging" | "done";

export default function CargaAloClaimPage() {
  const { canCreate } = usePermissions();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [rawRows, setRawRows] = useState<ExcelRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, ColumnMapping>>({});
  const [stagingRows, setStagingRows] = useState<ClaimStagingRow[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, error: 0 });
  const [progressErrors, setProgressErrors] = useState<string[]>([]);
  const [progressWarnings, setProgressWarnings] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCheckResult[]>([]);
  // Valores fijos: fieldKey → { value, catalogUuid }
  const [fixedValues, setFixedValues] = useState<Record<string, { value: string; catalogUuid: string | null }>>({});
  const [pendingFixedField, setPendingFixedField] = useState<string | null>(null);

  // Cliente (empresa)
  const availableClients = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (profile?.company_id && profile?.company) {
      map.set(profile.company_id, { id: profile.company_id, name: profile.company.name });
    }
    return [...map.values()];
  }, [profile]);

  const tenantCompanyId = availableClients[0]?.id || null;

  // Catálogos para resolver texto → UUID
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
  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: getEvents,
    staleTime: 5 * 60 * 1000,
  });
  const { data: brokers } = useQuery({
    queryKey: ["brokers"],
    queryFn: getBrokers,
    staleTime: 5 * 60 * 1000,
  });
  const { data: inspectors } = useQuery({
    queryKey: ["inspectors-for-casos", tenantCompanyId],
    queryFn: () => getUsersByRoleForCompany("inspector", tenantCompanyId || undefined),
    enabled: !!tenantCompanyId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: adjusters } = useQuery({
    queryKey: ["adjusters-for-casos", tenantCompanyId],
    queryFn: () => getUsersByRoleForCompany("adjuster", tenantCompanyId || undefined),
    enabled: !!tenantCompanyId,
    staleTime: 5 * 60 * 1000,
  });
  const { data: insuranceProducts } = useQuery({
    queryKey: ["insurance-products-casos"],
    queryFn: getInsuranceProducts,
    staleTime: 5 * 60 * 1000,
  });
  const { data: housingDestinations } = useQuery({
    queryKey: ["housing-destinations-casos"],
    queryFn: getHousingDestinations,
    staleTime: 5 * 60 * 1000,
  });

  // ── Mapeos aprendidos (import_field_mappings) ──
  const { data: learnedMappings } = useQuery({
    queryKey: ["import-field-mappings-casos", tenantCompanyId],
    queryFn: () => getImportFieldMappings(tenantCompanyId!),
    enabled: !!tenantCompanyId,
    staleTime: 5 * 60 * 1000,
  });

  // ── Valores fijos guardados (import_fixed_values) ──
  const { data: savedFixedValues } = useQuery({
    queryKey: ["import-fixed-values-casos", tenantCompanyId],
    queryFn: () => getImportFixedValues(tenantCompanyId!),
    enabled: !!tenantCompanyId,
    staleTime: 60 * 1000,
  });

  // Fixed values efectivos = DB (defaults) + overrides del usuario
  const effectiveFixedValues = useMemo(() => {
    const result: Record<string, { value: string; catalogUuid: string | null }> = {};
    for (const fv of savedFixedValues ?? []) {
      result[fv.field_key] = {
        value: fv.fixed_value || "",
        catalogUuid: fv.catalog_uuid || null,
      };
    }
    for (const [k, v] of Object.entries(fixedValues)) {
      result[k] = v;
    }
    return result;
  }, [savedFixedValues, fixedValues]);

  // ── Configuración de campos de referencia (para fixed values) ──
  const refFields = useMemo(() => [
    { fieldKey: "broker", label: "Corredor", options: brokers ?? [] },
    { fieldKey: "event", label: "Evento", options: events ?? [] },
    { fieldKey: "businessLine", label: "Línea Negocio", options: businessLines ?? [] },
    { fieldKey: "inspector", label: "Inspector", options: (inspectors ?? []).map(p => ({ id: p.id, name: p.full_name || p.email || "" })) },
    { fieldKey: "adjuster", label: "Ajustador/Liquidador", options: (adjusters ?? []).map(p => ({ id: p.id, name: p.full_name || p.email || "" })) },
    { fieldKey: "currency", label: "Moneda Siniestro", options: (currencies ?? []).map(c => ({ id: c.id, name: c.code })) },
    { fieldKey: "policyCurrency", label: "Moneda Póliza", options: (currencies ?? []).map(c => ({ id: c.id, name: c.code })) },
    { fieldKey: "claimType", label: "Tipo Siniestro", options: claimTypes ?? [] },
    { fieldKey: "claimCause", label: "Causal", options: claimCauses ?? [] },
  ], [brokers, events, businessLines, inspectors, adjusters, currencies, claimTypes, claimCauses]);

  // ── Helpers de resolución texto → UUID ──
  const resolveByName = useCallback(
    <T extends { id: string; name: string }>(catalog: T[] | undefined, name: string): string | null => {
      if (!catalog || !name) return null;
      const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const found = catalog.find((c) => {
        const n = c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return n === norm || n.includes(norm) || norm.includes(n);
      });
      return found?.id || null;
    },
    [],
  );

  const resolveInspector = useCallback(
    (name: string): string | null => {
      if (!inspectors || !name) return null;
      const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const found = inspectors.find((i) => {
        const n = (i.full_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return n === norm || n.includes(norm) || norm.includes(n);
      });
      return found?.id || null;
    },
    [inspectors],
  );

  const resolveAdjuster = useCallback(
    (name: string): string | null => {
      if (!adjusters || !name) return null;
      const norm = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const found = adjusters.find((a) => {
        const n = (a.full_name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        return n === norm || n.includes(norm) || norm.includes(n);
      });
      return found?.id || null;
    },
    [adjusters],
  );

  const resolveCurrency = useCallback(
    (code: string): string | null => {
      if (!currencies || !code) return null;
      const norm = code.toUpperCase().trim();
      const found = currencies.find((c) => c.code.toUpperCase() === norm || c.name.toUpperCase() === norm);
      return found?.id || null;
    },
    [currencies],
  );

  // ── Validar que los fixedValues de campos de referencia se resuelvan al catálogo ──
  // Si un fixedValue no se encuentra en el catálogo, la fila debe marcarse como inválida
  // en vez de cargarse con el campo en blanco.
  const validateFixedValue = useCallback(
    (fieldKey: string, fv: { value: string; catalogUuid: string | null }): string | null => {
      // Si tiene catalogUuid, verificar que exista en el catálogo correspondiente
      if (fv.catalogUuid) {
        const refField = refFields.find((rf) => rf.fieldKey === fieldKey);
        if (refField) {
          const exists = refField.options.some((o) => o.id === fv.catalogUuid);
          if (!exists) {
            return `Valor fijo de "${refField.label}" no existe en el catálogo (UUID inválido o eliminado)`;
          }
        }
        return null;
      }
      // Si tiene value (texto) sin catalogUuid, intentar resolver por nombre
      if (fv.value) {
        const refField = refFields.find((rf) => rf.fieldKey === fieldKey);
        if (refField) {
          let resolvedId: string | null = null;
          if (fieldKey === "inspector") {
            resolvedId = resolveInspector(fv.value);
          } else if (fieldKey === "adjuster") {
            resolvedId = resolveAdjuster(fv.value);
          } else if (fieldKey === "currency") {
            resolvedId = resolveCurrency(fv.value);
          } else {
            const catalog = refField.options as { id: string; name: string }[];
            resolvedId = resolveByName(catalog, fv.value);
          }
          if (!resolvedId) {
            return `Valor fijo de "${refField.label}" ("${fv.value}") no encontrado en el catálogo`;
          }
        }
      }
      return null;
    },
    [refFields, resolveByName, resolveInspector, resolveAdjuster, resolveCurrency],
  );

  // ── Parsear Excel ──
  const handleFile = useCallback((f: File) => {
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: "" });
      const headers = Object.keys(json[0] || {});
      const learned = (learnedMappings || []).map((m) => ({
        excel_header: m.excel_header,
        field_key: m.field_key,
        times_used: m.times_used,
      })) as LearnedAloClaimFieldMapping[];
      const autoMapping = autoDetectAloClaimMapping(headers, learned);
      setMapping(autoMapping);
      setRawRows(json);
      setStep("preview");
    };
    reader.readAsArrayBuffer(f);
  }, [learnedMappings]);

  // ── Filas parseadas con mapeo aplicado + fixed values ──
  const parsedRows = useMemo(() => {
    return rawRows.map((raw, idx) => {
      const data = applyAloClaimMapping(raw, mapping);
      // Inyectar valores fijos SOLO si el campo no viene del Excel
      for (const [fieldKey, fv] of Object.entries(effectiveFixedValues)) {
        if (!fv.value && !fv.catalogUuid) continue;
        const currentValue = data[fieldKey];
        if (currentValue === undefined || currentValue === null || currentValue === "") {
          if (fv.catalogUuid) {
            data[fieldKey] = fv.catalogUuid;
          } else {
            data[fieldKey] = fv.value;
          }
        }
      }
      const { valid, errors } = validateAloClaimRow(data, mapping);

      // Validar que los fixedValues de campos de referencia se resuelvan al catálogo.
      // Si un fixedValue no se encuentra, la fila debe marcarse como inválida
      // en vez de cargarse con el campo en blanco.
      for (const [fieldKey, fv] of Object.entries(effectiveFixedValues)) {
        if (!fv.value && !fv.catalogUuid) continue;
        const refField = refFields.find((rf) => rf.fieldKey === fieldKey);
        if (!refField) continue; // no es campo de referencia, no validar
        const errMsg = validateFixedValue(fieldKey, fv);
        if (errMsg) {
          errors.push({
            fieldKey,
            fieldLabel: refField.label,
            kind: "invalid_value" as const,
            message: errMsg,
          });
        }
      }

      return { rowNum: idx + 2, data, valid: valid && errors.length === 0, errors };
    });
  }, [rawRows, mapping, effectiveFixedValues, refFields, validateFixedValue]);

  const validRows = parsedRows.filter((r) => r.valid);
  const invalidRows = parsedRows.filter((r) => !r.valid);

  // ── Filas duplicadas (índices) ──
  const duplicateIndices = useMemo(() => new Set(duplicates.map((d) => d.rowIndex)), [duplicates]);

  // ── Filas nuevas (válidas y no duplicadas) ──
  const newRows = useMemo(() => validRows.filter((_, idx) => !duplicateIndices.has(idx)), [validRows, duplicateIndices]);

  // ── Contadores separados para el resumen ──
  const dupByReference = useMemo(() => duplicates.filter((d) => d.reason === "reference_exists").length, [duplicates]);
  const dupByClaimCompany = useMemo(() => duplicates.filter((d) => d.reason === "claim_and_company_exists").length, [duplicates]);
  const totalValid = validRows.length;
  const totalParsed = parsedRows.length;

  // ── Total para verificación de cuadre ──

  // ── Pre-carga a staging (valida duplicados + solo filas nuevas) ──
  const stagingMutation = useMutation({
    mutationFn: async () => {
      if (!tenantCompanyId) throw new Error("No hay empresa seleccionada");

      // 1. Validar duplicados contra la base
      const rowsToCheck = validRows.map((r) => ({
        clientReference: String(r.data.clientReference || ""),
        claimNumber: String(r.data.claimNumber || ""),
        insuranceCompanyId: resolveByName(insuranceCompanies, String(r.data.insuranceCompany || "")),
      }));
      const dups = await checkAloClaimDuplicates(tenantCompanyId, rowsToCheck);
      setDuplicates(dups);

      // 2. Filtrar filas nuevas (no duplicadas)
      const dupIndices = new Set(dups.map((d) => d.rowIndex));
      const rowsToStage = validRows.filter((_, idx) => !dupIndices.has(idx)).map((r) => r.data);

      // 3. Insertar en staging (si hay filas nuevas)
      await cleanStaging(tenantCompanyId);
      if (rowsToStage.length === 0) {
        return [];
      }
      const inserted = await insertStagingRows(tenantCompanyId, rowsToStage);
      return inserted;
    },
    onSuccess: async (data) => {
      setStagingRows(data);
      setStep("staging");
      if (data.length === 0) {
        toast.warning(`No hay casos nuevos para cargar. Todos son duplicados (${duplicates.length} excluidos).`);
        return;
      }
      if (duplicates.length > 0) {
        toast.success(`${data.length} casos nuevos en pre-carga · ${duplicates.length} duplicados excluidos`);
      } else {
        toast.success(`${data.length} casos nuevos en pre-carga`);
      }

      // ── Analizar datos del Excel para auto-sugerir fixed values ──
      // Solo sugerir si no hay fixed values guardados para ese campo
      const suggested: Record<string, { value: string; catalogUuid: string | null }> = {};

      // Analizar todas las filas válidas
      const allData = validRows.map(r => r.data);

      // 1. Línea de negocio: si claimType es "property" y area ≠ "COMERCIAL" → Hogar
      //    Si area es "COMERCIAL" → Comercial
      const hasBusinessLine = allData.some(d => String(d.businessLine || "").trim() !== "");
      if (!hasBusinessLine && businessLines) {
        const tipRie = allData.map(d => String(d.claimType || "").toLowerCase().trim()).filter(Boolean);
        const areas = allData.map(d => String(d.area || "").toLowerCase().trim()).filter(Boolean);
        const esComercial = areas.some(a => a === "comercial");
        const esProperty = tipRie.some(t => t === "property" || t === "propiedad");

        if (esComercial) {
          const bl = businessLines.find(b => b.name.toLowerCase().includes("comercial"));
          if (bl) suggested.businessLine = { value: bl.name, catalogUuid: bl.id };
        } else if (esProperty) {
          const bl = businessLines.find(b => b.name.toLowerCase().includes("hogar"));
          if (bl) suggested.businessLine = { value: bl.name, catalogUuid: bl.id };
        }
      }

      // 2. Evento: si no viene en ninguna fila → "Normal"
      const hasEvent = allData.some(d => String(d.event || "").trim() !== "");
      if (!hasEvent && events) {
        const ev = events.find(e => e.name.toLowerCase().includes("normal"));
        if (ev) suggested.event = { value: ev.name, catalogUuid: ev.id };
      }

      // 3. Corredor: si no viene en ninguna fila → "Sin Elección"
      const hasBroker = allData.some(d => String(d.broker || "").trim() !== "");
      if (!hasBroker && brokers) {
        const br = brokers.find(b => b.name.toLowerCase().includes("sin elecci"));
        if (br) suggested.broker = { value: br.name, catalogUuid: br.id };
      }

      // 4. Inspector: si no viene en ninguna fila → Andrea Celis
      const hasInspector = allData.some(d => String(d.inspector || "").trim() !== "");
      if (!hasInspector && inspectors) {
        const insp = inspectors.find(i => (i.full_name || "").toLowerCase().includes("andrea celis"));
        if (insp) suggested.inspector = { value: insp.full_name || "", catalogUuid: insp.id };
      }

      // 5. Moneda: si no viene → UF (default típico)
      const hasCurrency = allData.some(d => String(d.currency || "").trim() !== "");
      if (!hasCurrency && currencies) {
        const cur = currencies.find(c => c.code.toUpperCase() === "UF");
        if (cur) suggested.currency = { value: cur.code, catalogUuid: cur.id };
      }

      // Solo aplicar sugerencias para campos que NO tienen fixed value guardado
      const savedKeys = new Set((savedFixedValues ?? []).map(fv => fv.field_key));
      const newSuggestions: Record<string, { value: string; catalogUuid: string | null }> = {};
      for (const [k, v] of Object.entries(suggested)) {
        if (!savedKeys.has(k)) {
          newSuggestions[k] = v;
        }
      }
      if (Object.keys(newSuggestions).length > 0) {
        setFixedValues(newSuggestions);
      }

      // Guardar mapeos aprendidos (el usuario ya finalizó sus elecciones)
      if (tenantCompanyId) {
        try {
          const mappingsToSave: Array<{ excelHeader: string; fieldKey: string }> = [];
          for (const field of ALOCLAIM_FIELDS) {
            const m = mapping[field.key];
            if (m && m.excelHeader && m.fieldKey) {
              mappingsToSave.push({ excelHeader: m.excelHeader, fieldKey: m.fieldKey });
            }
          }
          if (mappingsToSave.length > 0) {
            await saveImportFieldMappingsBatch(tenantCompanyId, mappingsToSave);
            queryClient.invalidateQueries({ queryKey: ["import-field-mappings-casos", tenantCompanyId] });
          }
        } catch (err) {
          console.error("Error guardando mapeos aprendidos:", err);
        }
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Carga final: crear claims ──
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!tenantCompanyId) throw new Error("No hay empresa seleccionada");
      const rows = await getStagingRows(tenantCompanyId);
      let success = 0;
      let error = 0;
      const rowErrors: string[] = [];
      const rowWarnings: string[] = [];

      // Obtener estados: "created" (Creación) y "adjustment" (Liquidación)
      const { getLookupCatalog } = await import("@/services/catalogs");
      const statuses = await getLookupCatalog("claim_status");
      const createdStatus = statuses.find((s) => s.code === "created");
      const liquidacionStatus = statuses.find((s) => s.code === "adjustment");
      const createdStatusId = createdStatus?.id || null;
      const liquidacionStatusId = liquidacionStatus?.id || null;

      for (let i = 0; i < rows.length; i++) {
        const staging = rows[i];
        setProgress({ current: i + 1, total: rows.length, success, error });
        try {
          const d = staging.raw_data;

          // Resolver catálogos: si el valor ya es UUID (fixed value), usarlo directo.
          // Si no es UUID, intentar resolver por nombre. Si no se encuentra, usar el fixed value.
          const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
          const fv = effectiveFixedValues;

          const insuranceCompanyId = isUuid(String(d.insuranceCompany || "")) ? String(d.insuranceCompany)
            : resolveByName(insuranceCompanies, String(d.insuranceCompany || "")) || fv.insuranceCompany?.catalogUuid || null;
          const brokerId = isUuid(String(d.broker || "")) ? String(d.broker)
            : resolveByName(brokers, String(d.broker || "")) || fv.broker?.catalogUuid || null;
          const businessLineId = isUuid(String(d.businessLine || "")) ? String(d.businessLine)
            : resolveByName(businessLines, String(d.businessLine || "")) || fv.businessLine?.catalogUuid || null;
          const insuranceProductId = isUuid(String(d.insuranceProduct || "")) ? String(d.insuranceProduct)
            : resolveByName(insuranceProducts, String(d.insuranceProduct || "")) || fv.insuranceProduct?.catalogUuid || null;
          const claimTypeId = isUuid(String(d.claimType || "")) ? String(d.claimType)
            : resolveByName(claimTypes, String(d.claimType || "")) || fv.claimType?.catalogUuid || null;
          const claimCauseId = isUuid(String(d.claimCause || "")) ? String(d.claimCause)
            : resolveByName(claimCauses, String(d.claimCause || "")) || fv.claimCause?.catalogUuid || null;
          const eventId = isUuid(String(d.event || "")) ? String(d.event)
            : resolveByName(events, String(d.event || "")) || fv.event?.catalogUuid || null;
          const currencyId = isUuid(String(d.currency || "")) ? String(d.currency)
            : resolveCurrency(String(d.currency || "")) || fv.currency?.catalogUuid || null;
          const inspectorId = isUuid(String(d.inspector || "")) ? String(d.inspector)
            : resolveInspector(String(d.inspector || "")) || fv.inspector?.catalogUuid || null;
          const adjusterId = isUuid(String(d.adjuster || "")) ? String(d.adjuster)
            : resolveAdjuster(String(d.adjuster || "")) || fv.adjuster?.catalogUuid || null;

          // Resolver destination_housing_id desde el tipo de riesgo:
          // "property" → Habitacional, "comercial" → Comercial
          const tipRie = String(d.claimType || "").toLowerCase().trim();
          const targetDest = tipRie === "comercial" ? "Comercial" : tipRie === "property" || tipRie === "propiedad" ? "Habitacional" : null;
          const destinationHousingId = targetDest
            ? resolveByName(housingDestinations, targetDest)
            : null;

          const { claim, warnings } = await createClaimFromAloClaim({
            clientReference: String(d.clientReference || ""),
            claimNumber: String(d.claimNumber || ""),
            policyNumber: String(d.policyNumber || ""),
            insuranceCompanyId,
            brokerId,
            insuredName: String(d.insuredName || ""),
            lastName: String(d.lastName || ""),
            rut: String(d.rut || ""),
            insuredAddress: String(d.insuredAddress || d.address || ""),
            insuredCountry: String(d.country || d.insuredCountry || ""),
            insuredRegion: String(d.region || d.insuredRegion || ""),
            insuredCity: String(d.city || d.insuredCity || ""),
            insuredCommune: String(d.commune || d.insuredCommune || ""),
            insuredPhone: String(d.insuredPhone || d.cellPhone || ""),
            insuredEmail: String(d.insuredEmail || ""),
            claimAddress: String(d.claimAddress || ""),
            claimCountry: String(d.claimCountry || ""),
            claimRegion: String(d.claimRegion || ""),
            claimCity: String(d.claimCity || ""),
            claimCommune: String(d.claimCommune || ""),
            businessLineId,
            insuranceProductId,
            claimTypeId,
            claimType: String(d.claimType || ""),
            inspectorId,
            adjusterId,
            eventId,
            summary: String(d.summary || ""),
            currencyId,
            policyCurrencyId: currencyId,
            claimDate: String(d.claimDate || ""),
            reportDate: String(d.reportDate || ""),
            assignmentDate: String(d.assignmentDate || ""),
            policyPremium: String(d.policyPremium || ""),
            policyStartDate: String(d.policyStartDate || ""),
            policyEndDate: String(d.policyEndDate || ""),
            claimCauseId,
            companyId: tenantCompanyId,
            statusId: createdStatusId,
            destinationHousingId,
            constructionTypeId: null,
            isHabitable: String(d.isHabitable || "").toLowerCase().startsWith("y") || String(d.isHabitable || "").toLowerCase().startsWith("s") ? true : String(d.isHabitable || "").toLowerCase().startsWith("n") ? false : null,
            ownerSameAsInsured: String(d.ownerSameAsInsured || "").toLowerCase().startsWith("y") || String(d.ownerSameAsInsured || "").toLowerCase().startsWith("s") ? true : String(d.ownerSameAsInsured || "").toLowerCase().startsWith("n") ? false : null,
            contractorRut: String(d.contractorRut || d.rut || ""),
            contractorName: String(d.contractorName || d.insuredName || ""),
            contractorLastName: String(d.contractorLastName || d.lastName || ""),
            contractorEmail: String(d.contractorEmail || d.insuredEmail || ""),
            contractorPhone: String(d.contractorPhone || d.insuredPhone || ""),
            contractorCellPhone: String(d.contractorCellPhone || d.contractorPhone || d.insuredPhone || ""),
            contractorAddress: String(d.contractorAddress || d.insuredAddress || d.address || ""),
            contractorCountry: String(d.contractorCountry || d.country || d.insuredCountry || ""),
            contractorRegion: String(d.contractorRegion || d.region || d.insuredRegion || ""),
            contractorCity: String(d.contractorCity || d.city || d.insuredCity || ""),
            contractorCommune: String(d.contractorCommune || d.commune || d.insuredCommune || ""),
            beneficiaryRut: String(d.beneficiaryRut || d.rut || ""),
            beneficiaryName: String(d.beneficiaryName || d.insuredName || ""),
            beneficiaryLastName: String(d.beneficiaryLastName || d.lastName || ""),
            beneficiaryEmail: String(d.beneficiaryEmail || d.insuredEmail || ""),
            beneficiaryPhone: String(d.beneficiaryPhone || d.insuredPhone || ""),
            beneficiaryCellPhone: String(d.beneficiaryCellPhone || d.beneficiaryPhone || d.insuredPhone || ""),
            beneficiaryAddress: String(d.beneficiaryAddress || d.insuredAddress || d.address || ""),
            beneficiaryCountry: String(d.beneficiaryCountry || d.country || d.insuredCountry || ""),
            beneficiaryRegion: String(d.beneficiaryRegion || d.region || d.insuredRegion || ""),
            beneficiaryCity: String(d.beneficiaryCity || d.city || d.insuredCity || ""),
            beneficiaryCommune: String(d.beneficiaryCommune || d.commune || d.insuredCommune || ""),
          });

          // Cambiar a "Liquidación" (adjustment) para disparar el workflow
          if (liquidacionStatusId && liquidacionStatusId !== createdStatusId) {
            const { getSupabaseClient } = await import("@/lib/supabase/client");
            await getSupabaseClient()
              .from("claims")
              .update({ status_id: liquidacionStatusId })
              .eq("id", claim.id);
          }

          await markStagingImported(staging.id, claim.id);
          rowWarnings.push(...warnings.map(w => `Fila ${i + 1} (ref ${String((staging.raw_data as { clientReference?: string }).clientReference || "-")}): ${w}`));
          success++;
        } catch (err) {
          const msg = (err as Error).message;
          await markStagingError(staging.id, msg);
          rowErrors.push(`Fila ${i + 1} (ref ${String((staging.raw_data as { clientReference?: string }).clientReference || "-")}): ${msg}`);
          error++;
        }
        setProgress({ current: i + 1, total: rows.length, success, error });
      }

      setProgressErrors(rowErrors);
      setProgressWarnings(rowWarnings);
      return { success, error };
    },
    onSuccess: async ({ success, error }) => {
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["claims"] });

      // Guardar log + fixed values
      if (tenantCompanyId) {
        try {
          // Guardar fixed values
          const fixedValuesToSave: Array<{ fieldKey: string; fixedValue: string | null; catalogUuid: string | null }> = [];
          for (const [fieldKey, fv] of Object.entries(effectiveFixedValues)) {
            if (fv.value || fv.catalogUuid) {
              fixedValuesToSave.push({
                fieldKey,
                fixedValue: fv.value || null,
                catalogUuid: fv.catalogUuid || null,
              });
            }
          }
          if (fixedValuesToSave.length > 0) {
            await saveImportFixedValuesBatch(tenantCompanyId, fixedValuesToSave);
            queryClient.invalidateQueries({ queryKey: ["import-fixed-values-casos", tenantCompanyId] });
          }

          await createImportLog(tenantCompanyId, {
            userId: profile?.id || null,
            fileName: file?.name || null,
            totalRows: parsedRows.length,
            importedRows: success,
            errorRows: error,
            liquidationNumbers: [],
            fieldMappingsUsed: Object.fromEntries(
              Object.entries(mapping).map(([k, v]) => [k, { excelHeader: v.excelHeader, fieldKey: v.fieldKey }])
            ),
          });
        } catch (err) {
          console.error("Error guardando import log:", err);
        }
      }

      if (error > 0) {
        toast.warning(`${success} siniestros cargados, ${error} con errores`);
      } else {
        toast.success(`${success} siniestros cargados correctamente`);
      }
    },
    onError: (err: Error) => {
      setIsProcessing(false);
      setStep("staging");
      setProgressErrors((prev) => [...prev, err.message]);
      toast.error(err.message);
    },
  });

  const reset = () => {
    setFile(null);
    setRawRows([]);
    setMapping({});
    setStagingRows([]);
    setDuplicates([]);
    setStep("upload");
    setProgress({ current: 0, total: 0, success: 0, error: 0 });
    setProgressErrors([]);
    setProgressWarnings([]);
  };

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon icn-amber">
            <Upload />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Carga AloClaim</h1>
          </div>
        </div>
      </div>

      <div className="app-panel">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 text-xs">
          <span className={step === "upload" ? "font-bold text-amber-500" : "text-muted-foreground"}>1. Subir Excel</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className={step === "preview" ? "font-bold text-amber-500" : "text-muted-foreground"}>2. Revisar</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className={step === "staging" ? "font-bold text-amber-500" : "text-muted-foreground"}>3. Pre-carga</span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span className={step === "done" ? "font-bold text-emerald-500" : "text-muted-foreground"}>4. Carga final</span>
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className={`rounded-lg border-2 border-dashed p-12 text-center transition-colors ${isDragging ? "border-amber-500 bg-amber-500/5" : "border-border"}`}
          >
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="app-body text-muted-foreground mb-2">Arrastra el Excel de AloClaim aquí</p>
            <p className="text-xs text-muted-foreground mb-4">o</p>
            <label>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <span className="pg-btn-platinum inline-flex items-center gap-2 cursor-pointer px-4 py-2 rounded-md text-sm">
                <Upload className="h-4 w-4" />
                Seleccionar
              </span>
            </label>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="app-body font-medium">{file?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {totalParsed} filas · {totalValid} válidas · {invalidRows.length} con errores
                </p>
              </div>
              <Button variant="outline" size="sm" className="pg-btn-platinum" onClick={reset}>
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>

            {/* Resumen de cuadre */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <h3 className="app-section-title mb-3">Resumen de cuadre</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Ref. existentes</p>
                    <p className="font-mono font-bold text-amber-500">{dupByReference}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Siniestro + Cía</p>
                    <p className="font-mono font-bold text-amber-500">{dupByClaimCompany}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Casos nuevos</p>
                    <p className="font-mono font-bold text-emerald-500">{newRows.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total válidos</p>
                    <p className="font-mono font-bold">
                      {dupByReference + dupByClaimCompany + newRows.length}
                      {dupByReference + dupByClaimCompany + newRows.length === totalValid ? (
                        <CheckCircle className="inline h-3 w-3 text-emerald-500 ml-1" />
                      ) : (
                        <AlertCircle className="inline h-3 w-3 text-rose-500 ml-1" />
                      )}
                    </p>
                  </div>
                </div>
                {dupByReference + dupByClaimCompany + newRows.length !== totalValid && (
                  <p className="text-xs text-rose-500 mt-2">
                    El cuadre no cierra: {dupByReference} + {dupByClaimCompany} + {newRows.length} = {dupByReference + dupByClaimCompany + newRows.length} ≠ {totalValid}
                  </p>
                )}
              </div>
            )}

            {/* Mapeo de columnas */}
            <div className="rounded-lg border border-border p-4">
              <h3 className="app-section-title mb-3">Mapeo de columnas</h3>
              <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 mb-3">
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  <span className="font-medium">Asociación automática:</span> el campo <span className="font-mono">Tipo Riesgo</span> se asociará al Tipo de dirección del siniestro:
                  <span className="font-mono"> property</span> → Habitacional,
                  <span className="font-mono"> comercial</span> → Comercial.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                {ALOCLAIM_FIELDS.map((field) => {
                  const m = mapping[field.key];
                  // Headers ya asignados a otros campos (no ofrecerlos)
                  const assignedHeaders = new Set(
                    Object.values(mapping)
                      .filter((v) => v.fieldKey && v.fieldKey !== field.key)
                      .map((v) => v.excelHeader)
                  );
                  return (
                    <div key={field.key} className="flex items-center gap-2 text-xs">
                      <span className="font-medium w-32 shrink-0">{field.label}</span>
                      <span className="text-muted-foreground">←</span>
                      <select
                        value={m?.excelHeader || ""}
                        onChange={(e) => {
                          setMapping((prev) => ({
                            ...prev,
                            [field.key]: {
                              fieldKey: field.key,
                              excelHeader: e.target.value,
                              autoDetected: false,
                              confidence: 1,
                            },
                          }));
                        }}
                        className="app-input flex-1 text-xs h-7"
                      >
                        <option value="">— Sin mapear —</option>
                        {Object.keys(rawRows[0] || {}).map((h) => {
                          // Mostrar el header si: es el actual de este campo O no está asignado a otro
                          const isCurrent = m?.excelHeader === h;
                          const isAssigned = assignedHeaders.has(h);
                          if (isAssigned && !isCurrent) return null;
                          return (
                            <option key={h} value={h}>{h}</option>
                          );
                        })}
                      </select>
                      {m?.autoDetected && m?.confidence === 1 && (
                        <CheckCircle className="h-3 w-3 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Errores */}
            {invalidRows.length > 0 && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  <span className="text-sm font-medium text-rose-500">
                    {invalidRows.length} filas con errores (no se cargarán)
                  </span>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {invalidRows.slice(0, 20).map((r) => (
                    <div key={r.rowNum} className="text-xs text-muted-foreground">
                      <span className="font-mono">Fila {r.rowNum}:</span>{" "}
                      {r.errors.map((e) => e.message).join("; ")}
                    </div>
                  ))}
                  {invalidRows.length > 20 && (
                    <p className="text-xs text-muted-foreground">... y {invalidRows.length - 20} más</p>
                  )}
                </div>
              </div>
            )}

            {/* Duplicados */}
            {duplicates.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Copy className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-500">
                    {duplicates.length} casos duplicados (no se cargarán)
                  </span>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {duplicates.slice(0, 20).map((d, i) => (
                    <div key={i} className="text-xs text-muted-foreground">
                      <span className="font-mono">Fila {d.rowIndex + 2}:</span>{" "}
                      <span className="text-amber-600">
                        {d.reason === "reference_exists"
                          ? `Referencia ${d.clientReference} ya existe`
                          : `Siniestro ${d.claimNumber} ya existe para la misma compañía`}
                      </span>
                    </div>
                  ))}
                  {duplicates.length > 20 && (
                    <p className="text-xs text-muted-foreground">... y {duplicates.length - 20} más</p>
                  )}
                </div>
              </div>
            )}

            {/* Preview de primeras filas válidas */}
            {validRows.length > 0 && (
              <div className="rounded-lg border border-border overflow-hidden">
                <p className="text-xs font-medium p-3 border-b border-border">
                  Preview ({Math.min(5, newRows.length)} de {newRows.length} filas nuevas)
                </p>
                <div className="overflow-x-auto max-h-60">
                  <table className="app-data-table">
                    <thead>
                      <tr>
                        <th>Ref</th>
                        <th>Siniestro</th>
                        <th>Asegurado</th>
                        <th>Comuna</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newRows.slice(0, 5).map((r) => (
                        <tr key={r.rowNum}>
                          <td className="text-[11px] font-mono">{String(r.data.clientReference || "—")}</td>
                          <td className="text-[11px] font-mono">{String(r.data.claimNumber || "—")}</td>
                          <td className="text-[11px]">{String(r.data.insuredName || "—")} {String(r.data.lastName || "")}</td>
                          <td className="text-[11px]">{String(r.data.commune || "—")}</td>
                          <td className="text-[11px]">{String(r.data.claimDate || "—")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {canCreate("operaciones") && validRows.length > 0 && (
              <div className="flex items-center justify-between gap-2">
                {/* Mensajes a la izquierda */}
                <div className="flex-1">
                  {stagingMutation.isError && (
                    <p className="text-xs text-rose-500">
                      {(stagingMutation.error as Error)?.message}
                    </p>
                  )}
                </div>

            {/* Valores fijos (defaults para campos que no vienen en el Excel) */}
            {!isProcessing && (
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <SlidersHorizontal className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-semibold">Valores fijos</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Setea defaults para campos que NO vienen en el Excel. Se guardan para futuras importaciones.
                </p>

                <div className="bulk-fixed-values-list">
                  {Object.entries(effectiveFixedValues).length > 0 && (
                    <div className="bulk-fixed-values-existing">
                      {Object.entries(effectiveFixedValues).map(([fk, fv]) => {
                        const refField = refFields.find((rf) => rf.fieldKey === fk);
                        const field = ALOCLAIM_FIELDS.find((f) => f.key === fk);
                        const displayValue = refField && fv.catalogUuid
                          ? (refField.options.find((o) => o.id === fv.catalogUuid)?.name || fv.value)
                          : fv.value;
                        return (
                          <div key={fk} className="bulk-fixed-value-item">
                            <span className="bulk-fixed-value-label">{field?.label || fk}</span>
                            <span className="bulk-fixed-value-val">{displayValue || "—"}</span>
                            <button
                              className="bulk-fixed-value-remove"
                              onClick={() => {
                                setFixedValues((prev) => {
                                  const next = { ...prev };
                                  delete next[fk];
                                  return next;
                                });
                                if (tenantCompanyId) {
                                  import("@/services/import-mappings").then(({ deleteImportFixedValue }) =>
                                    deleteImportFixedValue(tenantCompanyId, fk)
                                  );
                                  queryClient.invalidateQueries({ queryKey: ["import-fixed-values-casos", tenantCompanyId] });
                                }
                              }}
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
                        const refField = refFields.find((rf) => rf.fieldKey === fk);
                        if (refField) {
                          setPendingFixedField(fk);
                        }
                      }}
                    >
                      <SelectTrigger className="bulk-fixed-values-select">
                        <SelectValue placeholder="— Agregar valor fijo —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Seleccionar campo —</SelectItem>
                        {refFields
                          .filter((rf) => !(rf.fieldKey in effectiveFixedValues))
                          .map((rf) => (
                            <SelectItem key={rf.fieldKey} value={rf.fieldKey}>{rf.label}</SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {pendingFixedField && (() => {
                    const refField = refFields.find((rf) => rf.fieldKey === pendingFixedField);
                    if (!refField) return null;
                    return (
                      <div className="bulk-fixed-values-picker">
                        <Select
                          value=""
                          onValueChange={(uuid) => {
                            if (!uuid || uuid === "__none__") {
                              setPendingFixedField(null);
                              return;
                            }
                            const opt = refField.options.find((o) => o.id === uuid);
                            setFixedValues((prev) => ({
                              ...prev,
                              [pendingFixedField]: { value: opt?.name || "", catalogUuid: uuid },
                            }));
                            setPendingFixedField(null);
                          }}
                        >
                          <SelectTrigger className="bulk-fixed-values-select">
                            <SelectValue placeholder={`Seleccionar ${refField.label}`} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Cancelar —</SelectItem>
                            {refField.options.map((o) => (
                              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

                {/* Botón fijo a la derecha */}
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="pg-btn-platinum"
                    disabled={stagingMutation.isPending}
                    onClick={() => stagingMutation.mutate()}
                  >
                    {stagingMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Pre-cargando...</>
                    ) : (
                      <>Pre-cargar</>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Staging — pre-carga lista, confirmar carga final */}
        {step === "staging" && (
          <div className="space-y-4">
            {/* Resumen de cuadre */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h3 className="app-section-title mb-3">Resumen de cuadre</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Ref. existentes</p>
                  <p className="font-mono font-bold text-amber-500">{dupByReference}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Siniestro + Cía</p>
                  <p className="font-mono font-bold text-amber-500">{dupByClaimCompany}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Casos nuevos</p>
                  <p className="font-mono font-bold text-emerald-500">{stagingRows.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total válidos</p>
                  <p className="font-mono font-bold">
                    {dupByReference + dupByClaimCompany + stagingRows.length}
                    {dupByReference + dupByClaimCompany + stagingRows.length === totalValid ? (
                      <CheckCircle className="inline h-3 w-3 text-emerald-500 ml-1" />
                    ) : (
                      <AlertCircle className="inline h-3 w-3 text-rose-500 ml-1" />
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Alerta de personas jurídicas (RUT >= 60 millones) */}
            {(() => {
              const legalRows = stagingRows.filter(sr => {
                const rut = String(sr.raw_data?.rut || "");
                const num = rutBodyNumber(rut);
                return num !== null && num >= 60_000_000;
              });
              if (legalRows.length === 0) return null;
              return (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    <span className="text-sm font-medium text-amber-600">
                      {legalRows.length} caso(s) con RUT mayor a 60 millones (persona jurídica)
                    </span>
                  </div>
                  <div className="space-y-1">
                    {legalRows.map((sr, idx) => {
                      const rut = String(sr.raw_data?.rut || "");
                      const nombre = String(sr.raw_data?.insuredName || "") + " " + String(sr.raw_data?.lastName || "");
                      return (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-amber-600">{rut}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-medium">{nombre.trim()}</span>
                          <Tooltip>
                            <TooltipTrigger className="text-amber-500 cursor-help underline decoration-dotted">
                              (razón social)
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p>El nombre se copiará como razón social.</p>
                              <p>person_type = legal (empresa)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
                <span className="text-sm font-medium">
                  {stagingRows.length} filas en pre-carga listas para confirmar
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Al confirmar, se crearán los siniestros con toda la lógica inteligente:
                nombre separado, jerarquía de ubicación, replicación de participantes y póliza SIN NUMERO si aplica.
              </p>
            </div>

            {isProcessing && (
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Procesando...</span>
                  <span className="text-xs text-muted-foreground">
                    {progress.current} / {progress.total} · {progress.success} ok · {progress.error} error
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" size="sm" className="pg-btn-platinum" onClick={reset} disabled={isProcessing}>
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              {canCreate("operaciones") && stagingRows.length > 0 && (
                <Button
                  size="sm"
                  className="pg-btn-platinum"
                  disabled={confirmMutation.isPending}
                  onClick={() => {
                    setIsProcessing(true);
                    confirmMutation.mutate();
                  }}
                >
                  {confirmMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</>
                  ) : (
                    <>Confirmar</>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === "done" && (
          <div className="text-center py-12">
            <CheckCircle className="h-16 w-16 mx-auto text-emerald-500 mb-4" />
            <h2 className="app-section-title mb-2">Carga completada</h2>
            <p className="app-body text-muted-foreground mb-6">
              {progress.success} siniestros cargados correctamente
              {progress.error > 0 && ` · ${progress.error} con errores`}
            </p>
            {progressWarnings.length > 0 && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-6 text-left">
                <p className="text-sm font-medium text-amber-600 mb-2">Advertencias / inconsistencias:</p>
                <div className="space-y-1 max-h-60 overflow-y-auto text-xs text-amber-600">
                  {progressWarnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              </div>
            )}
            {progressErrors.length > 0 && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 mb-6 text-left">
                <p className="text-sm font-medium text-rose-600 mb-2">Errores:</p>
                <div className="space-y-1 max-h-60 overflow-y-auto text-xs text-rose-600">
                  {progressErrors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              </div>
            )}
            <Button size="sm" className="pg-btn-platinum" onClick={reset}>
              Recargar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
