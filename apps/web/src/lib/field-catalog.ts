/**
 * Catálogo de campos editables por entidad.
 *
 * Define qué campos tiene cada entidad (para configurar permisos
 * a nivel de campo desde la UI de Permisos).
 *
 * - `section` corresponde al mismo "section" usado en user_type_permissions
 *   (ej: "catalogos_gestiones" es la sub-sección de Gestiones).
 * - `fields` lista los campos que se pueden restringir individualmente.
 * - Los campos inmutables (que NADIE puede editar después de crear)
 *   NO se incluyen aquí porque ya están bloqueados a nivel de server action.
 */

export interface FieldDefinition {
  name: string;
  label: string;
  group?: string;
}

export interface EntityFieldCatalog {
  section: string;
  label: string;
  fields: FieldDefinition[];
}

// ═══════════════════════════════════════════════════════════════
// Catálogo de entidades configurables
// ═══════════════════════════════════════════════════════════════

export const fieldCatalog: EntityFieldCatalog[] = [
  {
    section: "catalogos_gestiones",
    label: "Gestiones",
    fields: [
      { name: "name", label: "Nombre", group: "Básico" },
      { name: "description", label: "Descripción", group: "Básico" },
      { name: "code", label: "Código", group: "Básico" },
      { name: "is_active", label: "Activo", group: "Básico" },
      { name: "is_blocker", label: "Es Bloqueante", group: "Estructura" },
      { name: "review_levels", label: "Niveles de Revisión", group: "Estructura" },
      { name: "is_dispatch_applicable", label: "Aplica Despacho", group: "Estructura" },
      { name: "days_to_issue", label: "Días para Emitir", group: "Plazos" },
      { name: "days_to_review", label: "Días para Revisar", group: "Plazos" },
      { name: "days_to_approve", label: "Días para Aprobar", group: "Plazos" },
      { name: "days_to_alert_to_issue", label: "Alerta Emisión", group: "Plazos" },
      { name: "days_to_alert_to_review", label: "Alerta Revisión", group: "Plazos" },
      { name: "days_to_alert_to_approve", label: "Alerta Aprobación", group: "Plazos" },
      { name: "issuer_roles", label: "Roles Emisor", group: "Roles" },
      { name: "reviewer_roles", label: "Roles Revisor", group: "Roles" },
      { name: "approver_roles", label: "Roles Aprobador", group: "Roles" },
    ],
  },
];

/**
 * Obtiene el catálogo de campos para una sección dada.
 * Retorna null si la sección no tiene campos configurables.
 */
export function getFieldsForSection(
  section: string
): EntityFieldCatalog | null {
  return fieldCatalog.find((e) => e.section === section) ?? null;
}

/**
 * Lista de secciones que tienen configuración de field-level permissions.
 * Se usa para saber qué filas de la tabla de permisos se pueden expandir.
 */
export const sectionsWithFieldPermissions: string[] = fieldCatalog.map(
  (e) => e.section
);
