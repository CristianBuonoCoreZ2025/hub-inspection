import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types";
import { filterAllowedFields } from "@/server/lib/immutable-fields";

interface FieldPermissionRow {
  field_name: string;
  can_edit: boolean;
}

/**
 * Obtiene los campos que el usuario puede editar para una sección dada.
 *
 * Regla: si no hay fila en field_permissions para (user_type, section, field_name),
 * el campo es editable por defecto. Solo las filas con can_edit=false restringen.
 *
 * @param userType  Rol del usuario (internal, adjuster, etc.)
 * @param section   Sección/sub-sección (ej: "catalogos_gestiones")
 * @param allFields Todos los campos editables de la entidad (ALLOWED_ON_UPDATE)
 * @returns Lista de campos que este usuario puede editar.
 */
export async function getEditableFields(
  userType: UserRole,
  section: string,
  allFields: string[]
): Promise<string[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("field_permissions")
    .select("field_name, can_edit")
    .eq("user_type", userType)
    .eq("section", section)
    .eq("can_edit", false);

  if (error) throw new Error(error.message);

  // Campos restringidos para este rol en esta sección
  const restricted = new Set((data as FieldPermissionRow[] ?? []).map((r) => r.field_name));

  // Todo lo que no esté restringido es editable
  return allFields.filter((f) => !restricted.has(f));
}

/**
 * Filtra el input dejando SOLO los campos que el usuario puede editar,
 * combinando la lista estática de permitidos con los permisos dinámicos.
 *
 * @param input        Datos enviados por el cliente.
 * @param allowedFields Campos permitidos para la operación (ALLOWED_ON_UPDATE).
 * @param userType     Rol del usuario.
 * @param section      Sección de la entidad.
 * @returns Input filtrado con solo los campos editables.
 */
export async function filterFieldsByPermission(
  input: Record<string, unknown>,
  allowedFields: string[],
  userType: UserRole,
  section: string
): Promise<Record<string, unknown>> {
  const editableFields = await getEditableFields(userType, section, allowedFields);
  return filterAllowedFields(input, editableFields) as Record<string, unknown>;
}

/**
 * Versión cliente-friendly: dado un mapa de field_permissions (ya consultado),
 * determina si un campo es editable.
 *
 * Se usa en el cliente para deshabilitar campos en el form.
 *
 * @param fieldPermissions  Lista de permisos (solo los can_edit=false importan)
 * @param fieldName         Campo a verificar
 * @returns true si el campo es editable, false si está restringido.
 */
export function isFieldEditable(
  fieldPermissions: { field_name: string; can_edit: boolean }[],
  fieldName: string
): boolean {
  const perm = fieldPermissions.find((p) => p.field_name === fieldName);
  if (!perm) return true; // default: editable
  return perm.can_edit;
}
