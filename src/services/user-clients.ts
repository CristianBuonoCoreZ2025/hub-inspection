import { fetchAll, insertRow, deleteRow, deleteWhere, insertMany } from "@/lib/supabase/db";
import type { UserClient, Profile } from "@/types";

const USER_CLIENT_SELECT = "id, user_id, company_id, created_at, company:companies!user_clients_company_id_fkey(id, name, slug)";

export async function getUserClients(userId: string): Promise<UserClient[]> {
  return fetchAll<UserClient>("user_clients", {
    select: USER_CLIENT_SELECT,
    eq: { user_id: userId },
  });
}

/**
 * Obtiene todos los usuarios (liquidadores, inspectores, operativos)
 * asociados a una empresa cliente vía la tabla user_clients.
 */
export async function getUsersByCompany(companyId: string): Promise<(Profile & { user_clients: UserClient[] })[]> {
  const userClients = await fetchAll<UserClient>("user_clients", {
    select: USER_CLIENT_SELECT,
    eq: { company_id: companyId },
  });

  if (userClients.length === 0) return [];

  // Obtener los user_ids únicos
  const userIds = [...new Set(userClients.map(uc => uc.user_id))];

  // Buscar perfiles por user_id
  const profiles = await fetchAll<Profile>("profiles", {
    select: "id, user_id, company_id, full_name, email, phone, avatar_url, role, is_active, created_at, updated_at",
    in: { user_id: userIds },
  });

  // Mapear perfiles con sus user_clients
  const profilesByUserId = new Map(profiles.map(p => [p.user_id, p]));
  const seen = new Set<string>();
  const result: (Profile & { user_clients: UserClient[] })[] = [];

  for (const uc of userClients) {
    const profile = profilesByUserId.get(uc.user_id);
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    const userClientsForThisUser = userClients.filter(c => c.user_id === uc.user_id);
    result.push({ ...profile, user_clients: userClientsForThisUser });
  }

  return result;
}

export async function addUserClient(userId: string, companyId: string): Promise<UserClient> {
  return insertRow<UserClient>(
    "user_clients",
    { user_id: userId, company_id: companyId },
    USER_CLIENT_SELECT,
  );
}

export async function removeUserClient(id: string): Promise<boolean> {
  await deleteRow("user_clients", id);
  return true;
}

export async function setUserClients(userId: string, companyIds: string[]): Promise<void> {
  // Delete existing
  await deleteWhere("user_clients", { user_id: userId });

  // Insert new
  if (companyIds.length === 0) return;
  await insertMany(
    "user_clients",
    companyIds.map((companyId) => ({ user_id: userId, company_id: companyId })),
  );
}
