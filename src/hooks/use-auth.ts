"use client";

import { useEffect, useState } from "react";
import { getNhostClient } from "@/lib/nhost/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@nhost/nhost-js/auth";
import { graphqlRequest } from "@/lib/nhost/graphql";
import type { UserRole, UserTypePermission } from "@/types";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: UserRole;
  company_id: string | null;
}

export function useAuth() {
  const nhost = getNhostClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const syncUser = async () => {
      try {
        await nhost.refreshSession();
      } catch {
        // ignore refresh errors
      }
      const session = nhost.getUserSession();
      setUser(session?.user ?? null);
      setIsLoading(false);
    };
    syncUser();
  }, [nhost]);

  // Obtener perfil del usuario
  const { data: profile } = useQuery<UserProfile | null>({
    queryKey: ["auth-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const query = `
        query GetProfileByUserId($userId: uuid!) {
          profiles(where: { user_id: { _eq: $userId } }) {
            id
            user_id
            email
            full_name
            role
            company_id
          }
        }
      `;
      const data = await graphqlRequest<{ profiles: UserProfile[] }>(query, { userId: user.id });
      return data.profiles[0] ?? null;
    },
    enabled: !!user?.id,
  });

  // Obtener permisos del tipo de usuario
  const { data: permissions } = useQuery<UserTypePermission[]>({
    queryKey: ["auth-permissions", profile?.role],
    queryFn: async () => {
      if (!profile?.role) return [];
      const query = `
        query GetPermissionsByType($userType: String!) {
          user_type_permissions(where: { user_type: { _eq: $userType } }) {
            id
            user_type
            section
            can_view
            can_edit
            can_create
            can_delete
            created_at
            updated_at
          }
        }
      `;
      const data = await graphqlRequest<{ user_type_permissions: UserTypePermission[] }>(query, { userType: profile.role });
      return data.user_type_permissions;
    },
    enabled: !!profile?.role,
  });

  const signOut = async () => {
    try {
      const session = nhost.getUserSession();
      if (session?.refreshToken) {
        await nhost.auth.signOut({ refreshToken: session.refreshToken });
      }
    } catch (err) {
      toast.error((err as Error).message || "Error al cerrar sesión");
    } finally {
      nhost.clearSession();
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
      window.location.href = "/login";
    }
  };

  return { user, profile, permissions, isLoading, signOut };
}
