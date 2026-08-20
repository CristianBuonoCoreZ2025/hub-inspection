"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Session, User as SupabaseUser } from "@supabase/supabase-js";
import type { UserRole, UserTypePermission, UserTypeDataAccess } from "@/types";
import { setUserTimeZone } from "@/lib/timezone";

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  rut?: string | null;
  avatar_url?: string | null;
  timezone?: string | null;
  role: UserRole;
  company_id: string | null;
  mobile_enabled?: boolean;
  company?: { id: string; name: string; logo_url: string | null; phone: string | null; email: string | null; address: string | null } | null;
}

interface AppUser {
  id: string;
  email: string;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
}

function toAppUser(user: SupabaseUser | null): AppUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email || "",
    user_metadata: user.user_metadata || {},
    app_metadata: user.app_metadata || {},
  };
}

export function useAuth() {
  const supabase = getSupabaseClient();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      setUser(toAppUser(session?.user ?? null));
      setIsLoading(false);
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: string, session: Session | null) => {
      setUser(toAppUser(session?.user ?? null));
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Obtener perfil del usuario
  const { data: profile } = useQuery<UserProfile | null>({
    queryKey: ["auth-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, email, full_name, first_name, last_name, phone, rut, avatar_url, timezone, role, company_id, mobile_enabled, company:companies!profiles_company_id_fkey(id, name, logo_url, phone, email, address)")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as UserProfile) ?? null;
    },
    enabled: !!user?.id,
  });

  // Guardar/detectar zona horaria del usuario
  const timezoneMutation = useMutation({
    mutationFn: async ({ profileId, timeZone }: { profileId: string; timeZone: string }) => {
      const { error } = await supabase.from("profiles").update({ timezone: timeZone }).eq("id", profileId);
      if (error) throw new Error(error.message);
    },
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!profile) return;
    if (profile.timezone) {
      setUserTimeZone(profile.timezone);
    } else if (!timezoneMutation.isPending && !timezoneMutation.isSuccess) {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      setUserTimeZone(detected);
      timezoneMutation.mutate({ profileId: profile.id, timeZone: detected });
    }
  }, [profile, timezoneMutation]);

  // Obtener permisos del tipo de usuario
  const { data: permissions } = useQuery<UserTypePermission[]>({
    queryKey: ["auth-permissions", profile?.role],
    queryFn: async () => {
      if (!profile?.role) return [];
      const { data, error } = await supabase
        .from("user_type_permissions")
        .select(
          "id, user_type, section, can_view, can_edit, can_create, can_delete, created_at, updated_at"
        )
        .eq("user_type", profile.role);
      if (error) throw new Error(error.message);
      return (data as UserTypePermission[]) ?? [];
    },
    enabled: !!profile?.role,
  });

  // Obtener acceso a datos del tipo de usuario (admin / ver todo por cliente)
  const { data: dataAccess } = useQuery<UserTypeDataAccess | null>({
    queryKey: ["auth-data-access", profile?.role],
    queryFn: async () => {
      if (!profile?.role) return null;
      const { data, error } = await supabase
        .from("user_type_data_access")
        .select("user_type, is_admin, see_all_client_claims, created_at, updated_at")
        .eq("user_type", profile.role)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data as UserTypeDataAccess) ?? null;
    },
    enabled: !!profile?.role,
  });

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      toast.error((err as Error).message || "Error al cerrar sesión");
    } finally {
      queryClient.invalidateQueries({ queryKey: ["auth-user"] });
      queryClient.invalidateQueries({ queryKey: ["auth-profile"] });
      queryClient.invalidateQueries({ queryKey: ["auth-data-access"] });
      window.location.href = "/login";
    }
  };

  return { user, profile, permissions, dataAccess, isLoading, signOut };
}
