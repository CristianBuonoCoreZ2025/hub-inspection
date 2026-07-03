import { graphqlRequest } from "@/lib/nhost/graphql";
import type { UserClient, Profile } from "@/types";

const USER_CLIENT_FIELDS = `
  id
  user_id
  company_id
  created_at
  company {
    id
    name
    slug
  }
`;

export async function getUserClients(userId: string): Promise<UserClient[]> {
  const query = `
    query GetUserClients($userId: uuid!) {
      user_clients(where: { user_id: { _eq: $userId } }) {
        ${USER_CLIENT_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ user_clients: UserClient[] }>(query, { userId });
  return data.user_clients;
}

/**
 * Obtiene todos los usuarios (liquidadores, inspectores, operativos)
 * asociados a una empresa cliente vía la tabla user_clients.
 */
export async function getUsersByCompany(companyId: string): Promise<(Profile & { user_clients: UserClient[] })[]> {
  // Query user_clients y luego resolvemos los perfiles por user_id
  const query = `
    query GetUsersByCompany($companyId: uuid!) {
      user_clients(where: { company_id: { _eq: $companyId } }) {
        id
        user_id
        company_id
        created_at
        company {
          id
          name
          slug
        }
      }
    }
  `;
  const data = await graphqlRequest<{ user_clients: UserClient[] }>(query, { companyId });

  if (data.user_clients.length === 0) return [];

  // Obtener los user_ids únicos
  const userIds = [...new Set(data.user_clients.map(uc => uc.user_id))];

  // Buscar perfiles por user_id
  const profilesQuery = `
    query GetProfilesByUserIds($userIds: [uuid!]!) {
      profiles(where: { user_id: { _in: $userIds } }) {
        id
        user_id
        company_id
        full_name
        email
        phone
        avatar_url
        role
        is_active
        created_at
        updated_at
      }
    }
  `;
  const profilesData = await graphqlRequest<{ profiles: Profile[] }>(profilesQuery, { userIds });

  // Mapear perfiles con sus user_clients
  const profilesByUserId = new Map(profilesData.profiles.map(p => [p.user_id, p]));
  const seen = new Set<string>();
  const result: (Profile & { user_clients: UserClient[] })[] = [];

  for (const uc of data.user_clients) {
    const profile = profilesByUserId.get(uc.user_id);
    if (!profile || seen.has(profile.id)) continue;
    seen.add(profile.id);
    const userClientsForThisUser = data.user_clients.filter(c => c.user_id === uc.user_id);
    result.push({ ...profile, user_clients: userClientsForThisUser });
  }

  return result;
}

export async function addUserClient(userId: string, companyId: string): Promise<UserClient> {
  const mutation = `
    mutation AddUserClient($object: user_clients_insert_input!) {
      insert_user_clients_one(object: $object, on_conflict: { constraint: user_clients_user_id_company_id_key, update_columns: [] }) {
        ${USER_CLIENT_FIELDS}
      }
    }
  `;
  const data = await graphqlRequest<{ insert_user_clients_one: UserClient }>(mutation, {
    object: { user_id: userId, company_id: companyId },
  });
  return data.insert_user_clients_one;
}

export async function removeUserClient(id: string): Promise<boolean> {
  const mutation = `
    mutation RemoveUserClient($id: uuid!) {
      delete_user_clients_by_pk(id: $id) {
        id
      }
    }
  `;
  await graphqlRequest(mutation, { id });
  return true;
}

export async function setUserClients(userId: string, companyIds: string[]): Promise<void> {
  // Delete existing
  const deleteMut = `
    mutation DeleteAllUserClients($userId: uuid!) {
      delete_user_clients(where: { user_id: { _eq: $userId } }) {
        affected_rows
      }
    }
  `;
  await graphqlRequest(deleteMut, { userId });

  // Insert new
  if (companyIds.length === 0) return;
  const insertMut = `
    mutation InsertUserClients($objects: [user_clients_insert_input!]!) {
      insert_user_clients(objects: $objects, on_conflict: { constraint: user_clients_user_id_company_id_key, update_columns: [] }) {
        affected_rows
      }
    }
  `;
  await graphqlRequest(insertMut, {
    objects: companyIds.map((companyId) => ({ user_id: userId, company_id: companyId })),
  });
}
