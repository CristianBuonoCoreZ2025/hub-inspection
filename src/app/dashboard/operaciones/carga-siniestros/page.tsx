"use client";

import { useState, useCallback, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createClaimMinimal } from "@/services/claims";
import {
  getInsuranceCompanies, getClaimTypes, getClaimCauses, getBusinessLines,
  getCurrencies, getHousingDestinations, getDamageClassifications, getLookupCatalog,
} from "@/services/catalogs";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2, ArrowRight, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/hooks/use-permissions";
import * as XLSX from "xlsx";
import {
  CLAIM_FIELDS,
  REQUIRED_FIELDS,
  autoDetectMapping,
  applyMappingToRow,
  validateRowWithMapping,
  type ColumnMapping,
  type ParsedRow,
  type RowError,
} from "@/lib/claim-import/schema";

interface ExcelRow {
  [key: string]: string | number | null;
}

type Step = "upload" | "review";

export default function CargaSiniestrosPage() {
  const { canCreate } = usePermissions();
  const { profile } = useAuth();
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

  // Normalización simple: lowercase + sin acentos + sin espacios extra
  const normalizeName = (s: string): string => {
    return s
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  // Mapas nombre (normalizado) → UUID
  const buildMap = useCallback((items: { id: string; name: string }[] | undefined) => {
    const map = new Map<string, string>();
    for (const c of items ?? []) map.set(normalizeName(c.name), c.id);
    return map;
  }, []);

  const insuranceCompanyMap = useMemo(() => buildMap(insuranceCompanies), [buildMap, insuranceCompanies]);
  const claimTypeMap = useMemo(() => buildMap(claimTypes), [buildMap, claimTypes]);
  const claimCauseMap = useMemo(() => buildMap(claimCauses), [buildMap, claimCauses]);
  const businessLineMap = useMemo(() => buildMap(businessLines), [buildMap, businessLines]);
  const currencyMap = useMemo(() => buildMap(currencies), [buildMap, currencies]);
  const housingDestinationMap = useMemo(() => buildMap(housingDestinations), [buildMap, housingDestinations]);
  const damageClassificationMap = useMemo(() => buildMap(damageClassifications), [buildMap, damageClassifications]);
  const claimStatusMap = useMemo(() => buildMap(claimStatuses), [buildMap, claimStatuses]);

  // Tenant (company_id) del usuario logueado — NO se pide en el Excel
  const tenantCompanyId = profile?.company_id || null;

  // ── Resolver texto → UUID para campos de referencia ──
  // Orden: 1) UUID directo, 2) mapeo manual del usuario, 3) match exacto normalizado
  const resolveRefId = useCallback(
    (fieldKey: string, value: string, catalogMap: Map<string, string>): string | null => {
      if (!value) return null;
      const trimmed = value.trim();
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
        return trimmed;
      }
      const manualKey = `${fieldKey}::${trimmed}`;
      if (valueMappings[manualKey]) return valueMappings[manualKey];
      return catalogMap.get(normalizeName(trimmed)) || null;
    },
    [valueMappings]
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
  ], [
    resolveInsuranceCompanyId, resolveClaimTypeId, resolveClaimCauseId, resolveStatusId,
    resolveBusinessLineId, resolveCurrencyId, resolveDestinationHousingId, resolveDamageClassificationId,
    insuranceCompanies, claimTypes, claimCauses, claimStatuses, businessLines, currencies,
    housingDestinations, damageClassifications,
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

  // ── Parsed rows: estado derivado de mapping + rawRows + valueMappings ──
  const parsedRows = useMemo<ParsedRow[]>(() => {
    if (rawRows.length === 0) return [];
    return rawRows.map((raw, idx) => {
      const data = applyMappingToRow(raw, mapping);
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
  }, [rawRows, mapping, refFields]);

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
        const autoMapping = autoDetectMapping(headers);

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
  }, []);

  // ── Cambiar el mapeo de un campo ──
  const handleFieldMappingChange = (fieldKey: string, excelHeader: string | null) => {
    const header = excelHeader || "__none__";
    setMapping((prev) => {
      const next = { ...prev };

      // Si el header nuevo ya estaba asignado a otro campo, quitarlo de ahí
      if (header !== "__none__") {
        for (const [k, m] of Object.entries(next)) {
          if (k !== fieldKey && m?.excelHeader === header) {
            next[k] = { ...m, fieldKey: null, excelHeader: "", autoDetected: false, confidence: 0 };
          }
        }
      }

      next[fieldKey] = {
        fieldKey: header === "__none__" ? null : fieldKey,
        excelHeader: header === "__none__" ? "" : header,
        autoDetected: false,
        confidence: 1,
      };

      return next;
    });
  };

  // ── Cargar siniestros al backend ──
  const loadMutation = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      if (!tenantCompanyId) {
        throw new Error("No se pudo determinar la empresa (tenant) del usuario. Vuelve a iniciar sesión.");
      }
      setIsUploading(true);
      setProgress({ current: 0, total: rows.length, success: 0, error: 0 });
      const validRows = rows.filter((r) => r.valid);
      let success = 0;
      let error = 0;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          const d = row.data;
          const str = (v: unknown) => (v ? String(v) : "");
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

          // Resolver campos de referencia (UUID) — solo si hay valor
          const insuranceCompanyId = str(d.insuranceCompany) ? resolveInsuranceCompanyId(str(d.insuranceCompany)) : null;
          if (str(d.insuranceCompany) && !insuranceCompanyId) {
            throw new Error(`Aseguradora "${d.insuranceCompany}" no encontrada.`);
          }
          const claimTypeId = str(d.claimType) ? resolveClaimTypeId(str(d.claimType)) : null;
          if (str(d.claimType) && !claimTypeId) {
            throw new Error(`Tipo de siniestro "${d.claimType}" no encontrado.`);
          }
          const claimCauseId = str(d.claimCause) ? resolveClaimCauseId(str(d.claimCause)) : null;
          const statusId = str(d.status) ? resolveStatusId(str(d.status)) : null;
          const businessLineId = str(d.businessLine) ? resolveBusinessLineId(str(d.businessLine)) : null;
          const currencyId = str(d.currency) ? resolveCurrencyId(str(d.currency)) : null;
          const destinationHousingId = str(d.destination) ? resolveDestinationHousingId(str(d.destination)) : null;
          const damageClassificationId = str(d.damageClassification) ? resolveDamageClassificationId(str(d.damageClassification)) : null;

          await createClaimMinimal(
            {
              claimNumber: str(d.claimNumber),
              policyNumber: str(d.policyNumber),
              claimDate: str(d.claimDate),
              summary: str(d.summary) || null,
              reportDate: str(d.reportDate) || null,
              assignmentDate: str(d.assignmentDate) || null,
              company_id: tenantCompanyId,
              insuranceCompanyId,
              claimTypeId,
              claimCauseId,
              statusId,
              businessLineId,
              currencyId,
              destinationHousingId,
              damageClassificationId,
              ownerSameAsInsured: bool(d.ownerSameAsInsured),
              // Campos nuevos de póliza
              policyItem: str(d.policyItem) || null,
              policyStartDate: str(d.policyStartDate) || null,
              policyEndDate: str(d.policyEndDate) || null,
              policyAmount: num(d.policyAmount),
              policyPremium: num(d.policyPremium),
              internalNumber: str(d.internalNumber) || null,
              isSpecialClaim: bool(d.isSpecialClaim),
              brokerExecutive: str(d.brokerExecutive) || null,
            },
            {
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
            },
            {
              claimAddress: str(d.address),
              claimCountry: str(d.country) || null,
              claimRegion: str(d.region) || null,
              claimCity: str(d.city),
              claimCommune: str(d.commune) || null,
            },
            null, // contractor
            str(d.beneficiaryName) ? {
              beneficiaryName: str(d.beneficiaryName),
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
            } : null,
            (str(d.contactEmail) || str(d.contactPhone)) ? {
              contactEmail: str(d.contactEmail) || null,
              contactPhone: str(d.contactPhone) || null,
            } : null
          );
          success++;
        } catch (err) {
          error++;
          console.error(`Fila ${row.rowNum}:`, err);
        }
        setProgress({ current: i + 1, total: validRows.length, success, error });
      }

      setIsUploading(false);
      return { success, error, total: validRows.length };
    },
    onSuccess: (result) => {
      toast.success(`Carga completada: ${result.success} exitosos, ${result.error} errores`);
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
            <X className="mr-1.5 h-3.5 w-3.5" /> Empezar de nuevo
          </Button>
        )}
      </div>

      {/* Drop Zone — solo visible en step upload */}
      {step === "upload" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
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
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Cargando...</>
                ) : (
                  <><Upload className="mr-2 h-3.5 w-3.5" /> Cargar {validCount} siniestros</>
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

                {/* Tabla de mapeo campo → columna */}
                <div className="bulk-mapper-table-wrap">
                  <table className="bulk-mapper-table">
                    <thead>
                      <tr>
                        <th className="bulk-mapper-th-field">Campo del sistema</th>
                        <th className="bulk-mapper-th-arrow"></th>
                        <th className="bulk-mapper-th-column">Columna del Excel</th>
                        <th className="bulk-mapper-th-status">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CLAIM_FIELDS.map((field) => {
                        const m = mapping[field.key];
                        const isMapped = m?.fieldKey && m?.excelHeader;
                        const confidence = m?.confidence ?? 0;
                        const isLowConfidence = isMapped && confidence < 1 && m?.autoDetected;

                        return (
                          <tr key={field.key} className={field.required ? "bulk-mapper-row-required" : ""}>
                            <td className="bulk-mapper-td-field">
                              <div className="bulk-mapper-field-info">
                                <span className="bulk-mapper-field-label">{field.label}</span>
                                {field.required && <span className="bulk-mapper-required-badge">Requerido</span>}
                                {field.description && (
                                  <span className="bulk-mapper-field-desc">{field.description}</span>
                                )}
                              </div>
                            </td>
                            <td className="bulk-mapper-td-arrow">
                              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                            </td>
                            <td className="bulk-mapper-td-column">
                              <Select
                                value={m?.excelHeader || "__none__"}
                                onValueChange={(val) => handleFieldMappingChange(field.key, val)}
                              >
                                <SelectTrigger className="bulk-mapper-select">
                                  <SelectValue placeholder="— Sin mapear —" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">— Sin mapear —</SelectItem>
                                  {excelHeaders.map((h) => {
                                    const usedByField = usedHeaders.get(h);
                                    const usedByOther = usedByField && usedByField !== field.key;
                                    const usedLabel = usedByOther
                                      ? CLAIM_FIELDS.find((f) => f.key === usedByField)?.label
                                      : null;
                                    return (
                                      <SelectItem
                                        key={h}
                                        value={h}
                                        disabled={!!usedByOther}
                                        className={usedByOther ? "bulk-mapper-option-used" : ""}
                                      >
                                        {h}
                                        {usedLabel && ` (asignada a: ${usedLabel})`}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="bulk-mapper-td-status">
                              {!isMapped && field.required && (
                                <span className="bulk-mapper-status-pill bulk-mapper-status-pill-error">
                                  Falta mapear
                                </span>
                              )}
                              {!isMapped && !field.required && (
                                <span className="bulk-mapper-status-pill bulk-mapper-status-pill-neutral">
                                  Opcional
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
