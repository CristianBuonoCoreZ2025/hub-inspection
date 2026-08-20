"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { ShieldCheck, Loader2, WifiOff } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations";
import { loginOffline } from "@/lib/auth/offline-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Página de login offline.
 * Se muestra cuando no hay conexión y el usuario intenta acceder al mobile.
 * Valida contra credenciales guardadas en IndexedDB.
 */
export function OfflineLogin() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: standardSchemaResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await loginOffline(data.email, data.password);
      if (!result.success) {
        setError(result.error || "Error de autenticación offline");
        return;
      }
      // Guardar profile offline en sessionStorage para que useAuth lo pueda leer
      if (result.profile) {
        sessionStorage.setItem("offline-profile", JSON.stringify({
          id: result.profile.id,
          user_id: result.profile.user_id,
          email: result.profile.email,
          full_name: result.profile.full_name,
          role: result.profile.role,
          company_id: result.profile.company_id,
          company: result.profile.company_name
            ? { name: result.profile.company_name, logo_url: result.profile.company_logo_url }
            : null,
          mobile_enabled: result.profile.mobile_enabled,
        }));
        sessionStorage.setItem("offline-mode", "true");
      }
      router.push("/mobile/inspecciones");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="auth-title">Claims Hub</h1>
        <p className="auth-subtitle">Modo offline</p>

        <div className="offline-login-banner">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>Sin conexión — Ingresa con tus credenciales descargadas</span>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="auth-form">
          <div className="auth-field">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
            />
            {errors.email && (
              <p className="auth-error">{errors.email.message}</p>
            )}
          </div>

          <div className="auth-field">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="auth-error">{errors.password.message}</p>
            )}
          </div>

          {error && <p className="auth-error">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading}
            className="auth-submit"
          >
            {isLoading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Ingresando...</>
            ) : (
              "Ingresar"
            )}
          </Button>
        </form>

        <p className="auth-footer">
          Las credenciales offline expiran después de 10 días.
          Conéctate a internet para refrescarlas.
        </p>
      </div>
    </div>
  );
}
