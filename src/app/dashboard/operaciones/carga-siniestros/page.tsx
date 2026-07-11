"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { createClaim } from "@/services/claims";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import * as XLSX from "xlsx";

interface ExcelRow {
  [key: string]: string | number | null;
}

interface ParsedRow {
  rowNum: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

function validateRow(row: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!row.claimNumber) errors.push("N° Siniestro requerido");
  if (!row.policyNumber) errors.push("N° Póliza requerido");
  if (!row.insuredName) errors.push("Nombre asegurado requerido");
  if (!row.address) errors.push("Dirección requerida");
  if (!row.city) errors.push("Ciudad requerida");
  if (!row.claimDate) errors.push("Fecha siniestro requerida");
  if (!row.claimType) errors.push("Tipo siniestro requerido");
  if (!row.companyId) errors.push("Empresa requerida");
  return { valid: errors.length === 0, errors };
}

function mapRow(raw: ExcelRow, headers: string[], rowNum: number): ParsedRow {
  const data: Record<string, unknown> = {};

  const get = (possibleKeys: string[]) => {
    for (const key of possibleKeys) {
      const idx = headers.findIndex((h) => h.toLowerCase().trim() === key.toLowerCase());
      if (idx >= 0) {
        const val = raw[headers[idx]];
        return val !== undefined && val !== null ? String(val).trim() : "";
      }
    }
    return "";
  };

  data.claimNumber = get(["n° siniestro", "n siniestro", "numero siniestro", "claim_number", "claimnumber", "nro siniestro", "siniestro"]);
  data.policyNumber = get(["n° póliza", "n poliza", "numero poliza", "policy_number", "policynumber", "nro poliza", "poliza"]);
  data.liquidationNumber = get(["n° liquidación", "n liquidacion", "numero liquidacion", "liquidation_number", "liquidationnumber", "nro liquidacion", "liquidacion"]);
  data.insuranceCompany = get(["compañía de seguros", "compania seguros", "insurance_company", "compañia", "cia seguros", "compañía"]);
  data.claimType = get(["tipo de siniestro", "tipo siniestro", "claim_type", "tiposiniestro", "tipo"]);
  data.claimCause = get(["causal del siniestro", "causal", "causa", "claim_cause", "claimcause"]);
  data.claimDate = get(["fecha siniestro", "fecha del siniestro", "claim_date", "claimdate", "fecha"]);
  data.claimTime = get(["hora siniestro", "hora del siniestro", "claim_time", "claimtime", "hora"]);
  data.reportDate = get(["fecha denuncio", "fecha denuncia", "report_date", "reportdate", "denuncio"]);
  data.assignmentDate = get(["fecha asignación", "fecha asignacion", "assignment_date", "assignmentdate", "asignacion"]);
  data.summary = get(["resumen", "descripción", "descripcion", "summary", "descripción resumida"]);
  data.insuredName = get(["nombre asegurado", "nombre", "insured_name", "insuredname", "asegurado"]);
  data.lastName = get(["apellido", "apellidos", "last_name", "lastname"]);
  data.rut = get(["rut", "rut asegurado", "rut_asegurado"]);
  data.insuredEmail = get(["email asegurado", "email", "correo", "insured_email", "insuredemail", "e-mail"]);
  data.insuredPhone = get(["teléfono", "telefono", "fono", "insured_phone", "insuredphone", "telefono asegurado"]);
  data.cellPhone = get(["celular", "móvil", "movil", "cell_phone", "cellphone"]);
  data.address = get(["dirección", "direccion", "address", "calle", "ubicacion", "ubicación"]);
  data.city = get(["ciudad", "city", "comuna"]); // fallback
  data.commune = get(["comuna", "commune", "comuna_siniestro"]);
  data.region = get(["región", "region", "state", "provincia"]);
  data.country = get(["país", "pais", "country", "nacion", "nación"]);
  data.contactName = get(["nombre contacto", "contacto", "contact_name", "contactname", "persona contacto"]);
  data.contactRole = get(["cargo contacto", "cargo", "relación", "relacion", "contact_role", "contactrole"]);
  data.contactEmail = get(["email contacto", "correo contacto", "contact_email", "contactemail"]);
  data.companyId = get(["empresa", "company", "company_id", "companyid", "cliente", "id empresa"]);
  data.inspectorId = get(["inspector", "inspector_id", "inspectorid", "id inspector"]);
  data.adjusterId = get(["ajustador", "liquidador", "adjuster_id", "adjusterid", "id ajustador"]);
  data.brokerName = get(["corredor", "broker", "broker_name", "brokername", "nombre corredor"]);
  data.brokerNumber = get(["n° corredor", "n corredor", "numero corredor", "broker_number", "brokernumber", "nro corredor"]);
  data.advisor = get(["asesor", "advisor", "asesor_seguros", "nombre asesor"]);
  data.notes = get(["notas", "observaciones", "notes", "comentarios", "notas adicionales"]);

  // Si no hay ciudad explícita pero hay comuna, usar comuna como ciudad
  if (!data.city && data.commune) data.city = data.commune;
  if (!data.country) data.country = "Chile";

  const { valid, errors } = validateRow(data);
  return { rowNum, data, valid, errors };
}

export default function CargaSiniestrosPage() {
  const { canCreate } = usePermissions();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, error: 0 });
  const [isUploading, setIsUploading] = useState(false);

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
        const rows = jsonData.map((row, idx) => mapRow(row, headers, idx + 2));
        setParsedRows(rows);
        toast.success(`${rows.length} filas parseadas`);
      } catch (err) {
        toast.error("Error al leer el archivo Excel");
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(f);
  }, []);

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

  const validCount = parsedRows.filter((r) => r.valid).length;
  const invalidCount = parsedRows.filter((r) => !r.valid).length;

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <h1 className="app-page-title shrink-0">Carga Masiva de Siniestros</h1>
      </div>

      {/* Drop Zone */}
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

      {/* Preview */}
      {parsedRows.length > 0 && (
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
            {canCreate("operaciones") && (
              <Button
                onClick={() => loadMutation.mutate(parsedRows)}
                disabled={isUploading || validCount === 0}
                className="btn-save btn-sm"
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

          {/* Table preview */}
          <div className="app-data-table-wrap max-h-[400px] overflow-auto">
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
                  <th className="w-40">Errores</th>
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
                    <td className="max-w-[150px] truncate">{String(row.data.address || "—")}</td>
                    <td>{String(row.data.claimDate || "—")}</td>
                    <td>{String(row.data.claimType || "—")}</td>
                    <td className="max-w-[120px] truncate">{String(row.data.companyId || "—")}</td>
                    <td className="text-xs text-red-600 max-w-[160px] truncate">
                      {row.errors.join(", ")}
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
