"use client";

import { useState, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogs } from "@/services/audit-logs";
import { getRegions, getCities, getCommunes } from "@/services/catalogs";
import { useClaimStatuses } from "@/hooks/use-claim-statuses";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Profile } from "@/types";

const actionLabels: Record<string, string> = {
  INSERT: "Creado",
  UPDATE: "Actualizado",
  DELETE: "Eliminado",
};

const actionIcons: Record<string, React.ReactNode> = {
  INSERT: <Plus className="h-3.5 w-3.5" />,
  UPDATE: <Pencil className="h-3.5 w-3.5" />,
  DELETE: <Trash2 className="h-3.5 w-3.5" />,
};

const actionColors: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  UPDATE: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Mapeo completo de campos a etiquetas legibles
const fieldLabels: Record<string, string> = {
  claim_number: "N° Siniestro",
  liquidation_number: "N° Liquidación",
  internal_number: "N° Interno",
  client_reference: "Ref. Cliente",
  company_report_number: "N° Reporte Compañía",
  status_id: "Estado",
  claim_date: "Fecha Siniestro",
  report_date: "Fecha Reporte",
  assignment_date: "Fecha Asignación",
  policy_number: "Póliza",
  policy_item: "Item Póliza",
  policy_amount: "Monto Asegurado",
  policy_premium: "Prima",
  policy_start_date: "Vigencia Desde",
  policy_end_date: "Vigencia Hasta",
  summary: "Resumen",
  notes: "Notas",
  inspector_id: "Inspector",
  adjuster_id: "Liquidador",
  assigned_adjuster_id: "Liquidador Asignado",
  auditor_id: "Auditor",
  dispatcher_id: "Despachador",
  assistant_id: "Asistente",
  insurance_company_id: "Compañía",
  broker_id: "Corredor",
  advisor_id: "Asesor",
  business_line_id: "Línea de Negocio",
  insurance_product_id: "Producto",
  claim_type_id: "Tipo Siniestro",
  claim_cause_id: "Causa",
  event_id: "Evento",
  country_id: "País",
  region_id: "Región",
  city_id: "Ciudad",
  commune_id: "Comuna",
  claim_address: "Dirección Siniestro",
  construction_type_id: "Tipo Construcción",
  destination_housing_id: "Destino Vivienda",
  damage_classification_id: "Clasificación Daño",
  habitability_id: "Habitabilidad",
  owner_same_as_insured: "Propietario = Asegurado",
  currency_id: "Moneda",
  recovery_type_legal: "Recupero Legal",
  recovery_type_material: "Recupero Material",
  recovery_comments: "Comentarios Recupero",
  disabled: "Inhabilitado",
  disabled_reason: "Razón Inhabilitación",
  disabled_by: "Inhabilitado por",
  disabled_at: "Fecha Inhabilitación",
  reopened_at: "Fecha Reapertura",
  reopened_by: "Reabierto por",
  reopened_reason: "Razón Reapertura",
  updated_by: "Modificado por",
  is_special_claim: "Caso Especial",
  broker_executive: "Ejecutivo Corredor",
};

type NamedItem = { id: string; name: string };

interface AuditCatalogs {
  users?: Profile[];
  companies?: NamedItem[];
  claimTypes?: NamedItem[];
  claimCauses?: NamedItem[];
  insuranceCompanies?: NamedItem[];
  businessLines?: NamedItem[];
  insuranceProducts?: NamedItem[];
  brokers?: NamedItem[];
  advisors?: NamedItem[];
  events?: NamedItem[];
  housingDestinations?: NamedItem[];
  propertyClassifications?: NamedItem[];
  damageClassifications?: NamedItem[];
  constructionTypes?: NamedItem[];
  habitability?: NamedItem[];
  currencies?: NamedItem[];
  countries?: NamedItem[];
  regions?: NamedItem[];
  cities?: NamedItem[];
  communes?: NamedItem[];
}

function useResolvedCatalogs(catalogs: AuditCatalogs) {
  const { data: regions } = useQuery({
    queryKey: ["regions"],
    queryFn: () => getRegions(),
    enabled: !catalogs.regions,
    staleTime: 10 * 60 * 1000,
  });
  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: () => getCities(),
    enabled: !catalogs.cities,
    staleTime: 10 * 60 * 1000,
  });
  const { data: communes } = useQuery({
    queryKey: ["communes"],
    queryFn: () => getCommunes(),
    enabled: !catalogs.communes,
    staleTime: 10 * 60 * 1000,
  });

  const { statusLabel } = useClaimStatuses();

  const resolved: AuditCatalogs = {
    ...catalogs,
    regions: catalogs.regions ?? regions ?? [],
    cities: catalogs.cities ?? cities ?? [],
    communes: catalogs.communes ?? communes ?? [],
  };

  const userName = (id: string | null | undefined): string => {
    if (!id) return "—";
    const user = resolved.users?.find((u) => u.id === id);
    return user?.full_name ?? id;
  };

  const resolveIn = (items: NamedItem[] | undefined, id: string | null | undefined): string => {
    if (id === null || id === undefined || id === "") return "—";
    return items?.find((item) => item.id === id)?.name ?? id;
  };

  const resolveField = (field: string, value: unknown): string => {
    if (value === null || value === undefined || value === "") return "—";

    if (typeof value === "boolean") return value ? "Sí" : "No";
    if (typeof value === "number") return String(value);
    if (typeof value !== "string") return String(value);

    // Fechas simples (YYYY-MM-DD...)
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        return new Date(value).toLocaleDateString("es-CL", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      } catch {
        return value;
      }
    }

    const catalog = catalogMap[field];
    if (!catalog) return value;

    const id = value;
    switch (catalog.type) {
      case "users":
        return userName(id);
      case "status":
        return statusLabel(id);
      case "catalog":
        return resolveIn(resolved[catalog.key], id);
    }
  };

  return { resolveField, userName };
}

type CatalogKey = keyof Omit<AuditCatalogs, "users">;

const catalogMap: Record<
  string,
  { type: "users" } | { type: "status" } | { type: "catalog"; key: CatalogKey }
> = {
  status_id: { type: "status" },
  inspector_id: { type: "users" },
  adjuster_id: { type: "users" },
  assigned_adjuster_id: { type: "users" },
  auditor_id: { type: "users" },
  dispatcher_id: { type: "users" },
  assistant_id: { type: "users" },
  disabled_by: { type: "users" },
  reopened_by: { type: "users" },
  updated_by: { type: "users" },
  performed_by: { type: "users" },
  insurance_company_id: { type: "catalog", key: "insuranceCompanies" },
  broker_id: { type: "catalog", key: "brokers" },
  advisor_id: { type: "catalog", key: "advisors" },
  claim_type_id: { type: "catalog", key: "claimTypes" },
  claim_cause_id: { type: "catalog", key: "claimCauses" },
  business_line_id: { type: "catalog", key: "businessLines" },
  insurance_product_id: { type: "catalog", key: "insuranceProducts" },
  event_id: { type: "catalog", key: "events" },
  country_id: { type: "catalog", key: "countries" },
  region_id: { type: "catalog", key: "regions" },
  city_id: { type: "catalog", key: "cities" },
  commune_id: { type: "catalog", key: "communes" },
  construction_type_id: { type: "catalog", key: "constructionTypes" },
  destination_housing_id: { type: "catalog", key: "housingDestinations" },
  damage_classification_id: { type: "catalog", key: "damageClassifications" },
  property_classification_id: { type: "catalog", key: "propertyClassifications" },
  habitability_id: { type: "catalog", key: "habitability" },
  currency_id: { type: "catalog", key: "currencies" },
  company_id: { type: "catalog", key: "companies" },
};

/** Compara old_data y new_data para encontrar qué campos cambiaron. */
function diffChanges(
  oldData: Record<string, unknown> | null | undefined,
  newData: Record<string, unknown> | null | undefined,
  resolveField: (field: string, value: unknown) => string
): Array<{ field: string; label: string; oldValue: string; newValue: string }> {
  if (!newData) return [];
  const changes: Array<{ field: string; label: string; oldValue: string; newValue: string }> = [];
  const allKeys = new Set([...Object.keys(oldData ?? {}), ...Object.keys(newData)]);

  for (const key of allKeys) {
    // Saltar campos internos que no son relevantes para el diff
    if (["id", "created_at", "updated_at", "company_id"].includes(key)) continue;
    if (!fieldLabels[key]) continue; // Solo mostrar campos conocidos

    const oldVal = oldData?.[key];
    const newVal = newData?.[key];

    // Solo mostrar si el valor cambió
    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) continue;

    changes.push({
      field: key,
      label: fieldLabels[key] ?? key,
      oldValue: resolveField(key, oldVal),
      newValue: resolveField(key, newVal),
    });
  }

  return changes;
}

function summarizeChange(
  log: { action: string; old_data?: Record<string, unknown> | null; new_data?: Record<string, unknown> | null },
  resolveField: (field: string, value: unknown) => string
) {
  if (log.action === "INSERT" && log.new_data) {
    const entries = Object.entries(log.new_data)
      .filter(([k, v]) => fieldLabels[k] && v != null)
      .slice(0, 4)
      .map(([k, v]) => `${fieldLabels[k]}: ${resolveField(k, v)}`);
    if (entries.length === 0) return "Registro creado";
    const total = Object.entries(log.new_data).filter(([k, v]) => fieldLabels[k] && v != null).length;
    const suffix = total > entries.length ? ` (+${total - entries.length} más)` : "";
    return `Creado: ${entries.join(", ")}${suffix}`;
  }
  if (log.action === "UPDATE") {
    const changes = diffChanges(log.old_data, log.new_data, resolveField);
    if (changes.length === 0) return "Actualización general";
    const max = 3;
    const parts = changes.slice(0, max).map((c) => `${c.label}: ${c.oldValue} → ${c.newValue}`);
    const suffix = changes.length > max ? ` (+${changes.length - max} más)` : "";
    return parts.join(" | ") + suffix;
  }
  if (log.action === "DELETE") return "Registro eliminado";
  return "—";
}

interface AuditLogSectionProps {
  claimId: string;
  users?: Profile[];
  catalogs?: AuditCatalogs;
}

export default function AuditLogSection({ claimId, users, catalogs = {} }: AuditLogSectionProps) {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", "claims", claimId],
    queryFn: () => getAuditLogs("claims", claimId),
  });

  const resolvedCatalogs: AuditCatalogs = {
    ...catalogs,
    users: users ?? catalogs.users,
  };

  const { resolveField, userName } = useResolvedCatalogs(resolvedCatalogs);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="app-panel">
        <div className="text-center py-8 text-muted-foreground text-[13px]">Cargando...</div>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="app-panel">
        <div className="text-center py-8 text-muted-foreground text-[13px]">
          No hay registros en el log.
        </div>
      </div>
    );
  }

  return (
    <div className="app-panel">
      <div className="app-data-table-wrap">
        <table className="app-data-table">
          <thead>
            <tr>
              <th className="w-[40px]"></th>
              <th className="w-[28px]"></th>
              <th>Acción</th>
              <th>Detalle</th>
              <th>Usuario</th>
              <th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => {
              const performerName = userName(log.performed_by);
              const label = actionLabels[log.action] || log.action;
              const icon = actionIcons[log.action];
              const color = actionColors[log.action] || "bg-gray-100 text-gray-700";
              const changes = log.action === "UPDATE" ? diffChanges(log.old_data, log.new_data, resolveField) : [];
              const isExpanded = expandedRows.has(log.id);
              const hasDetails = changes.length > 0 || (log.action === "INSERT" && log.new_data);
              const summary = summarizeChange(log, resolveField);

              return (
                <Fragment key={log.id}>
                  <tr>
                    <td>
                      <div className={`flex size-7 items-center justify-center rounded-full ${color}`}>
                        {icon}
                      </div>
                    </td>
                    <td>
                      {hasDetails && (
                        <button
                          type="button"
                          onClick={() => toggleRow(log.id)}
                          className="inline-flex items-center justify-center rounded-md p-1 hover:bg-muted"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </td>
                    <td><Badge className={color}>{label}</Badge></td>
                    <td className="text-muted-foreground max-w-md truncate" title={summary}>
                      {summary}
                    </td>
                    <td className="font-medium">{performerName}</td>
                    <td className="text-muted-foreground">{formatDateTime(log.created_at)}</td>
                  </tr>
                  {isExpanded && hasDetails && (
                    <tr className="bg-muted/30">
                      <td colSpan={6} className="py-3 px-6">
                        {log.action === "UPDATE" && changes.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              Campos modificados ({changes.length})
                            </div>
                            {changes.map((c) => (
                              <div key={c.field} className="flex items-center gap-2 text-[11px]">
                                <span className="font-medium min-w-[140px] text-foreground">{c.label}:</span>
                                <span className="text-muted-foreground line-through">{c.oldValue}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="text-foreground font-medium">{c.newValue}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {log.action === "INSERT" && log.new_data && (
                          <div className="space-y-1.5">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                              Datos iniciales
                            </div>
                            {Object.entries(log.new_data)
                              .filter(([k, v]) => fieldLabels[k] && v != null)
                              .slice(0, 15)
                              .map(([k, v]) => (
                                <div key={k} className="flex items-center gap-2 text-[11px]">
                                  <span className="font-medium min-w-[140px] text-foreground">{fieldLabels[k]}:</span>
                                  <span className="text-muted-foreground">{resolveField(k, v)}</span>
                                </div>
                              ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
