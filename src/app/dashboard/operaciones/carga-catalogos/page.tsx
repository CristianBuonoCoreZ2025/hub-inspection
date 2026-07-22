"use client";

import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createClaimCause,
  createInsuranceCompany,
  createBroker,
  createAdvisor,
  createBusinessLine,
} from "@/services/catalogs";

import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import * as XLSX from "xlsx";

type CatalogType =
  | "causas"
  | "companias"
  | "corredores"
  | "asesores"
  | "lineas";

interface ExcelRow {
  [key: string]: string | number | null;
}

interface ParsedRow {
  rowNum: number;
  data: Record<string, unknown>;
  valid: boolean;
  errors: string[];
}

const catalogOptions: { id: CatalogType; label: string }[] = [
  { id: "causas", label: "Causas de Siniestro" },
  { id: "companias", label: "Compañías de Seguros" },
  { id: "corredores", label: "Corredores" },
  { id: "asesores", label: "Asesores" },
  { id: "lineas", label: "Líneas de Negocio" },
];

function mapRowForCatalog(raw: ExcelRow, headers: string[], catalogType: CatalogType, rowNum: number): ParsedRow {
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

  let data: Record<string, unknown> = {};
  let required: string[] = [];

  switch (catalogType) {
    case "causas":
      data = {
        name: get(["nombre", "name", "causa", "tipo"]),
        description: get(["descripción", "descripcion", "description", "desc"]),
      };
      required = ["name"];
      break;
    case "companias":
      data = {
        name: get(["nombre", "name", "compañía", "compania", "razon social", "razón social"]),
        rut: get(["rut", "rut empresa"]),
        address: get(["dirección", "direccion", "address", "direccion fiscal"]),
        line_of_business: get(["ramo", "linea", "linea de negocio", "line_of_business", "linea_negocio", "giro"]),
        code: get(["código", "codigo", "code", "codigo cia", "codigo compania"]),
        type: get(["tipo", "type", "tipo compañia", "tipo cia"]) || "Generales",
      };
      required = ["name"];
      break;
    case "corredores":
      data = {
        name: get(["nombre", "name", "razon social", "razón social", "corredor"]),
        rut: get(["rut", "rut corredor"]),
        address: get(["dirección", "direccion", "address"]),
        contact: get(["contacto", "contact", "telefono", "teléfono", "email", "correo"]),
      };
      required = ["name"];
      break;
    case "asesores":
      data = {
        name: get(["nombre", "name", "asesor", "nombre completo"]),
        email: get(["email", "correo", "e-mail", "mail"]),
        phone: get(["teléfono", "telefono", "phone", "celular", "móvil", "movil"]),
      };
      required = ["name"];
      break;
    case "lineas":
      data = {
        name: get(["nombre", "name", "linea", "linea de negocio"]),
        claim_type: get(["tipo siniestro", "tipo de siniestro", "claim_type", "tiposiniestro"]),
        ramo_fecu: get(["ramo fecu", "ramo_fecu", "fecu", "ramo"]),
        description: get(["descripción", "descripcion", "description", "desc"]),
      };
      required = ["name"];
      break;
  }

  const errors = required.filter((k) => !data[k] || String(data[k]).trim() === "").map((k) => `${k} requerido`);
  return { rowNum, data, valid: errors.length === 0, errors };
}

async function createCatalogItem(catalogType: CatalogType, data: Record<string, unknown>) {
  switch (catalogType) {
    case "causas":
      return createClaimCause(data as { name: string; description?: string; country?: string });
    case "companias":
      return createInsuranceCompany(data as { name: string; rut?: string; address?: string; line_of_business?: string; code?: string; type?: string; country?: string });
    case "corredores":
      return createBroker(data as { name: string; rut?: string; address?: string; contact?: string; country?: string });
    case "asesores":
      return createAdvisor(data as { name: string; email?: string; phone?: string; country?: string });
    case "lineas":
      return createBusinessLine(data as { country?: string; name: string; claim_type?: string; ramo_fecu?: string; description?: string });
    default:
      throw new Error("Tipo de catálogo no soportado");
  }
}

export default function CargaCatalogosPage() {
  const { canCreate } = usePermissions();
  const [catalogType, setCatalogType] = useState<CatalogType>("causas");
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, success: 0, error: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const loadMutation = useMutation({
    mutationFn: async (rows: ParsedRow[]) => {
      setIsUploading(true);
      const validRows = rows.filter((r) => r.valid);
      setProgress({ current: 0, total: validRows.length, success: 0, error: 0 });
      let success = 0;
      let error = 0;

      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        try {
          await createCatalogItem(catalogType, row.data);
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

  const parseFile = useCallback(
    (f: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(firstSheet, { header: 0, defval: "" });

          if (jsonData.length === 0) {
            toast.error("El archivo está vacío");
            return;
          }

          const headers = Object.keys(jsonData[0]);
          const rows = jsonData.map((row, idx) => mapRowForCatalog(row, headers, catalogType, idx + 2));
          setParsedRows(rows);
          toast.success(`${rows.length} filas parseadas`);
        } catch (err) {
          toast.error("Error al leer el archivo");
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(f);
    },
    [catalogType]
  );

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

  const catalogLabel = catalogOptions.find((c) => c.id === catalogType)?.label || catalogType;

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <div className="app-grid-header-left">
          <div className="app-grid-icon bg-linear-to-br from-amber-500 to-orange-500">
            <FileSpreadsheet />
          </div>
          <div className="app-grid-title-row">
            <h1 className="app-page-title shrink-0">Carga Masiva de Catálogos</h1>
          </div>
        </div>
      </div>

      {/* Selector de catálogo */}
      <div className="app-panel">
        <h3 className="app-section-title">
          Seleccionar Catálogo
        </h3>
        <div className="flex flex-wrap gap-2">
          {catalogOptions.map((opt) => (
            <button
              key={opt.id}
              onClick={() => {
                setCatalogType(opt.id);
                setFile(null);
                setParsedRows([]);
              }}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors ${
                catalogType === opt.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
        <p className="mt-3 text-sm font-medium">Arrastra tu archivo Excel de {catalogLabel}</p>
        <p className="mt-1 text-xs text-muted-foreground">.xlsx o .xls</p>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
          id="excel-upload-catalog"
        />
        <label htmlFor="excel-upload-catalog" className="mt-4 inline-flex cursor-pointer">
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
                className="pg-btn-platinum-icon"
              >
                {isUploading ? (
                  <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Cargando...</>
                ) : (
                  <><Upload className="mr-2 h-3.5 w-3.5" /> Cargar {validCount} registros</>
                )}
              </Button>
            )}
          </div>

          {/* Progress */}
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
                  {catalogType === "causas" && <><th>Nombre</th><th>Descripción</th></>}
                  {catalogType === "companias" && <><th>Nombre</th><th>RUT</th><th>Ramo</th><th>Código</th></>}
                  {catalogType === "corredores" && <><th>Nombre</th><th>RUT</th><th>Contacto</th></>}
                  {catalogType === "asesores" && <><th>Nombre</th><th>Email</th><th>Teléfono</th></>}
                  {catalogType === "lineas" && <><th>Nombre</th><th>Tipo Siniestro</th><th>Ramo FECU</th></>}
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
                    {catalogType === "causas" && (
                      <><td className="font-medium">{String(row.data.name || "—")}</td><td className="max-w-[200px] truncate">{String(row.data.description || "—")}</td></>
                    )}
                    {catalogType === "companias" && (
                      <><td className="font-medium">{String(row.data.name || "—")}</td><td>{String(row.data.rut || "—")}</td><td>{String(row.data.line_of_business || "—")}</td><td>{String(row.data.code || "—")}</td></>
                    )}
                    {catalogType === "corredores" && (
                      <><td className="font-medium">{String(row.data.name || "—")}</td><td>{String(row.data.rut || "—")}</td><td>{String(row.data.contact || "—")}</td></>
                    )}
                    {catalogType === "asesores" && (
                      <><td className="font-medium">{String(row.data.name || "—")}</td><td>{String(row.data.email || "—")}</td><td>{String(row.data.phone || "—")}</td></>
                    )}
                    {catalogType === "lineas" && (
                      <><td className="font-medium">{String(row.data.name || "—")}</td><td>{String(row.data.claim_type || "—")}</td><td>{String(row.data.ramo_fecu || "—")}</td></>
                    )}
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
