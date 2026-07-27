"use client";

import { useState, useCallback, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClaim } from "@/services/claims";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2, ArrowRight, SlidersHorizontal } from "lucide-react";
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

type Step = "upload" | "mapping" | "preview";

export default function CargaSiniestrosPage() {
  const { canCreate } = usePermissions();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, error: 0 });
  const [isUploading, setIsUploading] = useState(false);

  // Estado del flujo de importación
  const [step, setStep] = useState<Step>("upload");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<ExcelRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, ColumnMapping>>({});
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  // ── Aplicar mapeo + validar ──
  const applyMappingAndValidate = (
    activeMapping: Record<string, ColumnMapping>,
    rows: ExcelRow[]
  ) => {
    const parsed: ParsedRow[] = rows.map((raw, idx) => {
      const data = applyMappingToRow(raw, activeMapping);
      const { valid, errors } = validateRowWithMapping(data, activeMapping);
      return { rowNum: idx + 2, data, valid, errors };
    });
    setParsedRows(parsed);
  };

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
        setParsedRows([]);

        // Verificar si hay campos requeridos sin mapear
        const missingRequired = REQUIRED_FIELDS.filter(
          (field) => !autoMapping[field.key]?.fieldKey
        );

        if (missingRequired.length > 0) {
          setStep("mapping");
          toast.info(
            `Detectamos ${missingRequired.length} campo(s) requerido(s) sin mapear. Revisa el mapeo de columnas.`
          );
        } else {
          // Todo mapeado, ir directo a preview
          applyMappingAndValidate(autoMapping, jsonData);
          setStep("preview");
          toast.success(`${jsonData.length} filas parseadas`);
        }
      } catch (err) {
        toast.error("Error al leer el archivo Excel");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

  // ── Confirmar mapeo manual ──
  const handleConfirmMapping = () => {
    const missingRequired = REQUIRED_FIELDS.filter(
      (field) => !mapping[field.key]?.fieldKey || !mapping[field.key]?.excelHeader
    );
    if (missingRequired.length > 0) {
      toast.error(
        `Faltan mapear ${missingRequired.length} campo(s) requerido(s): ${missingRequired
          .map((f) => f.label)
          .join(", ")}`
      );
      return;
    }
    applyMappingAndValidate(mapping, rawRows);
    setStep("preview");
    toast.success("Mapeo confirmado. Revisa el preview antes de cargar.");
  };

  // ── Cambiar el mapeo de un campo ──
  const handleFieldMappingChange = (fieldKey: string, excelHeader: string | null) => {
    const header = excelHeader || "__none__";
    setMapping((prev) => {
      const next = { ...prev };

      // Liberar el header que tenía este campo antes
      const prevMapping = next[fieldKey];
      if (prevMapping?.excelHeader) {
        // Si el header que se libera era usado por este campo, ya no lo usa
      }

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
      setIsUploading(true);
      setProgress({ current: 0, total: rows.length, success: 0, error: 0 });
      const validRows = rows.filter((r) => r.valid);
      let success = 0;
      let error = 0;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          await createClaim(row.data as Parameters<typeof createClaim>[0]);
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

  const handleReset = () => {
    setFile(null);
    setParsedRows([]);
    setRawRows([]);
    setExcelHeaders([]);
    setMapping({});
    setStep("upload");
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

      {/* ── Step: Mapeo de columnas ── */}
      {step === "mapping" && (
        <div className="bulk-mapper-panel">
          <div className="bulk-mapper-header">
            <div className="bulk-mapper-header-left">
              <SlidersHorizontal className="h-5 w-5 text-primary" />
              <div>
                <h2 className="bulk-mapper-title">Mapeo de columnas</h2>
                <p className="bulk-mapper-subtitle">
                  Asigna cada columna de tu Excel al campo correspondiente del sistema.
                  Las columnas se autodetectaron por nombre; ajusta las que no coinciden.
                </p>
              </div>
            </div>
            <div className="bulk-mapper-status">
              {missingRequiredCount > 0 ? (
                <span className="bulk-mapper-status-warn">
                  <AlertCircle className="h-4 w-4" />
                  {missingRequiredCount} requerido(s) sin mapear
                </span>
              ) : (
                <span className="bulk-mapper-status-ok">
                  <CheckCircle className="h-4 w-4" />
                  Todos los requeridos mapeados
                </span>
              )}
            </div>
          </div>

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

          <div className="bulk-mapper-actions">
            <Button
              onClick={handleConfirmMapping}
              disabled={missingRequiredCount > 0}
              className="pg-btn-platinum"
            >
              <CheckCircle className="mr-2 h-3.5 w-3.5" />
              Confirmar mapeo y ver preview
            </Button>
            {missingRequiredCount > 0 && (
              <p className="bulk-mapper-actions-hint">
                Mapea los {missingRequiredCount} campo(s) requerido(s) faltante(s) para continuar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Step: Preview con errores claros ── */}
      {step === "preview" && (
        <div className="space-y-2">
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
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("mapping")}>
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" /> Editar mapeo
              </Button>
              {canCreate("operaciones") && (
                <Button
                  onClick={() => loadMutation.mutate(parsedRows)}
                  disabled={isUploading || validCount === 0}
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

          {/* Resumen de errores por tipo (si hay inválidas) */}
          {invalidCount > 0 && (
            <ErrorSummary parsedRows={parsedRows} />
          )}

          {/* Table preview */}
          <div className="app-data-table-wrap max-h-[500px] overflow-auto">
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
                  <th>Empresa</th>
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
                    <td className="bulk-cell-medium">{String(row.data.companyId || "—")}</td>
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
