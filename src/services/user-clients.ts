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
 * asociados a una empresa cliente.
 *
 * Combina dos fuentes:
 *  1. profiles donde company_id = companyId (relación directa — la mayoría)
 *  2. user_clients donde company_id = companyId (relación many-to-many — casos extra)
 *
 * Antes solo consultaba user_clients, que tenía muy pocos registros.
 * Ahora consulta profiles por company_id directamente, que es donde
 * realmente están los usuarios (33 en McLarens vs 1 en user_clients).
 */
export async function getUsersByCompany(companyId: string): Promise<(Profile & { user_clients: UserClient[] })[]> {
  // 1. Perfiles con company_id directo (la fuente principal)
  const profiles = await fetchAll<Profile>("profiles", {
    select: "id, user_id, company_id, full_name, email, phone, avatar_url, role, is_active, created_at, updated_at",
    eq: { company_id: companyId },
  });

  // 2. user_clients para usuarios asociados vía many-to-many (sin company_id directo)
  const userClients = await fetchAll<UserClient>("user_clients", {
    select: USER_CLIENT_SELECT,
    eq: { company_id: companyId },
  });

  // 3. Merge: perfiles directos + perfiles via user_clients que no tengan company_id
  const seenProfileIds = new Set(profiles.map(p => p.id));
  const profilesByUserId = new Map(profiles.map(p => [p.user_id, p]));

  // Buscar perfiles de user_clients que no están ya incluidos
  const extraUserIds = userClients
    .map(uc => uc.user_id)
    .filter(uid => !profilesByUserId.has(uid));

  let allProfiles = profiles;
  if (extraUserIds.length > 0) {
    const extraProfiles = await fetchAll<Profile>("profiles", {
      select: "id, user_id, company_id, full_name, email, phone, avatar_url, role, is_active, created_at, updated_at",
      in: { user_id: extraUserIds },
    });
    for (const p of extraProfiles) {
      if (!seenProfileIds.has(p.id)) {
        seenProfileIds.add(p.id);
        profilesByUserId.set(p.user_id, p);
        allProfiles = [...allProfiles, p];
      }
    }
  }

  // 4. Adjuntar user_clients a cada perfil (si los tiene)
  return allProfiles.map(p => ({
    ...p,
    user_clients: userClients.filter(uc => uc.user_id === p.user_id),
  }));
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
