import { fetchAll, updateWhere } from "@/lib/supabase/db";
import type { UserTypeDataAccess, UserRole } from "@/types";

export async function getUserTypeDataAccess(userType: UserRole) {
  const rows = await fetchAll<UserTypeDataAccess>("user_type_data_access", {
    select: "user_type, is_admin, see_all_client_claims, created_at, updated_at",
    eq: { user_type: userType },
    limit: 1,
  });
  return rows[0] ?? null;
}

export async function getAllUserTypeDataAccess() {
  return fetchAll<UserTypeDataAccess>("user_type_data_access", {
    select: "user_type, is_admin, see_all_client_claims, created_at, updated_at",
    order: { column: "user_type", ascending: true },
  });
}

export async function updateUserTypeDataAccess(
  userType: UserRole,
  input: Partial<Pick<UserTypeDataAccess, "is_admin" | "see_all_client_claims">>,
) {
  const [updated] = await updateWhere<UserTypeDataAccess>("user_type_data_access", {
    ...input,
    updated_at: new Date().toISOString(),
  }, { user_type: userType });
  return updated;
}
