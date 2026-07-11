"use client";

import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllPermissions,
  updatePermission,
  sectionLabels,
  sectionOrder,
  sectionActions,
  sectionSubPages,
  subSectionActions,
  userTypeLabels,
  type PermissionAction,
} from "@/services/permissions";
import {
  getAllFieldPermissions,
  upsertFieldPermission,
} from "@/services/field-permissions";
import { getFieldsForSection } from "@/lib/field-catalog";
import type { UserTypePermission, UserRole, PermissionSection } from "@/types";
import { toast } from "sonner";
import { Check, Lock, Unlock, ChevronRight, ChevronDown, Settings2 } from "lucide-react";

const userTypes: UserRole[] = ["internal", "adjuster", "inspector", "client_operator"];

type ColumnKey = "can_view" | "can_edit" | "can_create" | "can_delete";

export default function PermisosPage() {
  const queryClient = useQueryClient();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: getAllPermissions,
  });

  const { data: fieldPermissions } = useQuery({
    queryKey: ["field-permissions"],
    queryFn: getAllFieldPermissions,
  });

  const fieldPermMutation = useMutation({
    mutationFn: ({
      userType,
      section,
      fieldName,
      canEdit,
    }: {
      userType: string;
      section: string;
      fieldName: string;
      canEdit: boolean;
    }) => upsertFieldPermission(userType, section, fieldName, canEdit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["field-permissions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<UserTypePermission> }) => updatePermission(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
      queryClient.invalidateQueries({ queryKey: ["auth-permissions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleToggle = (perm: UserTypePermission, column: ColumnKey) => {
    const newValue = !perm[column];
    updateMutation.mutate({ id: perm.id, input: { [column]: newValue } });
  };

  // Toggle toda una fila (sección) — solo las acciones que aplican
  const handleToggleRow = (perm: UserTypePermission, section: string, value: boolean) => {
    const actions = getSectionActions(section);
    const input: Partial<UserTypePermission> = {};
    if (actions.includes("view")) input.can_view = value;
    if (actions.includes("edit")) input.can_edit = value;
    if (actions.includes("create")) input.can_create = value;
    if (actions.includes("delete")) input.can_delete = value;
    updateMutation.mutate({ id: perm.id, input });
  };

  // Toggle toda una columna para un tipo — solo secciones que tienen esa acción
  const handleToggleColumn = (userType: UserRole, column: ColumnKey, value: boolean) => {
    const typePerms = permissions?.filter(p => p.user_type === userType) || [];
    for (const p of typePerms) {
      const actions = getSectionActions(p.section);
      const actionKey = column.replace("can_", "") as PermissionAction;
      if (actions.includes(actionKey) && p[column] !== value) {
        updateMutation.mutate({ id: p.id, input: { [column]: value } });
      }
    }
  };

  // Obtener acciones disponibles para una sección (maneja sub-secciones)
  const getSectionActions = (section: string): PermissionAction[] => {
    // 1. Si es una sub-sección con acciones definidas, usar esas
    if (section in subSectionActions) {
      return subSectionActions[section];
    }
    // 2. Si es una sección principal conocida
    if (section in sectionActions) {
      return sectionActions[section as PermissionSection];
    }
    // 3. Si es sub-sección sin acciones definidas, heredar del padre
    if (section.startsWith("catalogos_inspeccion_")) {
      return sectionActions.catalogos_inspeccion;
    }
    if (section.startsWith("catalogos_")) {
      return sectionActions.catalogos;
    }
    if (section.startsWith("operaciones_")) {
      return sectionActions.operaciones;
    }
    if (section.startsWith("claims_")) {
      return sectionActions.claims;
    }
    if (section.startsWith("inspecciones_")) {
      return sectionActions.inspecciones;
    }
    // Por defecto, todas
    return ["view", "edit", "create", "delete"];
  };

  // Verificar si una sección tiene sub-páginas
  const hasSubPages = (section: PermissionSection): boolean => {
    return !!sectionSubPages[section] && sectionSubPages[section]!.length > 0;
  };

  // Toggle expansión de sección
  const toggleExpand = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  // Toggle expansión de campos de una sub-página
  const toggleFieldExpand = (key: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Verificar si una sub-página tiene campos configurables
  const hasFieldPermissions = (section: string): boolean => {
    return getFieldsForSection(section) !== null;
  };

  // Obtener el valor actual de can_edit para un campo
  const getFieldCanEdit = (
    userType: string,
    section: string,
    fieldName: string
  ): boolean => {
    const perm = fieldPermissions?.find(
      p => p.user_type === userType && p.section === section && p.field_name === fieldName
    );
    if (!perm) return true; // default: editable
    return perm.can_edit;
  };

  // Organizar permisos por tipo y sección
  const permissionsByType: Record<UserRole, Record<string, UserTypePermission>> = {
    internal: {},
    adjuster: {},
    inspector: {},
    assistant: {},
    client_operator: {},
  };

  permissions?.forEach((p) => {
    if (permissionsByType[p.user_type]) {
      permissionsByType[p.user_type][p.section] = p;
    }
  });

  if (isLoading) {
    return (
      <div className="app-page">
        <div className="app-grid-header">
          <h1 className="app-page-title shrink-0">Permisos</h1>
        </div>
      </div>
    );
  }

  // Columnas a mostrar (solo las que aplican a alguna sección)
  const allColumns: { key: ColumnKey; label: string }[] = [
    { key: "can_view", label: "Ver" },
    { key: "can_edit", label: "Editar" },
    { key: "can_create", label: "Crear" },
    { key: "can_delete", label: "Eliminar" },
  ];

  return (
    <div className="app-page">
      <div className="app-grid-header">
        <h1 className="app-page-title shrink-0">Permisos</h1>
      </div>

      <div className="space-y-2">
        {userTypes.map((userType) => {
          const typePerms = permissions?.filter(p => p.user_type === userType) || [];

          return (
            <div
              key={userType}
              className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
            >
              {/* Header del tipo de usuario */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-semibold text-foreground">{userTypeLabels[userType]}</h3>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {userType}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      for (const p of typePerms) {
                        const actions = getSectionActions(p.section);
                        const input: Partial<UserTypePermission> = {};
                        if (actions.includes("view")) input.can_view = true;
                        if (actions.includes("edit")) input.can_edit = true;
                        if (actions.includes("create")) input.can_create = true;
                        if (actions.includes("delete")) input.can_delete = true;
                        updateMutation.mutate({ id: p.id, input });
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-500/20 transition-colors"
                  >
                    <Unlock className="h-3 w-3" />
                    Todo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      for (const p of typePerms) {
                        const actions = getSectionActions(p.section);
                        const input: Partial<UserTypePermission> = {};
                        if (actions.includes("view")) input.can_view = false;
                        if (actions.includes("edit")) input.can_edit = false;
                        if (actions.includes("create")) input.can_create = false;
                        if (actions.includes("delete")) input.can_delete = false;
                        updateMutation.mutate({ id: p.id, input });
                      }
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted/70 transition-colors"
                  >
                    <Lock className="h-3 w-3" />
                    Ninguno
                  </button>
                </div>
              </div>

              {/* Tabla de permisos */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 font-medium text-muted-foreground">Sección</th>
                      {allColumns.map((col) => {
                        const actionKey = col.key.replace("can_", "") as PermissionAction;
                        // Solo mostrar columna si al menos una sección la tiene
                        const hasAny = sectionOrder.some(s => getSectionActions(s).includes(actionKey));
                        if (!hasAny) return null;
                        const allChecked = typePerms.length > 0 && typePerms.every(p => {
                          const actions = getSectionActions(p.section);
                          if (!actions.includes(actionKey)) return true;
                          return p[col.key];
                        });
                        return (
                          <th key={col.key} className="text-center py-2 px-2 font-medium text-muted-foreground w-[70px]">
                            <button
                              type="button"
                              onClick={() => handleToggleColumn(userType, col.key, !allChecked)}
                              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                            >
                              {allChecked && <Check className="h-3 w-3 text-emerald-500" />}
                              {col.label}
                            </button>
                          </th>
                        );
                      })}
                      <th className="text-center py-2 px-2 font-medium text-muted-foreground w-[60px]">Todo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sectionOrder.map((section: PermissionSection) => {
                      const perm = permissionsByType[userType][section];
                      if (!perm) return null;
                      const actions = getSectionActions(section);
                      const allTrue = actions.every(a => perm[`can_${a}` as ColumnKey]);
                      const canExpand = hasSubPages(section);
                      const isExpanded = expandedSections.has(`${userType}-${section}`);

                      return (
                        <SectionRow
                          key={section}
                          perm={perm}
                          section={section}
                          label={sectionLabels[section]}
                          actions={actions}
                          allTrue={allTrue}
                          canExpand={canExpand}
                          isExpanded={isExpanded}
                          onToggleExpand={() => toggleExpand(`${userType}-${section}`)}
                          onToggle={(col) => handleToggle(perm, col)}
                          onToggleRow={(val) => handleToggleRow(perm, section, val)}
                          allColumns={allColumns}
                        >
                          {/* Sub-páginas */}
                          {canExpand && isExpanded && sectionSubPages[section] && (
                            <SubPagesList
                              subPages={sectionSubPages[section]!}
                              userType={userType}
                              permissionsByType={permissionsByType}
                              getSectionActions={getSectionActions}
                              onToggle={(subPerm, col) => handleToggle(subPerm, col)}
                              onToggleRow={(subPerm, subSection, val) => handleToggleRow(subPerm, subSection, val)}
                              allColumns={allColumns}
                              expandedFields={expandedFields}
                              onToggleFieldExpand={toggleFieldExpand}
                              hasFieldPermissions={hasFieldPermissions}
                              getFieldCanEdit={getFieldCanEdit}
                              onFieldToggle={(sectionName, fieldName, canEdit) =>
                                fieldPermMutation.mutate({
                                  userType,
                                  section: sectionName,
                                  fieldName,
                                  canEdit,
                                })
                              }
                            />
                          )}
                        </SectionRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Notas:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li><strong>Internal:</strong> Usuarios internos del sistema. Acceso total por defecto.</li>
          <li><strong>Liquidador:</strong> Liquidadores asociados a uno o más clientes. Ven siniestros de sus clientes.</li>
          <li><strong>Inspector:</strong> Inspectores asociados a clientes. Completan inspecciones donde están a cargo.</li>
          <li><strong>Operativo:</strong> Usuarios operativos del cliente. Ven casos de su empresa.</li>
          <li className="mt-1 pt-1 border-t border-border/50">
            Los checks solo aparecen para acciones que existen en cada módulo.
            Módulos con <ChevronRight className="inline h-3 w-3" /> se pueden expandir para configurar permisos por pantalla individual.
            Si una sub-página no tiene permiso propio, hereda el del módulo padre.
          </li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Fila de sección (con expansión opcional)
// ═══════════════════════════════════════════════════════════════
function SectionRow({
  perm,
  label,
  actions,
  allTrue,
  canExpand,
  isExpanded,
  onToggleExpand,
  onToggle,
  onToggleRow,
  allColumns,
  children,
}: {
  perm: UserTypePermission;
  section: string;
  label: string;
  actions: PermissionAction[];
  allTrue: boolean;
  canExpand: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggle: (col: ColumnKey) => void;
  onToggleRow: (val: boolean) => void;
  allColumns: { key: ColumnKey; label: string }[];
  children?: React.ReactNode;
}) {
  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/30">
        <td className="py-2 px-2 font-medium">
          {canExpand ? (
            <button
              type="button"
              onClick={onToggleExpand}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              {isExpanded
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
              {label}
            </button>
          ) : (
            <span className="pl-[22px]">{label}</span>
          )}
        </td>
        {allColumns.map((col) => {
          const actionKey = col.key.replace("can_", "") as PermissionAction;
          if (!actions.includes(actionKey)) {
            return <td key={col.key} className="text-center py-2 px-2 text-muted-foreground/30">—</td>;
          }
          return (
            <td key={col.key} className="text-center py-2 px-2">
              <button
                type="button"
                onClick={() => onToggle(col.key)}
                className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${
                  perm[col.key]
                    ? "bg-emerald-500 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/70"
                }`}
              >
                {perm[col.key] && <Check className="h-3 w-3" />}
              </button>
            </td>
          );
        })}
        <td className="text-center py-2 px-2">
          <button
            type="button"
            onClick={() => onToggleRow(!allTrue)}
            className={`inline-flex h-5 w-5 items-center justify-center rounded transition-colors ${
              allTrue
                ? "bg-emerald-500 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {allTrue && <Check className="h-3 w-3" />}
          </button>
        </td>
      </tr>
      {children}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Lista de sub-páginas (drill-down)
// ═══════════════════════════════════════════════════════════════
function SubPagesList({
  subPages,
  userType,
  permissionsByType,
  getSectionActions,
  onToggle,
  onToggleRow,
  allColumns,
  expandedFields,
  onToggleFieldExpand,
  hasFieldPermissions,
  getFieldCanEdit,
  onFieldToggle,
}: {
  subPages: { section: string; label: string }[];
  userType: UserRole;
  permissionsByType: Record<UserRole, Record<string, UserTypePermission>>;
  getSectionActions: (section: string) => PermissionAction[];
  onToggle: (perm: UserTypePermission, col: ColumnKey) => void;
  onToggleRow: (perm: UserTypePermission, section: string, val: boolean) => void;
  allColumns: { key: ColumnKey; label: string }[];
  expandedFields: Set<string>;
  onToggleFieldExpand: (key: string) => void;
  hasFieldPermissions: (section: string) => boolean;
  getFieldCanEdit: (userType: string, section: string, fieldName: string) => boolean;
  onFieldToggle: (section: string, fieldName: string, canEdit: boolean) => void;
}) {
  return (
    <>
      {subPages.map((sub) => {
        const subPerm = permissionsByType[userType][sub.section];
        const actions = getSectionActions(sub.section);
        const allTrue = subPerm
          ? actions.every(a => subPerm[`can_${a}` as ColumnKey])
          : false;
        const canExpandFields = hasFieldPermissions(sub.section);
        const fieldKey = `${userType}-${sub.section}`;
        const isFieldsExpanded = expandedFields.has(fieldKey);
        const catalog = getFieldsForSection(sub.section);

        return (
          <Fragment key={sub.section}>
            <tr className="border-b border-border/30 bg-muted/20">
              <td className="py-1.5 px-2 pl-8 text-muted-foreground">
                <span className="text-[11px]">↳ {sub.label}</span>
                {!subPerm && (
                  <span className="ml-2 text-[9px] text-muted-foreground/60 italic">(hereda)</span>
                )}
                {canExpandFields && (
                  <button
                    type="button"
                    onClick={() => onToggleFieldExpand(fieldKey)}
                    className="ml-2 inline-flex items-center gap-0.5 text-[9px] text-violet-600 hover:text-violet-700 transition-colors"
                    title="Configurar campos editables"
                  >
                    <Settings2 className="h-3 w-3" />
                    Campos
                  </button>
                )}
              </td>
              {allColumns.map((col) => {
                const actionKey = col.key.replace("can_", "") as PermissionAction;
                if (!actions.includes(actionKey)) {
                  return <td key={col.key} className="text-center py-1.5 px-2 text-muted-foreground/20">—</td>;
                }
                if (!subPerm) {
                  return (
                    <td key={col.key} className="text-center py-1.5 px-2">
                      <span className="text-[9px] text-muted-foreground/40 italic">hereda</span>
                    </td>
                  );
                }
                return (
                  <td key={col.key} className="text-center py-1.5 px-2">
                    <button
                      type="button"
                      onClick={() => onToggle(subPerm, col.key)}
                      className={`inline-flex h-4 w-4 items-center justify-center rounded transition-colors ${
                        subPerm[col.key]
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground hover:bg-muted/70"
                      }`}
                    >
                      {subPerm[col.key] && <Check className="h-2.5 w-2.5" />}
                    </button>
                  </td>
                );
              })}
              <td className="text-center py-1.5 px-2">
                {subPerm ? (
                  <button
                    type="button"
                    onClick={() => onToggleRow(subPerm, sub.section, !allTrue)}
                    className={`inline-flex h-4 w-4 items-center justify-center rounded transition-colors ${
                      allTrue
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {allTrue && <Check className="h-2.5 w-2.5" />}
                  </button>
                ) : (
                  <span className="text-[9px] text-muted-foreground/40 italic">—</span>
                )}
              </td>
            </tr>
            {/* Filas de campos editables */}
            {canExpandFields && isFieldsExpanded && catalog && (
              <FieldPermissionsRows
                userType={userType}
                section={sub.section}
                catalog={catalog}
                getFieldCanEdit={getFieldCanEdit}
                onFieldToggle={onFieldToggle}
              />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// Filas de permisos a nivel de campo
// ═══════════════════════════════════════════════════════════════
function FieldPermissionsRows({
  userType,
  section,
  catalog,
  getFieldCanEdit,
  onFieldToggle,
}: {
  userType: string;
  section: string;
  catalog: NonNullable<ReturnType<typeof getFieldsForSection>>;
  getFieldCanEdit: (userType: string, section: string, fieldName: string) => boolean;
  onFieldToggle: (section: string, fieldName: string, canEdit: boolean) => void;
}) {
  // Agrupar campos por grupo
  const groups = new Map<string, typeof catalog.fields>();
  for (const field of catalog.fields) {
    const g = field.group ?? "General";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(field);
  }

  return (
    <>
      {Array.from(groups.entries()).map(([group, fields]) => (
        <Fragment key={group}>
          <tr className="border-b border-border/20 bg-violet-500/5">
            <td colSpan={6} className="py-1 px-2 pl-12 text-[9px] font-semibold uppercase tracking-wide text-violet-600/70">
              {group}
            </td>
          </tr>
          {fields.map((field) => {
            const canEdit = getFieldCanEdit(userType, section, field.name);
            return (
              <tr key={field.name} className="border-b border-border/10 bg-violet-500/5">
                <td className="py-1 px-2 pl-12 text-muted-foreground">
                  <span className="text-[10px]">{field.label}</span>
                </td>
                <td colSpan={4} className="py-1 px-2">
                  {/* Espacio para alinear con las columnas de acciones */}
                </td>
                <td className="text-center py-1 px-2">
                  <button
                    type="button"
                    onClick={() => onFieldToggle(section, field.name, !canEdit)}
                    className={`inline-flex h-4 w-4 items-center justify-center rounded transition-colors ${
                      canEdit
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                    title={canEdit ? "Editable (clic para restringir)" : "Restringido (clic para permitir)"}
                  >
                    {canEdit && <Check className="h-2.5 w-2.5" />}
                  </button>
                </td>
              </tr>
            );
          })}
        </Fragment>
      ))}
    </>
  );
}
