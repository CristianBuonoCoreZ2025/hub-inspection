import { graphqlRequest } from "@/lib/nhost/graphql";
import type { UserTypePermission, UserRole, PermissionSection } from "@/types";

const PERMISSION_FIELDS = `
  id
  user_type
  section
  can_view
  can_edit
  can_create
  can_delete
  created_at
  updated_at
`;

export async function getAllPermissions(): Promise<UserTypePermission[]> {
  const query = `
    query GetAllPermissions {
      user_type_permissions(order_by: { user_type: asc, section: asc }) {
        ${PERMISSION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ user_type_permissions: UserTypePermission[] }>(query);
  return data.user_type_permissions;
}

export async function getPermissionsByType(userType: UserRole): Promise<UserTypePermission[]> {
  const query = `
    query GetPermissionsByType($userType: String!) {
      user_type_permissions(where: { user_type: { _eq: $userType } }, order_by: { section: asc }) {
        ${PERMISSION_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ user_type_permissions: UserTypePermission[] }>(query, { userType });
  return data.user_type_permissions;
}

export async function updatePermission(id: string, input: Partial<UserTypePermission>): Promise<UserTypePermission> {
  const mutation = `
    mutation UpdatePermission($id: uuid!, $set: user_type_permissions_set_input!) {
      update_user_type_permissions_by_pk(pk_columns: { id: $id }, _set: $set) {
        ${PERMISSION_FIELDS}
      }
    }
  `;
  const set: Record<string, unknown> = {};
  if (input.can_view !== undefined) set.can_view = input.can_view;
  if (input.can_edit !== undefined) set.can_edit = input.can_edit;
  if (input.can_create !== undefined) set.can_create = input.can_create;
  if (input.can_delete !== undefined) set.can_delete = input.can_delete;

  const data = await graphqlRequest<{ update_user_type_permissions_by_pk: UserTypePermission }>(mutation, { id, set });
  return data.update_user_type_permissions_by_pk;
}

// Secciones del sistema con sus labels
export const sectionLabels: Record<PermissionSection, string> = {
  dashboard: "Dashboard",
  claims: "Siniestros",
  inspecciones: "Inspecciones",
  agenda: "Agenda",
  catalogos: "Catálogos",
  catalogos_inspeccion: "Catálogos Inspección",
  operaciones: "Operaciones",
  administracion: "Administración",
  users: "Usuarios",
  companies: "Empresas",
  configuracion: "Configuración",
};

export const sectionOrder: PermissionSection[] = [
  "dashboard",
  "claims",
  "inspecciones",
  "agenda",
  "catalogos",
  "catalogos_inspeccion",
  "operaciones",
  "administracion",
  "users",
  "companies",
  "configuracion",
];

export const userTypeLabels: Record<UserRole, string> = {
  internal: "Interno",
  adjuster: "Liquidador",
  inspector: "Inspector",
  client_operator: "Operativo",
};

// ═══════════════════════════════════════════════════════════════
// Acciones disponibles por sección
// Solo se muestran los checks para acciones que realmente existen
// en la UI de cada módulo
// ═══════════════════════════════════════════════════════════════
export type PermissionAction = "view" | "edit" | "create" | "delete";

export const sectionActions: Record<PermissionSection, PermissionAction[]> = {
  dashboard: ["view"],
  claims: ["view", "edit", "create", "delete"],
  inspecciones: ["view", "edit", "create", "delete"],
  agenda: ["view"],
  catalogos: ["view", "edit", "create", "delete"],
  catalogos_inspeccion: ["view", "edit", "create", "delete"],
  operaciones: ["view", "edit", "create", "delete"],
  administracion: ["view", "edit", "create", "delete"],
  users: ["view", "edit", "create"],
  companies: ["view", "edit", "create", "delete"],
  configuracion: ["view", "edit"],
};

// ═══════════════════════════════════════════════════════════════
// Acciones disponibles por SUB-SECCIÓN
// Las sub-páginas pueden tener acciones distintas al módulo padre.
// Ej: claims_log solo tiene "view" (es un log de auditoría, read-only)
// Si una sub-sección no está en este mapa, hereda las acciones del padre.
// ═══════════════════════════════════════════════════════════════
export const subSectionActions: Record<string, PermissionAction[]> = {
  // ── Siniestros ──
  claims_listado: ["view", "create"],          // ver listado + crear siniestro
  claims_detalle: ["view", "edit"],            // ver/editar datos del siniestro
  claims_participantes: ["view", "edit", "create"], // ver/editar/crear participantes
  claims_incidente: ["view", "edit"],          // ver/editar datos del incidente
  claims_gestiones: ["view"],                  // ver gestiones (read-only)
  claims_documentos: ["view", "create", "delete"], // ver/subir/eliminar documentos
  claims_log: ["view"],                        // log de auditoría (read-only)

  // ── Inspecciones ──
  inspecciones_listado: ["view", "create"],    // ver listado + crear inspección
  inspecciones_detalle: ["view", "edit"],      // ver/editar datos de la inspección
  inspecciones_acta: ["view", "edit", "create"], // ver/editar/crear acta
  inspecciones_danos: ["view", "edit", "create", "delete"], // CRUD daños
  inspecciones_evidencias: ["view", "create", "delete"], // ver/subir/eliminar evidencias
  inspecciones_croquis: ["view", "edit", "create", "delete"], // CRUD croquis
  inspecciones_firmas: ["view", "create", "delete"], // ver/crear/eliminar firmas
  inspecciones_informe: ["view", "edit"],      // ver/editar informe

  // ── Catálogos (sub-páginas heredan del padre) ──
  // No se definen aquí → heredan catalogos: [view, edit, create, delete]

  // ── Operaciones (sub-páginas) ──
  operaciones_carga_siniestros: ["view", "create"], // ver + cargar
  operaciones_carga_catalogos: ["view", "create"],  // ver + cargar
  operaciones_inhabilitar: ["view", "edit", "delete"], // ver + inhabilitar + reactivar
  operaciones_reabrir: ["view", "edit"],            // ver + reabrir
};

// ═══════════════════════════════════════════════════════════════
// Sub-páginas de cada módulo (para drill-down opcional)
// Permite configurar permisos por pantalla individual dentro de un módulo
// ═══════════════════════════════════════════════════════════════
export interface SubPage {
  section: string;
  label: string;
}

export const sectionSubPages: Partial<Record<PermissionSection, SubPage[]>> = {
  claims: [
    { section: "claims_listado", label: "Listado de Siniestros" },
    { section: "claims_detalle", label: "Detalle de Siniestro" },
    { section: "claims_participantes", label: "Participantes" },
    { section: "claims_incidente", label: "Incidente" },
    { section: "claims_gestiones", label: "Gestiones" },
    { section: "claims_documentos", label: "Documentos" },
    { section: "claims_log", label: "Log de Auditoría" },
  ],
  inspecciones: [
    { section: "inspecciones_listado", label: "Listado de Inspecciones" },
    { section: "inspecciones_detalle", label: "Detalle de Inspección" },
    { section: "inspecciones_acta", label: "Acta" },
    { section: "inspecciones_danos", label: "Daños" },
    { section: "inspecciones_evidencias", label: "Evidencias" },
    { section: "inspecciones_croquis", label: "Croquis" },
    { section: "inspecciones_firmas", label: "Firmas" },
    { section: "inspecciones_informe", label: "Informe" },
  ],
  catalogos: [
    { section: "catalogos_ubicaciones", label: "Ubicaciones" },
    { section: "catalogos_causas", label: "Causas" },
    { section: "catalogos_tipos_siniestros", label: "Tipos de Siniestros" },
    { section: "catalogos_eventos", label: "Eventos" },
    { section: "catalogos_companias", label: "Compañías" },
    { section: "catalogos_corredores", label: "Corredores" },
    { section: "catalogos_asesores", label: "Asesores" },
    { section: "catalogos_lineas_negocio", label: "Líneas de Negocio" },
    { section: "catalogos_productos", label: "Productos" },
    { section: "catalogos_tipos_polizas", label: "Tipos de Pólizas" },
    { section: "catalogos_parentescos", label: "Parentescos" },
    { section: "catalogos_tipos_documentos", label: "Tipos de Documentos" },
    { section: "catalogos_antiguedades", label: "Antigüedades" },
    { section: "catalogos_clasificacion_bien", label: "Clasificación Bien" },
    { section: "catalogos_clasificacion_danos", label: "Clasificación Daños" },
    { section: "catalogos_destinos_vivienda", label: "Destinos Vivienda" },
  ],
  catalogos_inspeccion: [
    { section: "catalogos_inspeccion_muros", label: "Muros" },
    { section: "catalogos_inspeccion_cubierta", label: "Cubierta" },
    { section: "catalogos_inspeccion_pavimentos", label: "Pavimentos" },
    { section: "catalogos_inspeccion_cielos", label: "Cielos" },
    { section: "catalogos_inspeccion_cierre_perimetral", label: "Cierre Perimetral" },
    { section: "catalogos_inspeccion_terminaciones_exteriores", label: "Term. Exteriores" },
    { section: "catalogos_inspeccion_terminaciones_interiores", label: "Term. Interiores" },
    { section: "catalogos_inspeccion_relacion_asegurado", label: "Relación Asegurado" },
    { section: "catalogos_inspeccion_categorias_evidencia", label: "Categorías Evidencia" },
  ],
  operaciones: [
    { section: "operaciones_carga_siniestros", label: "Carga Siniestros" },
    { section: "operaciones_carga_catalogos", label: "Carga Catálogos" },
    { section: "operaciones_inhabilitar", label: "Inhabilitar" },
    { section: "operaciones_reabrir", label: "Reabrir" },
  ],
};
