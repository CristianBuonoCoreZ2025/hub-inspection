"use client";

import { useEffect, useState } from "react";
import { getNhostClient } from "@/lib/nhost/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { User } from "@nhost/nhost-js/auth";

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
      window.location.href = "/login";
    }
  };

  return { user, isLoading, signOut };
}
