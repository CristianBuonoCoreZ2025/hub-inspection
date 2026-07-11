import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import type { UserRole, UserTypePermission } from "@/types";

/**
 * Datos del usuario autenticado en el servidor.
 * Se obtiene desde la cookie de sesión de Supabase.
 */
export interface ServerUser {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  profileId: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
}

/**
 * Obtiene el usuario autenticado desde la cookie de sesión.
 * Lanza error si no hay sesión válida.
 */
export async function getServerUser(): Promise<ServerUser> {
  const supabase = await createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autenticado");
  }

  // Obtener perfil para saber role + company_id
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, user_id, email, full_name, role, company_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) throw new Error("Perfil no encontrado");

  const p = profile as ProfileRow;

  return {
    userId: user.id,
    email: p.email,
    role: p.role,
    companyId: p.company_id,
    profileId: p.id,
  };
}

/**
 * Obtiene los permisos del usuario desde la BD.
 */
export async function getServerPermissions(
  role: UserRole
): Promise<UserTypePermission[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("user_type_permissions")
    .select(
      "id, user_type, section, can_view, can_edit, can_create, can_delete, created_at, updated_at"
    )
    .eq("user_type", role);

  if (error) throw new Error(error.message);
  return (data as UserTypePermission[]) ?? [];
}

/**
 * Verifica si el usuario tiene un permiso específico.
 * Resuelve sub-secciones con fallback al padre (igual que use-permissions.ts).
 */
export async function checkPermission(
  section: string,
  action: "view" | "edit" | "create" | "delete"
): Promise<boolean> {
  const user = await getServerUser();
  const permissions = await getServerPermissions(user.role);

  // Buscar permiso exacto
  let perm = permissions.find((p) => p.section === section);

  // Fallback al padre si es sub-sección
  if (!perm && section.includes("_")) {
    const parentCandidates = [
      section.split("_")[0],
      section.split("_").slice(0, 2).join("_"),
    ];
    for (const parent of parentCandidates) {
      const parentPerm = permissions.find((p) => p.section === parent);
      if (parentPerm) {
        perm = parentPerm;
        break;
      }
    }
  }

  if (!perm) return false;

  switch (action) {
    case "view":
      return perm.can_view;
    case "edit":
      return perm.can_edit;
    case "create":
      return perm.can_create;
    case "delete":
      return perm.can_delete;
    default:
      return false;
  }
}

/**
 * Verifica permiso y lanza error descriptivo si no lo tiene.
 */
export async function requirePermission(
  section: string,
  action: "view" | "edit" | "create" | "delete"
): Promise<void> {
  const hasPermission = await checkPermission(section, action);
  if (!hasPermission) {
    throw new Error(
      `No tienes permiso para ${action} en la sección "${section}"`
    );
  }
}
