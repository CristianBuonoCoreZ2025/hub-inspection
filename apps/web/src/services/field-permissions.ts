import { fetchAll, deleteRow, getSupabaseClient } from "@/lib/supabase/db";
import type { UserRole } from "@/types";

export interface FieldPermission {
  id: string;
  user_type: string;
  section: string;
  field_name: string;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

const FIELD_PERMISSION_FIELDS =
  "id, user_type, section, field_name, can_edit, created_at, updated_at";

/**
 * Obtiene TODOS los field permissions.
 */
export async function getAllFieldPermissions(): Promise<FieldPermission[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("field_permissions")
    .select(FIELD_PERMISSION_FIELDS)
    .order("user_type", { ascending: true })
    .order("section", { ascending: true })
    .order("field_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as FieldPermission[]) ?? [];
}

/**
 * Obtiene los field permissions para un tipo de usuario y sección.
 */
export async function getFieldPermissions(
  userType: UserRole,
  section: string
): Promise<FieldPermission[]> {
  return fetchAll<FieldPermission>("field_permissions", {
    select: FIELD_PERMISSION_FIELDS,
    eq: { user_type: userType, section },
    order: { column: "field_name", ascending: true },
  });
}

/**
 * Crea o actualiza un field permission.
 * Usa upsert: si existe (user_type, section, field_name) actualiza, si no crea.
 */
export async function upsertFieldPermission(
  userType: string,
  section: string,
  fieldName: string,
  canEdit: boolean
): Promise<FieldPermission> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("field_permissions")
    .upsert(
      {
        user_type: userType,
        section,
        field_name: fieldName,
        can_edit: canEdit,
      },
      { onConflict: "field_permissions_user_type_section_field_name_key" }
    )
    .select(FIELD_PERMISSION_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return data as FieldPermission;
}

/**
 * Elimina un field permission (vuelve al default = editable).
 */
export async function deleteFieldPermission(id: string): Promise<void> {
  await deleteRow("field_permissions", id);
}
